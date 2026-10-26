package com.kiyuziyu.api.service;

import com.google.cloud.firestore.Firestore;
import com.google.firebase.auth.FirebaseToken;
import com.kiyuziyu.api.exception.BadRequestException;
import com.kiyuziyu.api.exception.ForbiddenException;
import com.kiyuziyu.api.integration.shopify.ShopifyContextHolder;
import com.kiyuziyu.api.integration.shopify.ShopifyGraphQLClient;
import com.kiyuziyu.api.integration.shopify.ShopifyGraphQLException;
import com.kiyuziyu.api.model.ShopifyConnection;
import com.kiyuziyu.api.model.ShopifyConnectionStatus;
import com.kiyuziyu.api.model.ShopifyOAuthState;
import com.kiyuziyu.api.model.Store;
import com.kiyuziyu.api.repository.ShopifyConnectionRepository;
import com.kiyuziyu.api.repository.ShopifyOAuthStateRepository;
import com.kiyuziyu.api.repository.StoreRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;

@Service
public class ShopifyOAuthService {

    private static final Logger log = LoggerFactory.getLogger(ShopifyOAuthService.class);
    
    @Value("${shopify.oauth.redirect-uri:https://kiyuziyu-api-703805908757.asia-south1.run.app/api/v1/shopify/oauth/callback}")
    private String redirectUri;

    @Value("${shopify.oauth.scopes:write_products,write_inventory}")
    private String scopes;

    @Value("${shopify.client-id:50616f42c3e0cfbb5ba9f29a2143acf6}")
    private String clientId;

    @Value("${shopify.client-secret:}")
    private String clientSecret;

    @Autowired(required = false)
    private Firestore firestore;

    @Autowired
    private ShopifyOAuthStateRepository stateRepository;

    @Autowired
    private ShopifyConnectionService shopifyConnectionService;
    
    @Autowired
    private ShopifyConnectionRepository shopifyConnectionRepository;
    
    @Autowired
    private StoreRepository storeRepository;

    @Autowired
    private ShopifyGraphQLClient shopifyGraphQLClient;

    @Autowired
    private ShopifyWebhookRegistrationService webhookRegistrationService;

    public String resolveClientSecret() {
        if (clientSecret != null && !clientSecret.trim().isEmpty() && !"your_client_secret_here".equalsIgnoreCase(clientSecret.trim())) {
            return clientSecret.trim();
        }
        String envSecret = System.getenv("SHOPIFY_CLIENT_SECRET");
        if (envSecret != null && !envSecret.trim().isEmpty() && !"your_client_secret_here".equalsIgnoreCase(envSecret.trim())) {
            return envSecret.trim();
        }
        if (firestore != null) {
            try {
                com.google.cloud.firestore.DocumentSnapshot doc = firestore.collection("settings").document("shopifyApp").get().get();
                if (doc.exists() && doc.getString("clientSecret") != null && !doc.getString("clientSecret").trim().isEmpty()) {
                    return doc.getString("clientSecret").trim();
                }
            } catch (Exception e) {
                log.warn("[ShopifyOAuth] Could not fetch clientSecret from settings/shopifyApp: {}", e.getMessage());
            }
        }
        return clientSecret;
    }

    public void saveAppCredentials(String secret) {
        if (firestore != null && secret != null && !secret.trim().isEmpty()) {
            try {
                Map<String, Object> data = new HashMap<>();
                data.put("clientId", clientId);
                data.put("clientSecret", secret.trim());
                data.put("updatedAt", Instant.now().toString());
                firestore.collection("settings").document("shopifyApp").set(data).get();
                this.clientSecret = secret.trim();
                log.info("[ShopifyOAuth] Saved Shopify App credentials to settings/shopifyApp in Firestore");
            } catch (Exception e) {
                log.error("[ShopifyOAuth] Failed to save credentials to Firestore: {}", e.getMessage(), e);
            }
        }
    }

    public String startOAuth(FirebaseToken token, String shopDomain) throws Exception {
        return startOAuth(token, shopDomain, null);
    }

