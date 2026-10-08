package com.kiyuziyu.api.controller;

import com.google.firebase.auth.FirebaseToken;
import com.kiyuziyu.api.security.FirebaseAuthenticationService;
import com.kiyuziyu.api.service.ShopifyOAuthService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.Map;
import java.util.concurrent.ExecutionException;

@RestController
@RequestMapping("/api/v1/shopify/oauth")
public class ShopifyOAuthController {

    private static final Logger log = LoggerFactory.getLogger(ShopifyOAuthController.class);

    @Autowired
    private FirebaseAuthenticationService firebaseAuthService;

    @Autowired
    private ShopifyOAuthService shopifyOAuthService;

    @GetMapping({"/start", "/start/"})
    public ResponseEntity<Map<String, Object>> startOAuth(
            @RequestHeader("Authorization") String authHeader,
            @RequestParam("shop") String shopDomain) {
        try {
            FirebaseToken token = firebaseAuthService.verifyToken(authHeader);
            String authUrl = shopifyOAuthService.startOAuth(token, shopDomain);
            return ResponseEntity.ok(Map.of("success", true, "authUrl", authUrl));
        } catch (Exception e) {
            log.error("[ShopifyOAuth] Failed to start OAuth: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * GET /api/v1/shopify/oauth/callback
     * Shopify redirects here after the merchant approves the app.
     */
    @GetMapping({"/callback", "/callback/"})
    public ResponseEntity<Void> oauthCallback(@RequestParam Map<String, String> allParams) {
        try {
            String shop = allParams.get("shop");
            String code = allParams.get("code");
            String state = allParams.get("state");
            String hmac = allParams.get("hmac");
            
            shopifyOAuthService.handleCallback(shop, code, state, hmac, allParams);
            return ResponseEntity.status(HttpStatus.FOUND)
                    .location(URI.create("http://localhost:3000/tenant/dashboard?tab=shopify&shopify=connected"))
                    .build();
        } catch (Exception e) {
            log.error("[ShopifyOAuth] Callback failed: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.FOUND)
                    .location(URI.create("http://localhost:3000/tenant/dashboard?tab=shopify&shopify=error"))
                    .build();
        }
    }
}
