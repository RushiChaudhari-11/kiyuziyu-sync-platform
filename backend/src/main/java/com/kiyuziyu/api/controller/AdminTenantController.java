package com.kiyuziyu.api.controller;

import com.google.firebase.auth.FirebaseToken;
import com.kiyuziyu.api.dto.admin.AdminCreateTenantRequest;
import com.kiyuziyu.api.dto.admin.AdminCreateTenantResponseData;
import com.kiyuziyu.api.dto.admin.AdminTenantListItem;
import com.kiyuziyu.api.security.FirebaseAuthenticationService;
import com.kiyuziyu.api.service.AdminTenantService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutionException;

@RestController
@RequestMapping({"/api/v1/admin/tenants", "/api/v1/admin/tenants/"})
public class AdminTenantController {

    @Autowired
    private FirebaseAuthenticationService firebaseAuthService;

    @Autowired
    private AdminTenantService adminTenantService;

    /**
     * Create a new tenant (Super Admin only).
     * Header: Authorization: Bearer <Firebase ID Token>
     */
    @PostMapping({"", "/"})
    public ResponseEntity<Map<String, Object>> createTenant(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody AdminCreateTenantRequest request) throws ExecutionException, InterruptedException {
        FirebaseToken token = firebaseAuthService.verifyToken(authHeader);
        AdminCreateTenantResponseData data = adminTenantService.createTenant(token, request);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Tenant created successfully");
        response.put("data", data);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * Get list of all tenants (Super Admin only).
     * Header: Authorization: Bearer <Firebase ID Token>
     */
    @GetMapping({"", "/"})
    public ResponseEntity<Map<String, Object>> listTenants(
            @RequestHeader(value = "Authorization", required = false) String authHeader)
            throws ExecutionException, InterruptedException {
        FirebaseToken token = firebaseAuthService.verifyToken(authHeader);
        List<AdminTenantListItem> tenants = adminTenantService.listTenants(token);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("totalCount", tenants.size());
        response.put("data", tenants);
        return ResponseEntity.ok(response);
    }
}