    public String startOAuth(FirebaseToken token, String shopDomain, String redirectOrigin) throws Exception {
        if (shopDomain == null || shopDomain.trim().isEmpty()) {
            throw new BadRequestException("Shop domain is required.");
        }
        
        String normalizedDomain = shopifyConnectionService.normalizeAndValidateDomain(shopDomain);
        String tenantId = shopifyConnectionService.resolveTenantId(token);
        
        // Generate random state
        String state = UUID.randomUUID().toString().replace("-", "");
        long expiry = System.currentTimeMillis() + (15 * 60 * 1000); // 15 mins expiry
        
        ShopifyOAuthState oauthState = new ShopifyOAuthState(state, tenantId, normalizedDomain, expiry, redirectOrigin);
        stateRepository.save(oauthState);
        
        // Build URL
        return String.format(
                "https://%s/admin/oauth/authorize?client_id=%s&scope=%s&redirect_uri=%s&state=%s",
                normalizedDomain,
                clientId,
                scopes,
                redirectUri,
                state
        );
    }

    public ShopifyOAuthState handleCallback(String shop, String code, String state, String hmac, Map<String, String> allParams) throws Exception {
        log.info("[ShopifyOAuth] Handling callback for shop: {}, state: {}", shop, state);
        
        // Validate state
        ShopifyOAuthState oauthState = stateRepository.findById(state);
        if (oauthState == null) {
            throw new ForbiddenException("Invalid or missing state parameter");
        }
        
        // Delete state immediately to prevent reuse
        stateRepository.delete(state);
        
        if (System.currentTimeMillis() > oauthState.getExpiryTimestamp()) {
            throw new ForbiddenException("OAuth state has expired");
        }
        
        String normalizedShop = shopifyConnectionService.normalizeAndValidateDomain(shop);
        if (!normalizedShop.equalsIgnoreCase(oauthState.getShopDomain())) {
            throw new ForbiddenException("Shop domain mismatch");
        }
        
        String effectiveSecret = resolveClientSecret();
        if (effectiveSecret == null || effectiveSecret.trim().isEmpty() || "your_client_secret_here".equalsIgnoreCase(effectiveSecret.trim())) {
            log.error("[ShopifyOAuth] Missing SHOPIFY_CLIENT_SECRET. Cannot validate HMAC or exchange OAuth code.");
            throw new BadRequestException("Shopify App Client Secret is not configured on the server.");
        }

        // Validate HMAC
        Map<String, String> hmacParams = new HashMap<>(allParams);
        hmacParams.remove("hmac");
        
        if (!validateHmac(hmacParams, hmac, effectiveSecret)) {
            log.warn("[ShopifyOAuth] HMAC validation failed for shop: {}. Rejecting callback.", shop);
            throw new ForbiddenException("HMAC validation failed");
        }
        
        // Timestamp validation (check freshness - within 15 mins)
        String timestamp = allParams.get("timestamp");
        if (timestamp != null) {
            try {
                long ts = Long.parseLong(timestamp);
                long currentTs = System.currentTimeMillis() / 1000L;
                if (Math.abs(currentTs - ts) > 900) {
                    throw new ForbiddenException("Callback timestamp is too old or too far in the future.");
                }
            } catch (NumberFormatException e) {
                // Ignore if it's not a number
            }
        }
        
        // Exchange code for permanent offline token
        Map<String, String> tokenData = exchangeCodeForToken(normalizedShop, code, effectiveSecret);
        String grantedScopes = tokenData.get("scope");
        
        if (grantedScopes == null || !grantedScopes.contains("write_inventory") || !grantedScopes.contains("write_products")) {
            log.warn("[ShopifyOAuth] Requested scopes were not fully granted by the merchant: {}", grantedScopes);
            throw new ForbiddenException("Missing required Shopify permissions (write_products, write_inventory)");
        }
        
        // Save to Firestore for the tenant
        saveShopifyConnection(oauthState.getTenantId(), normalizedShop, tokenData);

        return oauthState;
    }
    
