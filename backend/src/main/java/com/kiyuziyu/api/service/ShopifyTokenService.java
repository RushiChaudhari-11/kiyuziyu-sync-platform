package com.kiyuziyu.api.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.time.Instant;
import java.util.Collections;
import java.util.Map;

@Service
public class ShopifyTokenService {

    private static final Logger log = LoggerFactory.getLogger(ShopifyTokenService.class);

    @Value("${shopify.client-id:50616f42c3e0cfbb5ba9f29a2143acf6}")
    private String clientId;

    @Value("${shopify.client-secret:}")
    private String clientSecret;

    @Autowired
    private com.kiyuziyu.api.repository.ShopifyConnectionRepository shopifyConnectionRepository;

    @Autowired
    @org.springframework.context.annotation.Lazy
    private ShopifyOAuthService shopifyOAuthService;

    public ShopifyTokenService() {
    }

    /**
     * Gets a valid Shopify access token for the given domain from the database connection.
     * Checks if the token is expired or near expiry, and refreshes it if necessary.
     */
    public synchronized String getAccessToken(String shopDomain) {
        if (shopDomain == null || shopDomain.trim().isEmpty()) {
            throw new RuntimeException("Shop domain is required to fetch access token.");
        }

        com.kiyuziyu.api.model.ShopifyConnection conn = shopifyConnectionRepository.findByShopifyStoreDomain(shopDomain);
        if (conn == null) {
            throw new RuntimeException("No active Shopify connection found for domain: " + shopDomain);
        }

        if (!"CONNECTED".equals(conn.getStatus())) {
            throw new RuntimeException("Shopify connection for domain " + shopDomain + " is in status: " + conn.getStatus() + ". Re-authorization may be required.");
        }

        long currentTimeSeconds = Instant.now().getEpochSecond();
        
        // If we don't have an expiry timestamp:
        if (conn.getAccessTokenExpiresAt() == null || conn.getAccessTokenExpiresAt() == 0) {
            // If we have a refresh token, refresh immediately to acquire a compliant expiring offline token
            if (conn.getRefreshToken() != null && !conn.getRefreshToken().trim().isEmpty()) {
                log.info("[ShopifyTokenService] Token for {} has no expiry recorded but has refresh token. Refreshing for modern expiring token.", shopDomain);
                return refreshAccessToken(conn, shopDomain, currentTimeSeconds);
            }
            return conn.getAccessToken();
        }

        // Buffer of 300 seconds (5 minutes) before expiration
        if (currentTimeSeconds < conn.getAccessTokenExpiresAt() - 300) {
            return conn.getAccessToken();
        }

        log.info("[ShopifyTokenService] Access token for {} is expired or near expiry. Attempting to refresh.", shopDomain);
        return refreshAccessToken(conn, shopDomain, currentTimeSeconds);
    }

    /**
     * Force refresh the access token using the stored refresh token.
     */
    public synchronized String forceRefreshToken(String shopDomain) {
        if (shopDomain == null || shopDomain.trim().isEmpty()) {
            throw new RuntimeException("Shop domain is required to refresh access token.");
        }

        com.kiyuziyu.api.model.ShopifyConnection conn = shopifyConnectionRepository.findByShopifyStoreDomain(shopDomain);
        if (conn == null) {
            throw new RuntimeException("No active Shopify connection found for domain: " + shopDomain);
        }

        return refreshAccessToken(conn, shopDomain, Instant.now().getEpochSecond());
    }

    private String refreshAccessToken(com.kiyuziyu.api.model.ShopifyConnection conn, String shopDomain, long currentTimeSeconds) {
        if (conn.getRefreshToken() == null || conn.getRefreshToken().trim().isEmpty()) {
            conn.setStatus("UNAUTHORIZED");
            shopifyConnectionRepository.save(conn);
            throw new RuntimeException("Shopify connection for domain " + shopDomain + " has no refresh token. Re-authorization required.");
        }

        RestTemplate restTemplate = new RestTemplate();
        String url = "https://" + shopDomain + "/admin/oauth/access_token";
        
        String effectiveSecret = clientSecret;
        if (shopifyOAuthService != null) {
            String resolved = shopifyOAuthService.resolveClientSecret();
            if (resolved != null && !resolved.isEmpty()) {
                effectiveSecret = resolved;
            }
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));

        MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
        body.add("client_id", (clientId != null && !clientId.isEmpty()) ? clientId : "50616f42c3e0cfbb5ba9f29a2143acf6");
        body.add("client_secret", effectiveSecret);
        body.add("grant_type", "refresh_token");
        body.add("refresh_token", conn.getRefreshToken().trim());
        
        HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<>(body, headers);
        
        try {
            ResponseEntity<Map> response = restTemplate.postForEntity(url, request, Map.class);
            
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                String newToken = (String) response.getBody().get("access_token");
                String newRefreshToken = (String) response.getBody().get("refresh_token");
                Object expiresInObj = response.getBody().get("expires_in");
                Object refreshExpiresInObj = response.getBody().get("refresh_token_expires_in");
                
                if (newToken != null && !newToken.trim().isEmpty()) {
                    conn.setAccessToken(newToken.trim());
                    if (newRefreshToken != null && !newRefreshToken.trim().isEmpty()) {
                        conn.setRefreshToken(newRefreshToken.trim());
                    }
                    if (expiresInObj != null) {
                        conn.setAccessTokenExpiresAt(currentTimeSeconds + Long.parseLong(String.valueOf(expiresInObj)));
                    } else {
                        conn.setAccessTokenExpiresAt(currentTimeSeconds + 3600); // 1 hour default
                    }
                    if (refreshExpiresInObj != null) {
                        conn.setRefreshTokenExpiresAt(currentTimeSeconds + Long.parseLong(String.valueOf(refreshExpiresInObj)));
                    }
                    conn.setStatus("CONNECTED");
                    conn.setUpdatedAt(Instant.now().toString());
                    
                    shopifyConnectionRepository.save(conn);
                    log.info("[ShopifyTokenService] Successfully refreshed access token for domain: {}", shopDomain);
                    
                    return newToken.trim();
                }
            }
            throw new RuntimeException("Failed to refresh Shopify token. Response status: " + response.getStatusCode());
        } catch (org.springframework.web.client.HttpClientErrorException e) {
            log.error("[ShopifyTokenService] Refresh failed for {}: {}", shopDomain, e.getResponseBodyAsString());
            if (e.getStatusCode() == HttpStatus.BAD_REQUEST || e.getStatusCode() == HttpStatus.UNAUTHORIZED || e.getStatusCode() == HttpStatus.FORBIDDEN) {
                conn.setStatus("UNAUTHORIZED");
                shopifyConnectionRepository.save(conn);
            }
            throw new RuntimeException("Shopify refresh failed (" + e.getStatusCode() + "): " + e.getResponseBodyAsString(), e);
        } catch (Exception e) {
            log.error("[ShopifyTokenService] Unexpected error refreshing token for {}: {}", shopDomain, e.getMessage(), e);
            throw new RuntimeException("Failed to refresh Shopify token: " + e.getMessage(), e);
        }
    }
}

