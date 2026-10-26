package com.kiyuziyu.api.controller;

import com.google.firebase.auth.FirebaseToken;
import com.kiyuziyu.api.dto.report.TenantAnalysisReportResponse;
import com.kiyuziyu.api.security.FirebaseAuthenticationService;
import com.kiyuziyu.api.service.TenantAnalysisService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
public class TenantAnalysisController {

    private static final Logger log = LoggerFactory.getLogger(TenantAnalysisController.class);

    @Autowired
    private FirebaseAuthenticationService firebaseAuthService;

    @Autowired
    private TenantAnalysisService tenantAnalysisService;

    /**
     * GET /api/v1/tenants/me/reports/analysis
     * Provides comprehensive analysis reports with tenant isolation:
     * - Payment & Sales Reports
     * - Daily Amount Report
     * - Admin Payable Report
     * - Admin Transaction Report
     * - Activity Logs
     */
    @GetMapping({"/api/v1/tenants/me/reports/analysis", "/api/v1/tenants/me/reports/analysis/"})
    public ResponseEntity<Map<String, Object>> getTenantAnalysisReports(
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        FirebaseToken token = firebaseAuthService.verifyToken(authHeader);
        TenantAnalysisReportResponse report = tenantAnalysisService.getAnalysisReport(token);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", report);
        return ResponseEntity.ok(response);
    }
}
