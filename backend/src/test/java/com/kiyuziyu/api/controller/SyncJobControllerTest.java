package com.kiyuziyu.api.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.firebase.auth.FirebaseToken;
import com.kiyuziyu.api.dto.syncjob.CreateProductSyncJobRequest;
import com.kiyuziyu.api.dto.syncjob.CreateSyncJobAcceptedResponse;
import com.kiyuziyu.api.dto.syncjob.SyncJobResponse;
import com.kiyuziyu.api.exception.ConflictException;
import com.kiyuziyu.api.exception.ForbiddenException;
import com.kiyuziyu.api.exception.GlobalExceptionHandler;
import com.kiyuziyu.api.exception.NotFoundException;
import com.kiyuziyu.api.exception.UnauthorizedException;
import com.kiyuziyu.api.model.SyncJob;
import com.kiyuziyu.api.model.SyncJobStatus;
import com.kiyuziyu.api.model.SyncJobType;
import com.kiyuziyu.api.security.AdminSecurityInterceptor;
import com.kiyuziyu.api.security.ApiKeyInterceptor;
import com.kiyuziyu.api.security.FirebaseAuthenticationService;
import com.kiyuziyu.api.service.SyncJobService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Collections;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(SyncJobController.class)
@Import(GlobalExceptionHandler.class)
@AutoConfigureMockMvc(addFilters = false)
class SyncJobControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private FirebaseAuthenticationService firebaseAuthService;

    @MockBean
    private SyncJobService syncJobService;

    @MockBean
    private ApiKeyInterceptor apiKeyInterceptor;

    @MockBean
    private AdminSecurityInterceptor adminSecurityInterceptor;

    private static final String STORE_ID = "store_5fcd29b2b01c";
    private static final String BASE_URL = "/api/v1/tenants/me/stores/" + STORE_ID + "/sync-jobs";

    @Test
    void createProductSyncJob_success_returns202Accepted() throws Exception {
        FirebaseToken mockToken = Mockito.mock(FirebaseToken.class);
        when(firebaseAuthService.verifyToken("Bearer test-token")).thenReturn(mockToken);

        CreateSyncJobAcceptedResponse accepted = new CreateSyncJobAcceptedResponse("job_abc123", SyncJobStatus.QUEUED.name(), SyncJobType.PRODUCT_SYNC.name());
        when(syncJobService.createProductSyncJob(eq(mockToken), eq(STORE_ID), any(CreateProductSyncJobRequest.class)))
                .thenReturn(accepted);

        CreateProductSyncJobRequest request = new CreateProductSyncJobRequest(Collections.singletonList("prod_705"));

        mockMvc.perform(post(BASE_URL + "/product-sync")
                        .header("Authorization", "Bearer test-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.jobId").value("job_abc123"))
                .andExpect(jsonPath("$.data.status").value("QUEUED"))
                .andExpect(jsonPath("$.data.jobType").value("PRODUCT_SYNC"));
    }

    @Test
    void getJobStatus_success_returns200Ok() throws Exception {
        FirebaseToken mockToken = Mockito.mock(FirebaseToken.class);
        when(firebaseAuthService.verifyToken("Bearer test-token")).thenReturn(mockToken);

        SyncJob job = new SyncJob("job_abc123", "tenant_da7590066509", STORE_ID, "sc_123",
                SyncJobType.PRODUCT_SYNC.name(), SyncJobStatus.RUNNING.name(), Collections.singletonList("prod_705"),
                1, 0, 0, 0, "2026-09-23T00:01:00Z", null, null, "2026-09-23T00:00:00Z", "2026-09-23T00:01:00Z");
        SyncJobResponse jobResp = new SyncJobResponse(job);

        when(syncJobService.getJobStatus(mockToken, STORE_ID, "job_abc123")).thenReturn(jobResp);

        mockMvc.perform(get(BASE_URL + "/job_abc123")
                        .header("Authorization", "Bearer test-token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.jobId").value("job_abc123"))
                .andExpect(jsonPath("$.data.status").value("RUNNING"))
                .andExpect(jsonPath("$.data.totalItems").value(1));
    }

    @Test
    void listJobs_success_returns200Ok() throws Exception {
        FirebaseToken mockToken = Mockito.mock(FirebaseToken.class);
        when(firebaseAuthService.verifyToken("Bearer test-token")).thenReturn(mockToken);

        SyncJob job = new SyncJob("job_abc123", "tenant_da7590066509", STORE_ID, "sc_123",
                SyncJobType.PRODUCT_SYNC.name(), SyncJobStatus.COMPLETED.name(), Collections.singletonList("prod_705"),
                1, 1, 1, 0, "2026-09-23T00:01:00Z", "2026-09-23T00:02:00Z", null, "2026-09-23T00:00:00Z", "2026-09-23T00:02:00Z");
        SyncJobResponse jobResp = new SyncJobResponse(job);

        when(syncJobService.listJobsForStore(mockToken, STORE_ID)).thenReturn(Collections.singletonList(jobResp));

        mockMvc.perform(get(BASE_URL)
                        .header("Authorization", "Bearer test-token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].jobId").value("job_abc123"))
                .andExpect(jsonPath("$.data[0].status").value("COMPLETED"));
    }

    @Test
    void createProductSyncJob_duplicateJob_returns409Conflict() throws Exception {
        FirebaseToken mockToken = Mockito.mock(FirebaseToken.class);
        when(firebaseAuthService.verifyToken("Bearer test-token")).thenReturn(mockToken);

        when(syncJobService.createProductSyncJob(eq(mockToken), eq(STORE_ID), any(CreateProductSyncJobRequest.class)))
                .thenThrow(new ConflictException("An active sync job is already queued or running"));

        CreateProductSyncJobRequest request = new CreateProductSyncJobRequest(Collections.singletonList("prod_705"));

        mockMvc.perform(post(BASE_URL + "/product-sync")
                        .header("Authorization", "Bearer test-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("An active sync job is already queued or running"));
    }

    @Test
    void createProductSyncJob_missingStore_returns404NotFound() throws Exception {
        FirebaseToken mockToken = Mockito.mock(FirebaseToken.class);
        when(firebaseAuthService.verifyToken("Bearer test-token")).thenReturn(mockToken);

        when(syncJobService.createProductSyncJob(eq(mockToken), eq(STORE_ID), any(CreateProductSyncJobRequest.class)))
                .thenThrow(new NotFoundException("Store not found"));

        CreateProductSyncJobRequest request = new CreateProductSyncJobRequest(Collections.singletonList("prod_705"));

        mockMvc.perform(post(BASE_URL + "/product-sync")
                        .header("Authorization", "Bearer test-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Store not found"));
    }

    @Test
    void createProductSyncJob_crossTenant_returns403Forbidden() throws Exception {
        FirebaseToken mockToken = Mockito.mock(FirebaseToken.class);
        when(firebaseAuthService.verifyToken("Bearer test-token")).thenReturn(mockToken);

        when(syncJobService.createProductSyncJob(eq(mockToken), eq(STORE_ID), any(CreateProductSyncJobRequest.class)))
                .thenThrow(new ForbiddenException("Store does not belong to user's tenant"));

        CreateProductSyncJobRequest request = new CreateProductSyncJobRequest(Collections.singletonList("prod_705"));

        mockMvc.perform(post(BASE_URL + "/product-sync")
                        .header("Authorization", "Bearer test-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Store does not belong to user's tenant"));
    }

    @Test
    void missingToken_returns401Unauthorized() throws Exception {
        when(firebaseAuthService.verifyToken(null))
                .thenThrow(new UnauthorizedException("Missing or invalid Authorization header"));

        mockMvc.perform(get(BASE_URL))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Missing or invalid Authorization header"));
    }
}
