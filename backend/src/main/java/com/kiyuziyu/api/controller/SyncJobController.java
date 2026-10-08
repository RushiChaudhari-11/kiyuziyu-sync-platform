package com.kiyuziyu.api.controller;

import com.google.firebase.auth.FirebaseToken;
import com.kiyuziyu.api.dto.syncjob.CreateProductSyncJobRequest;
import com.kiyuziyu.api.dto.syncjob.CreateSyncJobAcceptedResponse;
import com.kiyuziyu.api.dto.syncjob.SyncJobResponse;
import com.kiyuziyu.api.security.FirebaseAuthenticationService;
import com.kiyuziyu.api.service.SyncJobService;
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
@RequestMapping({"/api/v1/tenants/me/stores/{storeId}/sync-jobs", "/api/v1/tenants/me/stores/{storeId}/sync-jobs/"})
public class SyncJobController {

    private static final Logger log = LoggerFactory.getLogger(SyncJobController.class);

    @Autowired
    private FirebaseAuthenticationService firebaseAuthService;

    @Autowired
    private SyncJobService syncJobService;

    /**
     * POST /api/v1/tenants/me/stores/{storeId}/sync-jobs/product-sync
     * Create product sync job and return 202 Accepted immediately.
     */
    @PostMapping({"/product-sync", "/product-sync/"})
    public ResponseEntity<Map<String, Object>> createProductSyncJob(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable("storeId") String storeId,
            @RequestBody CreateProductSyncJobRequest request) throws ExecutionException, InterruptedException {
        FirebaseToken token = firebaseAuthService.verifyToken(authHeader);
        CreateSyncJobAcceptedResponse responseData = syncJobService.createProductSyncJob(token, storeId, request);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", responseData);
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(response);
    }

    /**
     * GET /api/v1/tenants/me/stores/{storeId}/sync-jobs/{jobId}
     * Get details and current status of a sync job.
     */
    @GetMapping({"/{jobId}", "/{jobId}/"})
    public ResponseEntity<Map<String, Object>> getJobStatus(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable("storeId") String storeId,
            @PathVariable("jobId") String jobId) throws ExecutionException, InterruptedException {
        FirebaseToken token = firebaseAuthService.verifyToken(authHeader);
        SyncJobResponse jobResponse = syncJobService.getJobStatus(token, storeId, jobId);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", jobResponse);
        return ResponseEntity.ok(response);
    }

    /**
     * GET /api/v1/tenants/me/stores/{storeId}/sync-jobs
     * List all sync jobs for store.
     */
    @GetMapping({"", "/"})
    public ResponseEntity<Map<String, Object>> listJobs(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable("storeId") String storeId) throws ExecutionException, InterruptedException {
        FirebaseToken token = firebaseAuthService.verifyToken(authHeader);
        List<SyncJobResponse> jobs = syncJobService.listJobsForStore(token, storeId);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", jobs);
        return ResponseEntity.ok(response);
    }
}
