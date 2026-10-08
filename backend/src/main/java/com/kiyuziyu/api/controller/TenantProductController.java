package com.kiyuziyu.api.controller;

import com.google.firebase.auth.FirebaseToken;
import com.kiyuziyu.api.dto.PagedResult;
import com.kiyuziyu.api.dto.PaginatedResponse;
import com.kiyuziyu.api.dto.ProductResponse;
import com.kiyuziyu.api.dto.syncjob.CreateProductSyncJobRequest;
import com.kiyuziyu.api.dto.syncjob.CreateSyncJobAcceptedResponse;
import com.kiyuziyu.api.security.FirebaseAuthenticationService;
import com.kiyuziyu.api.service.TenantProductService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutionException;

@RestController
@RequestMapping({"/api/v1/tenants/me/products", "/api/v1/tenants/me/products/"})
public class TenantProductController {

    @Autowired
    private FirebaseAuthenticationService firebaseAuthService;

    @Autowired
    private TenantProductService tenantProductService;

    /**
     * GET /api/v1/tenants/me/products
     * Return products available to the authenticated tenant.
     */
    @GetMapping({"", "/"})
    public ResponseEntity<PaginatedResponse<ProductResponse>> getTenantProducts(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestParam(required = false) String collectionId,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int limit) throws ExecutionException, InterruptedException {
        FirebaseToken token = firebaseAuthService.verifyToken(authHeader);
        int offset = (page - 1) * limit;

        PagedResult<ProductResponse> result = tenantProductService.getTenantProducts(token, collectionId, search, limit, offset);

        return ResponseEntity.ok(new PaginatedResponse<>(true, result.getData(), (int) result.getTotalCount(), page, limit));
    }

    /**
     * GET /api/v1/tenants/me/products/collections
     * Return collections and subcollections.
     */
    @GetMapping({"/collections", "/collections/"})
    public ResponseEntity<Map<String, Object>> getCollections(
            @RequestHeader(value = "Authorization", required = false) String authHeader) throws ExecutionException, InterruptedException {
        FirebaseToken token = firebaseAuthService.verifyToken(authHeader);

        List<Map<String, Object>> collections = tenantProductService.getCollections();

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", collections);
        return ResponseEntity.ok(response);
    }

    /**
     * GET /api/v1/tenants/me/products/sync-status
     * Return current sync state using apiShopifyProductMappings and apiSyncJobs.
     */
    @GetMapping({"/sync-status", "/sync-status/"})
    public ResponseEntity<Map<String, Object>> getSyncStatus(
            @RequestHeader(value = "Authorization", required = false) String authHeader) throws ExecutionException, InterruptedException {
        FirebaseToken token = firebaseAuthService.verifyToken(authHeader);

        List<Map<String, Object>> statusList = tenantProductService.getSyncStatus(token);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", statusList);
        return ResponseEntity.ok(response);
    }

    /**
     * POST /api/v1/tenants/me/products/sync
     * Accept selected product IDs and trigger async sync.
     */
    @PostMapping({"/sync", "/sync/"})
    public ResponseEntity<Map<String, Object>> syncProducts(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody CreateProductSyncJobRequest request) throws ExecutionException, InterruptedException {
        FirebaseToken token = firebaseAuthService.verifyToken(authHeader);

        CreateSyncJobAcceptedResponse jobResponse = tenantProductService.syncProducts(token, request);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", jobResponse);
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(response);
    }
    @PostMapping({"/{productCode}/price", "/{productCode}/price/"})
    public ResponseEntity<Map<String, Object>> updateProductPrice(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable String productCode,
            @RequestBody Map<String, Object> body) throws ExecutionException, InterruptedException {
        FirebaseToken token = firebaseAuthService.verifyToken(authHeader);
        String tenantId = tenantProductService.resolveTenantId(token);

        Double sellingPrice = null;
        if (body.get("sellingPrice") != null) {
            sellingPrice = Double.parseDouble(body.get("sellingPrice").toString());
        }

        // Ideally call tenantProductService or apiClientService. For now, do it inline or via existing service if injected
        tenantProductService.updateProductPrice(tenantId, productCode, sellingPrice);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        return ResponseEntity.ok(response);
    }
}
