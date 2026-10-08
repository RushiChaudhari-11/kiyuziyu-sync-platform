package com.kiyuziyu.api.controller;

import com.google.firebase.auth.FirebaseToken;
import com.kiyuziyu.api.dto.store.CreateStoreRequest;
import com.kiyuziyu.api.dto.store.StoreResponse;
import com.kiyuziyu.api.dto.tenant.CreateTenantRequest;
import com.kiyuziyu.api.dto.tenant.TenantResponse;
import com.kiyuziyu.api.security.FirebaseAuthenticationService;
import com.kiyuziyu.api.service.StoreService;
import com.kiyuziyu.api.service.TenantService;
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
@RequestMapping({"/api/v1/tenants", "/api/v1/tenants/"})
public class TenantController {

    private static final Logger log = LoggerFactory.getLogger(TenantController.class);

    @Autowired
    private FirebaseAuthenticationService firebaseAuthService;

    @Autowired
    private TenantService tenantService;

    @Autowired
    private StoreService storeService;

    /**
     * Create a new tenant.
     * The authenticated user will be set as ownerUserId and associated with this tenant.
     * Header: Authorization: Bearer <Firebase ID Token>
     */
    @PostMapping({"", "/"})
    public ResponseEntity<Map<String, Object>> createTenant(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody CreateTenantRequest request) throws ExecutionException, InterruptedException {
        FirebaseToken token = firebaseAuthService.verifyToken(authHeader);
        TenantResponse created = tenantService.createTenant(token, request);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", created);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * Get the tenant belonging to the authenticated user.
     * Header: Authorization: Bearer <Firebase ID Token>
     */
    @GetMapping({"/me", "/me/"})
    public ResponseEntity<Map<String, Object>> getCurrentTenant(
            @RequestHeader(value = "Authorization", required = false) String authHeader)
            throws ExecutionException, InterruptedException {
        FirebaseToken token = firebaseAuthService.verifyToken(authHeader);
        TenantResponse tenant = tenantService.getCurrentUserTenant(token);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", tenant);
        return ResponseEntity.ok(response);
    }

    /**
     * Create a new store inside the authenticated user's tenant.
     * Header: Authorization: Bearer <Firebase ID Token>
     */
    @PostMapping({"/me/stores", "/me/stores/"})
    public ResponseEntity<Map<String, Object>> createStore(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody CreateStoreRequest request) throws ExecutionException, InterruptedException {
        FirebaseToken token = firebaseAuthService.verifyToken(authHeader);
        StoreResponse created = storeService.createStore(token, request);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", created);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * Get all stores belonging to the authenticated user's tenant.
     * Header: Authorization: Bearer <Firebase ID Token>
     */
    @GetMapping({"/me/stores", "/me/stores/"})
    public ResponseEntity<Map<String, Object>> getStores(
            @RequestHeader(value = "Authorization", required = false) String authHeader)
            throws ExecutionException, InterruptedException {
        FirebaseToken token = firebaseAuthService.verifyToken(authHeader);
        List<StoreResponse> stores = storeService.getStoresForCurrentTenant(token);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", stores);
        return ResponseEntity.ok(response);
    }
}