    private boolean validateHmac(Map<String, String> params, String hmac, String secret) {
        try {
            List<String> keys = new ArrayList<>(params.keySet());
            Collections.sort(keys);
            
            StringBuilder sb = new StringBuilder();
            for (String key : keys) {
                if (sb.length() > 0) sb.append("&");
                sb.append(key).append("=").append(params.get(key));
            }
            
            Mac mac = Mac.getInstance("HmacSHA256");
            SecretKeySpec secretKeySpec = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            mac.init(secretKeySpec);
            byte[] hmacBytes = mac.doFinal(sb.toString().getBytes(StandardCharsets.UTF_8));
            
            StringBuilder hexString = new StringBuilder();
            for (byte b : hmacBytes) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            
            byte[] providedHmacBytes = hmac.toLowerCase().getBytes(StandardCharsets.UTF_8);
            byte[] calculatedHmacBytes = hexString.toString().toLowerCase().getBytes(StandardCharsets.UTF_8);
            
            return java.security.MessageDigest.isEqual(providedHmacBytes, calculatedHmacBytes);
        } catch (Exception e) {
            log.error("[ShopifyOAuth] Error calculating HMAC: ", e);
            return false;
        }
    }
    
    private Map<String, String> exchangeCodeForToken(String shopDomain, String code, String secret) throws Exception {
        RestTemplate restTemplate = new RestTemplate();
        String url = "https://" + shopDomain + "/admin/oauth/access_token";
        
        Map<String, String> body = new HashMap<>();
        body.put("client_id", clientId);
        body.put("client_secret", secret);
        body.put("code", code);
        body.put("expiring", "1"); // Shopify now requires modern expiring offline access tokens for GraphQL Admin API
        
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        
        HttpEntity<Map<String, String>> request = new HttpEntity<>(body, headers);
        
        ResponseEntity<Map> response = restTemplate.postForEntity(url, request, Map.class);
        
        if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
            String token = (String) response.getBody().get("access_token");
            String scope = (String) response.getBody().get("scope");
            String refreshToken = (String) response.getBody().get("refresh_token");
            Object expiresInObj = response.getBody().get("expires_in");
            Object refreshExpiresInObj = response.getBody().get("refresh_token_expires_in");
            
            if (token != null && !token.trim().isEmpty()) {
                Map<String, String> result = new HashMap<>();
                result.put("access_token", token.trim());
                result.put("scope", scope != null ? scope : "");
                if (refreshToken != null) result.put("refresh_token", refreshToken.trim());
                if (expiresInObj != null) result.put("expires_in", String.valueOf(expiresInObj));
                if (refreshExpiresInObj != null) result.put("refresh_token_expires_in", String.valueOf(refreshExpiresInObj));
                return result;
            }
        }
        
