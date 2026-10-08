package com.kiyuziyu.api.controller;

import com.google.firebase.auth.FirebaseToken;
import com.kiyuziyu.api.dto.ownerproduct.OwnerProductResponse;
import com.kiyuziyu.api.dto.ownerproduct.SelectOwnerProductRequest;
import com.kiyuziyu.api.dto.ownerproduct.UpdateOwnerProductRequest;
import com.kiyuziyu.api.security.FirebaseAuthenticationService;
import com.kiyuziyu.api.service.OwnerProductService;
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
@RequestMapping({"/api/v1/tenants/me/stores/{storeId}/owner-products", "/api/v1/tenants/me/stores/{storeId}/owner-products/"})
public class OwnerProductController {

    private static final Logger log = LoggerFactory.getLogger(OwnerProductController.class);

    @Autowired
    private FirebaseAuthenticationService firebaseAuthService;

    @Autowired
    private OwnerProductService ownerProductService;

    /**
     * 1. SELECT PRODUCT
     * POST /api/v1/tenants/me/stores/{storeId}/owner-products
     * Header: Authorization: Bearer <Firebase ID Token>
     */
    @PostMapping({"", "/"})
    public ResponseEntity<Map<String, Object>> selectProduct(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable("storeId") String storeId,
            @RequestBody SelectOwnerProductRequest request) throws ExecutionException, InterruptedException {
        FirebaseToken token = firebaseAuthService.verifyToken(authHeader);
        OwnerProductResponse created = ownerProductService.selectProduct(token, storeId, request);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", created);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * 2. GET SELECTED PRODUCTS
     * GET /api/v1/tenants/me/stores/{storeId}/owner-products
     * Header: Authorization: Bearer <Firebase ID Token>
     */
    @GetMapping({"", "/"})
    public ResponseEntity<Map<String, Object>> getOwnerProducts(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable("storeId") String storeId) throws ExecutionException, InterruptedException {
        FirebaseToken token = firebaseAuthService.verifyToken(authHeader);
        List<OwnerProductResponse> list = ownerProductService.getOwnerProducts(token, storeId);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", list);
        return ResponseEntity.ok(response);
    }

    /**
     * 3. GET ONE SELECTED PRODUCT
     * GET /api/v1/tenants/me/stores/{storeId}/owner-products/{productId}
     * Header: Authorization: Bearer <Firebase ID Token>
     */
    @GetMapping({"/{productId}", "/{productId}/"})
    public ResponseEntity<Map<String, Object>> getOwnerProduct(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable("storeId") String storeId,
            @PathVariable("productId") String productId) throws ExecutionException, InterruptedException {
        FirebaseToken token = firebaseAuthService.verifyToken(authHeader);
        OwnerProductResponse product = ownerProductService.getOwnerProduct(token, storeId, productId);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", product);
        return ResponseEntity.ok(response);
    }

    /**
     * 4. ENABLE / DISABLE PRODUCT
     * PATCH /api/v1/tenants/me/stores/{storeId}/owner-products/{productId}
     * Header: Authorization: Bearer <Firebase ID Token>
     */
    @PatchMapping({"/{productId}", "/{productId}/"})
    public ResponseEntity<Map<String, Object>> updateOwnerProduct(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable("storeId") String storeId,
            @PathVariable("productId") String productId,
            @RequestBody UpdateOwnerProductRequest request) throws ExecutionException, InterruptedException {
        FirebaseToken token = firebaseAuthService.verifyToken(authHeader);
        OwnerProductResponse updated = ownerProductService.updateOwnerProduct(token, storeId, productId, request);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", updated);
        return ResponseEntity.ok(response);
    }

    /**
     * 5. REMOVE PRODUCT FROM OWNER SELECTION
     * DELETE /api/v1/tenants/me/stores/{storeId}/owner-products/{productId}
     * Header: Authorization: Bearer <Firebase ID Token>
     */
    @DeleteMapping({"/{productId}", "/{productId}/"})
    public ResponseEntity<Void> deleteOwnerProduct(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable("storeId") String storeId,
            @PathVariable("productId") String productId) throws ExecutionException, InterruptedException {
        FirebaseToken token = firebaseAuthService.verifyToken(authHeader);
        ownerProductService.deleteOwnerProduct(token, storeId, productId);
        return ResponseEntity.noContent().build();
    }
}
