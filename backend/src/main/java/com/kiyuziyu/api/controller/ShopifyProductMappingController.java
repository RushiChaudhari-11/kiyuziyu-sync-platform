package com.kiyuziyu.api.controller;

import com.google.firebase.auth.FirebaseToken;
import com.kiyuziyu.api.dto.shopifymapping.CreateShopifyProductMappingRequest;
import com.kiyuziyu.api.dto.shopifymapping.ShopifyProductMappingResponse;
import com.kiyuziyu.api.dto.shopifymapping.UpdateShopifyProductMappingRequest;
import com.kiyuziyu.api.security.FirebaseAuthenticationService;
import com.kiyuziyu.api.service.ShopifyProductMappingService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutionException;

@RestController
@RequestMapping({"/api/v1/tenants/me/stores/{storeId}/shopify-product-mappings", "/api/v1/tenants/me/stores/{storeId}/shopify-product-mappings/"})
public class ShopifyProductMappingController {

    private static final Logger log = LoggerFactory.getLogger(ShopifyProductMappingController.class);

    @Autowired
    private FirebaseAuthenticationService firebaseAuthService;

    @Autowired
    private ShopifyProductMappingService shopifyProductMappingService;

    /**
     * POST /api/v1/tenants/me/stores/{storeId}/shopify-product-mappings
     * Create a mapping between a selected master product and a Shopify product.
     */
    @PostMapping({"", "/"})
    public ResponseEntity<Map<String, Object>> createMapping(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable("storeId") String storeId,
            @RequestBody CreateShopifyProductMappingRequest request) throws ExecutionException, InterruptedException {
        FirebaseToken token = firebaseAuthService.verifyToken(authHeader);
        ShopifyProductMappingResponse created = shopifyProductMappingService.createMapping(token, storeId, request);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", created);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * GET /api/v1/tenants/me/stores/{storeId}/shopify-product-mappings
     * Get all mappings for the store.
     */
    @GetMapping({"", "/"})
    public ResponseEntity<Map<String, Object>> getAllMappings(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable("storeId") String storeId) throws ExecutionException, InterruptedException {
        FirebaseToken token = firebaseAuthService.verifyToken(authHeader);
        List<ShopifyProductMappingResponse> mappings = shopifyProductMappingService.getAllMappings(token, storeId);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", mappings);
        return ResponseEntity.ok(response);
    }

    /**
     * GET /api/v1/tenants/me/stores/{storeId}/shopify-product-mappings/{productId}
     * Get single mapping for a product.
     */
    @GetMapping({"/{productId}", "/{productId}/"})
    public ResponseEntity<Map<String, Object>> getSingleMapping(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable("storeId") String storeId,
            @PathVariable("productId") String productId) throws ExecutionException, InterruptedException {
        FirebaseToken token = firebaseAuthService.verifyToken(authHeader);
        ShopifyProductMappingResponse mapping = shopifyProductMappingService.getSingleMapping(token, storeId, productId);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", mapping);
        return ResponseEntity.ok(response);
    }

    /**
     * PATCH /api/v1/tenants/me/stores/{storeId}/shopify-product-mappings/{productId}
     * Update mapping details.
     */
    @PatchMapping({"/{productId}", "/{productId}/"})
    public ResponseEntity<Map<String, Object>> updateMapping(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable("storeId") String storeId,
            @PathVariable("productId") String productId,
            @RequestBody UpdateShopifyProductMappingRequest request) throws ExecutionException, InterruptedException {
        FirebaseToken token = firebaseAuthService.verifyToken(authHeader);
        ShopifyProductMappingResponse updated = shopifyProductMappingService.updateMapping(token, storeId, productId, request);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", updated);
        return ResponseEntity.ok(response);
    }

    /**
     * DELETE /api/v1/tenants/me/stores/{storeId}/shopify-product-mappings/{productId}
     * Delete mapping record.
     */
    @DeleteMapping({"/{productId}", "/{productId}/"})
    public ResponseEntity<Void> deleteMapping(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable("storeId") String storeId,
            @PathVariable("productId") String productId) throws ExecutionException, InterruptedException {
        FirebaseToken token = firebaseAuthService.verifyToken(authHeader);
        shopifyProductMappingService.deleteMapping(token, storeId, productId);
        return ResponseEntity.noContent().build();
    }
}