        throw new BadRequestException("Failed to exchange authorization code for access token.");
    }
    
    private void saveShopifyConnection(String tenantId, String shopDomain, Map<String, String> tokenData) throws Exception {
        Store store = shopifyConnectionService.getOrCreatePrimaryTenantStore(tenantId);
        
        ShopifyConnection existing = shopifyConnectionRepository.findByTenantId(tenantId);
        String now = Instant.now().toString();
        
        long currentTimeSeconds = Instant.now().getEpochSecond();
        String accessToken = tokenData.get("access_token");
        String grantedScopes = tokenData.get("scope");
        String refreshToken = tokenData.get("refresh_token");
        
        Long accessTokenExpiresAt = null;
        if (tokenData.get("expires_in") != null) {
            accessTokenExpiresAt = currentTimeSeconds + Long.parseLong(tokenData.get("expires_in"));
        }
        
        Long refreshTokenExpiresAt = null;
        if (tokenData.get("refresh_token_expires_in") != null) {
            refreshTokenExpiresAt = currentTimeSeconds + Long.parseLong(tokenData.get("refresh_token_expires_in"));
        }
        
        ShopifyConnection activeConn;
        if (existing != null) {
            existing.setShopifyStoreDomain(shopDomain);
            existing.setStatus(ShopifyConnectionStatus.CONNECTED.name());
            existing.setUpdatedAt(now);
            existing.setConnectedAt(now);
            existing.setAccessToken(accessToken);
            existing.setScopes(grantedScopes);
            existing.setRefreshToken(refreshToken);
            existing.setAccessTokenExpiresAt(accessTokenExpiresAt);
            existing.setRefreshTokenExpiresAt(refreshTokenExpiresAt);
            shopifyConnectionRepository.save(existing);
            activeConn = existing;
        } else {
            String connectionId = "sc_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
            ShopifyConnection newConn = new ShopifyConnection(
                    connectionId,
                    tenantId,
                    store.getStoreId(),
                    shopDomain,
                    null,
                    ShopifyConnectionStatus.CONNECTED.name(),
                    now,
                    now
            );
            newConn.setAccessToken(accessToken);
            newConn.setScopes(grantedScopes);
            newConn.setRefreshToken(refreshToken);
            newConn.setAccessTokenExpiresAt(accessTokenExpiresAt);
            newConn.setRefreshTokenExpiresAt(refreshTokenExpiresAt);
            shopifyConnectionRepository.save(newConn);
            activeConn = newConn;
        }
        log.info("[ShopifyOAuth] Saved active Shopify connection for tenant: {}, domain: {}", tenantId, shopDomain);

        // Automatically verify live GraphQL connection and retrieve shopId
        try {
            ShopifyContextHolder.setContext(shopDomain);
            Map<String, Object> shopData = shopifyGraphQLClient.verifyShopConnection();
            if (shopData != null && shopData.containsKey("shop")) {
                @SuppressWarnings("unchecked")
                Map<String, Object> shop = (Map<String, Object>) shopData.get("shop");
                String shopId = (String) shop.get("id");
                if (shopId != null) {
                    activeConn.setShopifyStoreId(shopId);
                    shopifyConnectionRepository.save(activeConn);
                    log.info("[ShopifyOAuth] Automatic verification succeeded for tenantId={}, domain={}, shopId={}",
                            tenantId, shopDomain, shopId);
                }
            }
            // Automatically register webhooks for this connected store
            try {
                webhookRegistrationService.registerAllRequiredWebhooks(shopDomain);
            } catch (Exception whEx) {
                log.warn("[ShopifyOAuth] Automatic webhook registration notice for shop {}: {}", shopDomain, whEx.getMessage());
            }
        } catch (Exception verifyEx) {
            log.warn("[ShopifyOAuth] Automatic verification notice during callback for shop {}: {}", shopDomain, verifyEx.getMessage());
        } finally {
            ShopifyContextHolder.clearContext();
        }
    }

    public Map<String, Object> verifyConnection(FirebaseToken token) throws Exception {
        String tenantId = shopifyConnectionService.resolveTenantId(token);
        ShopifyConnection connection = shopifyConnectionRepository.findByTenantId(tenantId);
        if (connection == null || connection.getShopifyStoreDomain() == null) {
            throw new BadRequestException("No Shopify store connection found for this tenant.");
        }
        
        String domain = connection.getShopifyStoreDomain();
        if (connection.getAccessToken() == null || connection.getAccessToken().trim().isEmpty()) {
            throw new BadRequestException("Shopify store " + domain + " does not have an active access token. Please authorize via OAuth.");
        }
        
        ShopifyContextHolder.setContext(domain);
        try {
            Map<String, Object> shopData = shopifyGraphQLClient.verifyShopConnection();
            log.info("[ShopifyOAuth] Verified live GraphQL connection for tenantId={}, domain={}", tenantId, domain);
            
            if (shopData != null && shopData.containsKey("shop")) {
                Map<String, Object> shop = (Map<String, Object>) shopData.get("shop");
                String shopId = (String) shop.get("id");
                if (shopId != null && (connection.getShopifyStoreId() == null || !shopId.equals(connection.getShopifyStoreId()))) {
                    connection.setShopifyStoreId(shopId);
                    connection.setStatus(ShopifyConnectionStatus.CONNECTED.name());
                    connection.setUpdatedAt(Instant.now().toString());
                    shopifyConnectionRepository.save(connection);
                }
            }
            return shopData;
        } catch (ShopifyGraphQLException e) {
            log.error("[ShopifyOAuth] Shopify GraphQL verification failed for domain {}: {}", domain, e.getMessage());
            if (e.getMessage() != null && e.getMessage().contains("401")) {
                connection.setStatus("UNAUTHORIZED");
                shopifyConnectionRepository.save(connection);
            }
            throw e;
        } finally {
            ShopifyContextHolder.clearContext();
        }
    }
}
