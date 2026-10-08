package com.kiyuziyu.api.controller;

import com.google.firebase.auth.FirebaseToken;
import com.kiyuziyu.api.dto.shopifyconnection.CreateShopifyConnectionRequest;
import com.kiyuziyu.api.dto.shopifyconnection.ShopifyConnectionResponse;
import com.kiyuziyu.api.dto.shopifyconnection.UpdateShopifyConnectionRequest;
import com.kiyuziyu.api.security.FirebaseAuthenticationService;
import com.kiyuziyu.api.service.ShopifyConnectionService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ExecutionException;

@RestController
public class ShopifyConnectionController {

    private static final Logger log = LoggerFactory.getLogger(ShopifyConnectionController.class);

    @Autowired
    private FirebaseAuthenticationService firebaseAuthService;

    @Autowired
    private ShopifyConnectionService shopifyConnectionService;

    /**
     * GET /api/v1/tenants/me/shopify-connection
     * Get Shopify connection for the current authenticated tenant.
     */
    @GetMapping({"/api/v1/tenants/me/shopify-connection", "/api/v1/tenants/me/shopify-connection/"})
    public ResponseEntity<Map<String, Object>> getTenantConnection(
            @RequestHeader(value = "Authorization", required = false) String authHeader)
            throws ExecutionException, InterruptedException {
        FirebaseToken token = firebaseAuthService.verifyToken(authHeader);
        ShopifyConnectionResponse connection = shopifyConnectionService.getTenantConnection(token);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", connection);
        return ResponseEntity.ok(response);
    }

    /**
     * POST /api/v1/tenants/me/shopify-connection
     * Connect a Shopify store for the current authenticated tenant.
     */
    @PostMapping({"/api/v1/tenants/me/shopify-connection", "/api/v1/tenants/me/shopify-connection/"})
    public ResponseEntity<Map<String, Object>> createTenantConnection(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody CreateShopifyConnectionRequest request) throws ExecutionException, InterruptedException {
        FirebaseToken token = firebaseAuthService.verifyToken(authHeader);
        ShopifyConnectionResponse created = shopifyConnectionService.createTenantConnection(token, request);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", created);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * DELETE /api/v1/tenants/me/shopify-connection
     * Disconnect Shopify store for the current authenticated tenant.
     */
    @DeleteMapping({"/api/v1/tenants/me/shopify-connection", "/api/v1/tenants/me/shopify-connection/"})
    public ResponseEntity<Map<String, Object>> deleteTenantConnection(
            @RequestHeader(value = "Authorization", required = false) String authHeader)
            throws ExecutionException, InterruptedException {
        FirebaseToken token = firebaseAuthService.verifyToken(authHeader);
        shopifyConnectionService.deleteTenantConnection(token);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Shopify store disconnected successfully");
        return ResponseEntity.ok(response);
    }

    /**
     * POST /api/v1/tenants/me/stores/{storeId}/shopify-connection
     * Create / connect Shopify store for a specific store.
     */
    @PostMapping({"/api/v1/tenants/me/stores/{storeId}/shopify-connection", "/api/v1/tenants/me/stores/{storeId}/shopify-connection/"})
    public ResponseEntity<Map<String, Object>> createConnection(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable("storeId") String storeId,
            @RequestBody CreateShopifyConnectionRequest request) throws ExecutionException, InterruptedException {
        FirebaseToken token = firebaseAuthService.verifyToken(authHeader);
        ShopifyConnectionResponse created = shopifyConnectionService.createConnection(token, storeId, request);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", created);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * GET /api/v1/tenants/me/stores/{storeId}/shopify-connection
     * Get current Shopify connection for the store.
     */
    @GetMapping({"/api/v1/tenants/me/stores/{storeId}/shopify-connection", "/api/v1/tenants/me/stores/{storeId}/shopify-connection/"})
    public ResponseEntity<Map<String, Object>> getConnection(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable("storeId") String storeId) throws ExecutionException, InterruptedException {
        FirebaseToken token = firebaseAuthService.verifyToken(authHeader);
        ShopifyConnectionResponse connection = shopifyConnectionService.getConnection(token, storeId);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", connection);
        return ResponseEntity.ok(response);
    }

    /**
     * PATCH /api/v1/tenants/me/stores/{storeId}/shopify-connection
     * Update connection metadata / status.
     */
    @PatchMapping({"/api/v1/tenants/me/stores/{storeId}/shopify-connection", "/api/v1/tenants/me/stores/{storeId}/shopify-connection/"})
    public ResponseEntity<Map<String, Object>> updateConnection(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable("storeId") String storeId,
            @RequestBody UpdateShopifyConnectionRequest request) throws ExecutionException, InterruptedException {
        FirebaseToken token = firebaseAuthService.verifyToken(authHeader);
        ShopifyConnectionResponse updated = shopifyConnectionService.updateConnection(token, storeId, request);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", updated);
        return ResponseEntity.ok(response);
    }

    /**
     * DELETE /api/v1/tenants/me/stores/{storeId}/shopify-connection
     * Disconnect / delete the Shopify connection.
     */
    @DeleteMapping({"/api/v1/tenants/me/stores/{storeId}/shopify-connection", "/api/v1/tenants/me/stores/{storeId}/shopify-connection/"})
    public ResponseEntity<Void> deleteConnection(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable("storeId") String storeId) throws ExecutionException, InterruptedException {
        FirebaseToken token = firebaseAuthService.verifyToken(authHeader);
        shopifyConnectionService.deleteConnection(token, storeId);
        return ResponseEntity.noContent().build();
    }
}

