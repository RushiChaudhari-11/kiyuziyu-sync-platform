package com.kiyuziyu.api.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.firebase.auth.FirebaseToken;
import com.kiyuziyu.api.dto.store.CreateStoreRequest;
import com.kiyuziyu.api.dto.store.StoreResponse;
import com.kiyuziyu.api.dto.tenant.CreateTenantRequest;
import com.kiyuziyu.api.dto.tenant.TenantResponse;
import com.kiyuziyu.api.exception.ConflictException;
import com.kiyuziyu.api.exception.GlobalExceptionHandler;
import com.kiyuziyu.api.exception.NotFoundException;
import com.kiyuziyu.api.exception.UnauthorizedException;
import com.kiyuziyu.api.security.AdminSecurityInterceptor;
import com.kiyuziyu.api.security.ApiKeyInterceptor;
import com.kiyuziyu.api.security.FirebaseAuthenticationService;
import com.kiyuziyu.api.service.StoreService;
import com.kiyuziyu.api.service.TenantService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(TenantController.class)
@Import(GlobalExceptionHandler.class)
@AutoConfigureMockMvc(addFilters = false)
class TenantControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private FirebaseAuthenticationService firebaseAuthService;

    @MockBean
    private TenantService tenantService;

    @MockBean
    private StoreService storeService;

    @MockBean
    private ApiKeyInterceptor apiKeyInterceptor;

    @MockBean
    private AdminSecurityInterceptor adminSecurityInterceptor;

    @Test
    void testCreateTenantWithoutAuthReturnsUnauthorized() throws Exception {
        when(firebaseAuthService.verifyToken(null))
                .thenThrow(new UnauthorizedException("Authorization header is required (format: 'Bearer <Firebase ID Token>')"));

        CreateTenantRequest request = new CreateTenantRequest("Kiyuziyu", "KIYUZIYU");

        mockMvc.perform(post("/api/v1/tenants")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    void testCreateTenantWithInvalidTokenReturnsUnauthorized() throws Exception {
        when(firebaseAuthService.verifyToken("Bearer invalid_token"))
                .thenThrow(new UnauthorizedException("Invalid or expired Firebase ID token"));

        CreateTenantRequest request = new CreateTenantRequest("Kiyuziyu", "KIYUZIYU");

        mockMvc.perform(post("/api/v1/tenants")
                        .header("Authorization", "Bearer invalid_token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    void testCreateTenantSuccessReturns201() throws Exception {
        FirebaseToken mockToken = Mockito.mock(FirebaseToken.class);
        when(firebaseAuthService.verifyToken("Bearer valid_token")).thenReturn(mockToken);

        CreateTenantRequest request = new CreateTenantRequest("Kiyuziyu", "KIYUZIYU");

        TenantResponse mockResponse = new TenantResponse();
        mockResponse.setTenantId("tenant_123");
        mockResponse.setName("Kiyuziyu");
        mockResponse.setCode("KIYUZIYU");
        mockResponse.setStatus("ACTIVE");
        mockResponse.setOwnerUserId("uid_abc");

        when(tenantService.createTenant(any(), any())).thenReturn(mockResponse);

        mockMvc.perform(post("/api/v1/tenants")
                        .header("Authorization", "Bearer valid_token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.tenantId").value("tenant_123"))
                .andExpect(jsonPath("$.data.name").value("Kiyuziyu"))
                .andExpect(jsonPath("$.data.code").value("KIYUZIYU"))
                .andExpect(jsonPath("$.data.status").value("ACTIVE"))
                .andExpect(jsonPath("$.data.ownerUserId").value("uid_abc"));
    }

    @Test
    void testCreateTenantSuccessWithTrailingSlashReturns201() throws Exception {
        FirebaseToken mockToken = Mockito.mock(FirebaseToken.class);
        when(firebaseAuthService.verifyToken("Bearer valid_token")).thenReturn(mockToken);

        CreateTenantRequest request = new CreateTenantRequest("Kiyuziyu", "KIYUZIYU");

        TenantResponse mockResponse = new TenantResponse();
        mockResponse.setTenantId("tenant_123");
        mockResponse.setName("Kiyuziyu");
        mockResponse.setCode("KIYUZIYU");
        mockResponse.setStatus("ACTIVE");
        mockResponse.setOwnerUserId("uid_abc");

        when(tenantService.createTenant(any(), any())).thenReturn(mockResponse);

        mockMvc.perform(post("/api/v1/tenants/")
                        .header("Authorization", "Bearer valid_token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.tenantId").value("tenant_123"));
    }

    @Test
    void testCreateTenantConflictReturns409() throws Exception {
        FirebaseToken mockToken = Mockito.mock(FirebaseToken.class);
        when(firebaseAuthService.verifyToken("Bearer valid_token")).thenReturn(mockToken);

        CreateTenantRequest request = new CreateTenantRequest("Kiyuziyu", "KIYUZIYU");

        when(tenantService.createTenant(any(), any()))
                .thenThrow(new ConflictException("Tenant code already exists: KIYUZIYU"));

        mockMvc.perform(post("/api/v1/tenants")
                        .header("Authorization", "Bearer valid_token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Tenant code already exists: KIYUZIYU"));
    }

    @Test
    void testGetCurrentTenantFoundReturns200() throws Exception {
        FirebaseToken mockToken = Mockito.mock(FirebaseToken.class);
        when(firebaseAuthService.verifyToken("Bearer valid_token")).thenReturn(mockToken);

        TenantResponse mockResponse = new TenantResponse();
        mockResponse.setTenantId("tenant_123");
        mockResponse.setName("Kiyuziyu");
        mockResponse.setCode("KIYUZIYU");
        mockResponse.setStatus("ACTIVE");
        mockResponse.setOwnerUserId("uid_abc");

        when(tenantService.getCurrentUserTenant(mockToken)).thenReturn(mockResponse);

        mockMvc.perform(get("/api/v1/tenants/me")
                        .header("Authorization", "Bearer valid_token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.tenantId").value("tenant_123"));
    }

    @Test
    void testGetCurrentTenantNotFoundReturns404() throws Exception {
        FirebaseToken mockToken = Mockito.mock(FirebaseToken.class);
        when(firebaseAuthService.verifyToken("Bearer valid_token")).thenReturn(mockToken);

        when(tenantService.getCurrentUserTenant(mockToken))
                .thenThrow(new NotFoundException("No tenant found for authenticated user"));

        mockMvc.perform(get("/api/v1/tenants/me")
                        .header("Authorization", "Bearer valid_token"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("No tenant found for authenticated user"));
    }

    @Test
    void testCreateStoreSuccessReturns201() throws Exception {
        FirebaseToken mockToken = Mockito.mock(FirebaseToken.class);
        when(firebaseAuthService.verifyToken("Bearer valid_token")).thenReturn(mockToken);

        CreateStoreRequest request = new CreateStoreRequest("Main Store", "MAIN", "GENERIC");

        StoreResponse mockResponse = new StoreResponse();
        mockResponse.setStoreId("store_abc");
        mockResponse.setTenantId("tenant_123");
        mockResponse.setName("Main Store");
        mockResponse.setCode("MAIN");
        mockResponse.setPlatform("GENERIC");
        mockResponse.setStatus("ACTIVE");

        when(storeService.createStore(any(), any())).thenReturn(mockResponse);

        mockMvc.perform(post("/api/v1/tenants/me/stores")
                        .header("Authorization", "Bearer valid_token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.storeId").value("store_abc"))
                .andExpect(jsonPath("$.data.tenantId").value("tenant_123"))
                .andExpect(jsonPath("$.data.code").value("MAIN"));
    }

    @Test
    void testGetStoresReturns200() throws Exception {
        FirebaseToken mockToken = Mockito.mock(FirebaseToken.class);
        when(firebaseAuthService.verifyToken("Bearer valid_token")).thenReturn(mockToken);

        StoreResponse s1 = new StoreResponse();
        s1.setStoreId("store_1");
        s1.setCode("STORE1");

        when(storeService.getStoresForCurrentTenant(mockToken)).thenReturn(List.of(s1));

        mockMvc.perform(get("/api/v1/tenants/me/stores")
                        .header("Authorization", "Bearer valid_token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].storeId").value("store_1"));
    }
}
