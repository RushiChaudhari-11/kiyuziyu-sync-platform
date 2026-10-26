package com.kiyuziyu.api.controller;

import com.google.firebase.auth.FirebaseToken;
import com.kiyuziyu.api.model.ShopifyOAuthState;
import com.kiyuziyu.api.security.FirebaseAuthenticationService;
import com.kiyuziyu.api.service.ShopifyOAuthService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/shopify/oauth")
public class ShopifyOAuthController {

    private static final Logger log = LoggerFactory.getLogger(ShopifyOAuthController.class);

    @Value("${shopify.oauth.frontend-url:http://localhost:3000}")
    private String defaultFrontendUrl;

    @Autowired
    private FirebaseAuthenticationService firebaseAuthService;

    @Autowired
    private ShopifyOAuthService shopifyOAuthService;

    /**
     * GET /api/v1/shopify/oauth/start?shop={domain}&origin={origin}
     * Initiates Shopify OAuth flow and returns the Shopify authorize URL.
     */
    @GetMapping({"/start", "/start/"})
    public ResponseEntity<Map<String, Object>> startOAuth(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestParam("shop") String shopDomain,
            @RequestParam(value = "origin", required = false) String origin) {
        try {
            FirebaseToken token = firebaseAuthService.verifyToken(authHeader);
            String authUrl = shopifyOAuthService.startOAuth(token, shopDomain, origin);
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
        String baseOrigin = defaultFrontendUrl;
        try {
            String shop = allParams.get("shop");
            String code = allParams.get("code");
            String state = allParams.get("state");
            String hmac = allParams.get("hmac");
            
            ShopifyOAuthState oauthState = shopifyOAuthService.handleCallback(shop, code, state, hmac, allParams);
            if (oauthState != null && oauthState.getRedirectOrigin() != null && !oauthState.getRedirectOrigin().trim().isEmpty()) {
                baseOrigin = oauthState.getRedirectOrigin().trim();
            }
            if (baseOrigin.endsWith("/")) {
                baseOrigin = baseOrigin.substring(0, baseOrigin.length() - 1);
            }
            
            return ResponseEntity.status(HttpStatus.FOUND)
                    .location(URI.create(baseOrigin + "/tenant/dashboard?tab=shopify&shopify=connected"))
                    .build();
        } catch (Exception e) {
            log.error("[ShopifyOAuth] Callback failed: {}", e.getMessage(), e);
            if (baseOrigin.endsWith("/")) {
                baseOrigin = baseOrigin.substring(0, baseOrigin.length() - 1);
            }
            String errorMsg = URLEncoder.encode(e.getMessage() != null ? e.getMessage() : "Unknown error", StandardCharsets.UTF_8);
            return ResponseEntity.status(HttpStatus.FOUND)
                    .location(URI.create(baseOrigin + "/tenant/dashboard?tab=shopify&shopify=error&message=" + errorMsg))
                    .build();
        }
    }

    /**
     * GET /api/v1/shopify/oauth/verify
     * Executes a real authenticated GraphQL request to Shopify to verify active credentials.
     */
    @GetMapping({"/verify", "/verify/"})
    public ResponseEntity<Map<String, Object>> verifyConnection(
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        try {
            FirebaseToken token = firebaseAuthService.verifyToken(authHeader);
            Map<String, Object> shopData = shopifyOAuthService.verifyConnection(token);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("verified", true);
            response.put("data", shopData);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("[ShopifyOAuth] Verification failed: {}", e.getMessage());
            Map<String, Object> errorResp = new HashMap<>();
            errorResp.put("success", false);
            errorResp.put("verified", false);
            errorResp.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(errorResp);
        }
    }

    /**
     * POST /api/v1/shopify/oauth/configure-app
     * Stores the Shopify App client secret securely in Firestore for OAuth exchange.
     */
    @PostMapping({"/configure-app", "/configure-app/"})
    public ResponseEntity<Map<String, Object>> configureAppCredentials(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody Map<String, String> body) {
        try {
            firebaseAuthService.verifyToken(authHeader);
            String secret = body != null ? body.get("clientSecret") : null;
            if (secret == null || secret.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("success", false, "message", "clientSecret is required"));
            }
            shopifyOAuthService.saveAppCredentials(secret.trim());
            return ResponseEntity.ok(Map.of("success", true, "message", "Shopify App credentials saved successfully"));
        } catch (Exception e) {
            log.error("[ShopifyOAuth] Failed to configure app credentials: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("success", false, "message", e.getMessage()));
        }
    }
}
