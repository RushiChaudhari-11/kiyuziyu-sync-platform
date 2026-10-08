package com.kiyuziyu.api.service;

import com.google.firebase.auth.FirebaseToken;
import com.kiyuziyu.api.exception.BadRequestException;
import com.kiyuziyu.api.exception.ForbiddenException;
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
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ExecutionException;

@Service
public class ShopifyOAuthService {

    private static final Logger log = LoggerFactory.getLogger(ShopifyOAuthService.class);
    
    // According to prompt requirements, use hardcoded scopes unless passed.
    private static final String SCOPES = "write_inventory,write_products";
    private static final String REDIRECT_URI = "https://eleven-ways-double.loca.lt/api/v1/shopify/oauth/callback";

    @Value("${shopify.client-id}")
    private String clientId;

    @Value("${shopify.client-secret}")
    private String clientSecret;

    @Autowired
    private ShopifyOAuthStateRepository stateRepository;

    @Autowired
    private ShopifyConnectionService shopifyConnectionService;
    
    @Autowired
    private ShopifyConnectionRepository shopifyConnectionRepository;
    
    @Autowired
    private StoreRepository storeRepository;

    public String startOAuth(FirebaseToken token, String shopDomain) throws Exception {
        if (shopDomain == null || shopDomain.trim().isEmpty()) {
            throw new BadRequestException("Shop domain is required.");
        }
        
        String normalizedDomain = shopifyConnectionService.normalizeAndValidateDomain(shopDomain);
        String tenantId = shopifyConnectionService.resolveTenantId(token);
        
        // Generate random state
        String state = UUID.randomUUID().toString().replace("-", "");
        long expiry = System.currentTimeMillis() + (15 * 60 * 1000); // 15 mins expiry
        
        ShopifyOAuthState oauthState = new ShopifyOAuthState(state, tenantId, normalizedDomain, expiry);
        stateRepository.save(oauthState);
        
        // Build URL
        return String.format(
                "https://%s/admin/oauth/authorize?client_id=%s&scope=%s&redirect_uri=%s&state=%s",
                normalizedDomain,
                clientId,
                SCOPES,
                REDIRECT_URI,
                state
        );
    }

    public void handleCallback(String shop, String code, String state, String hmac, Map<String, String> allParams) throws Exception {
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
        
        // Validate HMAC
        Map<String, String> hmacParams = new HashMap<>(allParams);
        hmacParams.remove("hmac");
        
        if (!validateHmac(hmacParams, hmac, clientSecret)) {
            log.warn("[ShopifyOAuth] HMAC validation failed. Throwing ForbiddenException.");
            throw new ForbiddenException("HMAC validation failed");
        }
        
        // Timestamp validation (check freshness)
        String timestamp = allParams.get("timestamp");
        if (timestamp != null) {
            try {
                long ts = Long.parseLong(timestamp);
                long currentTs = System.currentTimeMillis() / 1000L;
                if (Math.abs(currentTs - ts) > 900) { // 15 minutes
                    throw new ForbiddenException("Callback timestamp is too old or too far in the future.");
                }
            } catch (NumberFormatException e) {
                // Ignore if it's not a number
            }
        }
        
        // Exchange code for token
        Map<String, String> tokenData = exchangeCodeForToken(normalizedShop, code);
        String grantedScopes = tokenData.get("scope");
        
        if (grantedScopes == null || !grantedScopes.contains("write_inventory") || !grantedScopes.contains("write_products")) {
            log.warn("[ShopifyOAuth] Requested scopes were not fully granted by the merchant: {}", grantedScopes);
            throw new ForbiddenException("Missing required Shopify permissions");
        }
        
        // Save to Firestore for the tenant
        saveShopifyConnection(oauthState.getTenantId(), normalizedShop, tokenData);
    }
    
    private boolean validateHmac(Map<String, String> params, String hmac, String secret) {
        try {
            List<String> keys = new ArrayList<>(params.keySet());
            Collections.sort(keys);
            
            StringBuilder sb = new StringBuilder();
            for (String key : keys) {
                if (sb.length() > 0) sb.append("&");
                // Shopify requires escaping keys and values, but typical values are simple strings.
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
    
    private Map<String, String> exchangeCodeForToken(String shopDomain, String code) throws Exception {
        RestTemplate restTemplate = new RestTemplate();
        String url = "https://" + shopDomain + "/admin/oauth/access_token";
        
        Map<String, String> body = new HashMap<>();
        body.put("client_id", clientId);
        body.put("client_secret", clientSecret);
        body.put("code", code);
        body.put("expiring", "1");
        
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
            
            if (token != null) {
                Map<String, String> result = new HashMap<>();
                result.put("access_token", token);
                result.put("scope", scope != null ? scope : "");
                if (refreshToken != null) result.put("refresh_token", refreshToken);
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
        } else {
            String connectionId = "sc_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
            ShopifyConnection newConn = new ShopifyConnection(
                    connectionId,
                    tenantId,
                    store.getStoreId(),
                    shopDomain,
                    null, // shopifyStoreId unknown right now
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
        }
        log.info("[ShopifyOAuth] Saved Shopify connection for tenant: {}", tenantId);
    }
}
