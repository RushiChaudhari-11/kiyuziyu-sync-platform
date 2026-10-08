package com.kiyuziyu.api.service;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class ShopifyTokenService {

    private static final Logger log = LoggerFactory.getLogger(ShopifyTokenService.class);

    @Value("${shopify.client-id:}")
    private String clientId;

    @Value("${shopify.client-secret:}")
    private String clientSecret;

    @Autowired
    private com.kiyuziyu.api.repository.ShopifyConnectionRepository shopifyConnectionRepository;

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
        
        // If we don't have an expiry, assume it's a permanent token from an older flow
        if (conn.getAccessTokenExpiresAt() == null || conn.getAccessTokenExpiresAt() == 0) {
            return conn.getAccessToken();
        }

        // Buffer of 300 seconds (5 minutes)
        if (currentTimeSeconds < conn.getAccessTokenExpiresAt() - 300) {
            return conn.getAccessToken();
        }

        log.info("[ShopifyTokenService] Access token for {} is expired or near expiry. Attempting to refresh.", shopDomain);
        
        if (conn.getRefreshToken() == null || conn.getRefreshToken().isEmpty()) {
            conn.setStatus("UNAUTHORIZED");
            shopifyConnectionRepository.save(conn);
            throw new RuntimeException("Shopify connection for domain " + shopDomain + " has expired and has no refresh token. Re-authorization required.");
        }

        // Perform the refresh
        RestTemplate restTemplate = new RestTemplate();
        String url = "https://" + shopDomain + "/admin/oauth/access_token";
        
        Map<String, String> body = new java.util.HashMap<>();
        body.put("client_id", clientId);
        body.put("client_secret", clientSecret);
        body.put("grant_type", "refresh_token");
        body.put("refresh_token", conn.getRefreshToken());
        
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        
        HttpEntity<Map<String, String>> request = new HttpEntity<>(body, headers);
        
        try {
            ResponseEntity<Map> response = restTemplate.postForEntity(url, request, Map.class);
            
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                String newToken = (String) response.getBody().get("access_token");
                String newRefreshToken = (String) response.getBody().get("refresh_token");
                Object expiresInObj = response.getBody().get("expires_in");
                Object refreshExpiresInObj = response.getBody().get("refresh_token_expires_in");
                
                if (newToken != null) {
                    conn.setAccessToken(newToken);
                    if (newRefreshToken != null) {
                        conn.setRefreshToken(newRefreshToken);
                    }
                    if (expiresInObj != null) {
                        conn.setAccessTokenExpiresAt(currentTimeSeconds + Long.parseLong(String.valueOf(expiresInObj)));
                    }
                    if (refreshExpiresInObj != null) {
                        conn.setRefreshTokenExpiresAt(currentTimeSeconds + Long.parseLong(String.valueOf(refreshExpiresInObj)));
                    }
                    conn.setUpdatedAt(Instant.now().toString());
                    
                    shopifyConnectionRepository.save(conn);
                    log.info("[ShopifyTokenService] Successfully refreshed access token for domain: {}", shopDomain);
                    
                    return newToken;
                }
            }
            throw new RuntimeException("Failed to refresh Shopify token. Response status: " + response.getStatusCode());
        } catch (org.springframework.web.client.HttpClientErrorException e) {
            log.error("[ShopifyTokenService] Refresh failed for {}: {}", shopDomain, e.getResponseBodyAsString());
            if (e.getStatusCode() == HttpStatus.BAD_REQUEST || e.getStatusCode() == HttpStatus.UNAUTHORIZED || e.getStatusCode() == HttpStatus.FORBIDDEN) {
                conn.setStatus("UNAUTHORIZED");
                shopifyConnectionRepository.save(conn);
            }
            throw new RuntimeException("Shopify refresh failed. Re-authorization may be required.", e);
        } catch (Exception e) {
            log.error("[ShopifyTokenService] Unexpected error refreshing token for {}: {}", shopDomain, e.getMessage(), e);
            throw new RuntimeException("Failed to refresh Shopify token due to network/server error.", e);
        }
    }
}
