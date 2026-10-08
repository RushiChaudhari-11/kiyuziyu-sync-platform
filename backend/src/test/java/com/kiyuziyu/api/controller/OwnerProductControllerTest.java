package com.kiyuziyu.api.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.firebase.auth.FirebaseToken;
import com.kiyuziyu.api.dto.ownerproduct.OwnerProductResponse;
import com.kiyuziyu.api.dto.ownerproduct.SelectOwnerProductRequest;
import com.kiyuziyu.api.dto.ownerproduct.UpdateOwnerProductRequest;
import com.kiyuziyu.api.exception.ConflictException;
import com.kiyuziyu.api.exception.ForbiddenException;
import com.kiyuziyu.api.exception.GlobalExceptionHandler;
import com.kiyuziyu.api.exception.NotFoundException;
import com.kiyuziyu.api.exception.UnauthorizedException;
import com.kiyuziyu.api.security.AdminSecurityInterceptor;
import com.kiyuziyu.api.security.ApiKeyInterceptor;
import com.kiyuziyu.api.security.FirebaseAuthenticationService;
import com.kiyuziyu.api.service.OwnerProductService;
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
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(OwnerProductController.class)
@Import(GlobalExceptionHandler.class)
@AutoConfigureMockMvc(addFilters = false)
class OwnerProductControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private FirebaseAuthenticationService firebaseAuthService;

    @MockBean
    private OwnerProductService ownerProductService;

    @MockBean
    private ApiKeyInterceptor apiKeyInterceptor;

    @MockBean
    private AdminSecurityInterceptor adminSecurityInterceptor;

    // 1. Missing Bearer token → 401
    @Test
    void testSelectProductMissingBearerTokenReturns401() throws Exception {
        when(firebaseAuthService.verifyToken(null))
                .thenThrow(new UnauthorizedException("Authorization header is required (format: 'Bearer <Firebase ID Token>')"));

        SelectOwnerProductRequest request = new SelectOwnerProductRequest("swCyEYDiK3gLJCQNC27W");

        mockMvc.perform(post("/api/v1/tenants/me/stores/store_123/owner-products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false));
    }

    // 2. Invalid Firebase token → 401
    @Test
    void testSelectProductInvalidFirebaseTokenReturns401() throws Exception {
        when(firebaseAuthService.verifyToken("Bearer invalid_token"))
                .thenThrow(new UnauthorizedException("Invalid or expired Firebase ID token"));

        SelectOwnerProductRequest request = new SelectOwnerProductRequest("swCyEYDiK3gLJCQNC27W");

        mockMvc.perform(post("/api/v1/tenants/me/stores/store_123/owner-products")
                        .header("Authorization", "Bearer invalid_token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false));
    }

    // 4. Store not belonging to user's tenant → 403
    @Test
    void testStoreNotBelongingToTenantReturns403() throws Exception {
        FirebaseToken mockToken = Mockito.mock(FirebaseToken.class);
        when(firebaseAuthService.verifyToken("Bearer valid_token")).thenReturn(mockToken);

        when(ownerProductService.selectProduct(any(), eq("store_cross_tenant"), any()))
                .thenThrow(new ForbiddenException("Store does not belong to user's tenant"));

        SelectOwnerProductRequest request = new SelectOwnerProductRequest("swCyEYDiK3gLJCQNC27W");

        mockMvc.perform(post("/api/v1/tenants/me/stores/store_cross_tenant/owner-products")
                        .header("Authorization", "Bearer valid_token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Store does not belong to user's tenant"));
    }

    // 5. Master product does not exist → 404
    @Test
    void testMasterProductNotFoundReturns404() throws Exception {
        FirebaseToken mockToken = Mockito.mock(FirebaseToken.class);
        when(firebaseAuthService.verifyToken("Bearer valid_token")).thenReturn(mockToken);

        when(ownerProductService.selectProduct(any(), eq("store_123"), any()))
                .thenThrow(new NotFoundException("Master product not found: unknown_id"));

        SelectOwnerProductRequest request = new SelectOwnerProductRequest("unknown_id");

        mockMvc.perform(post("/api/v1/tenants/me/stores/store_123/owner-products")
                        .header("Authorization", "Bearer valid_token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Master product not found: unknown_id"));
    }

    // 6. Valid product selection → 201
    @Test
    void testSelectProductSuccessReturns201() throws Exception {
        FirebaseToken mockToken = Mockito.mock(FirebaseToken.class);
        when(firebaseAuthService.verifyToken("Bearer valid_token")).thenReturn(mockToken);

        OwnerProductResponse mockResponse = new OwnerProductResponse(
                "sel_abc123",
                "tenant_da7590066509",
                "store_5fcd29b2b01c",
                "swCyEYDiK3gLJCQNC27W",
                "524",
                "Kiyu ziyu 1240 kada watch",
                "https://example.com/watch.jpg",
                true,
                "2026-09-22T00:00:00Z",
                "2026-09-22T00:00:00Z"
        );

        when(ownerProductService.selectProduct(any(), eq("store_5fcd29b2b01c"), any()))
                .thenReturn(mockResponse);

        SelectOwnerProductRequest request = new SelectOwnerProductRequest("swCyEYDiK3gLJCQNC27W");

        mockMvc.perform(post("/api/v1/tenants/me/stores/store_5fcd29b2b01c/owner-products")
                        .header("Authorization", "Bearer valid_token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.selectionId").value("sel_abc123"))
                .andExpect(jsonPath("$.data.tenantId").value("tenant_da7590066509"))
                .andExpect(jsonPath("$.data.storeId").value("store_5fcd29b2b01c"))
                .andExpect(jsonPath("$.data.productId").value("swCyEYDiK3gLJCQNC27W"))
                .andExpect(jsonPath("$.data.productCode").value("524"))
                .andExpect(jsonPath("$.data.productName").value("Kiyu ziyu 1240 kada watch"))
                .andExpect(jsonPath("$.data.image").value("https://example.com/watch.jpg"))
                .andExpect(jsonPath("$.data.enabled").value(true));
    }

    // 9. Duplicate selection → 409
    @Test
    void testDuplicateSelectionReturns409() throws Exception {
        FirebaseToken mockToken = Mockito.mock(FirebaseToken.class);
        when(firebaseAuthService.verifyToken("Bearer valid_token")).thenReturn(mockToken);

        when(ownerProductService.selectProduct(any(), eq("store_5fcd29b2b01c"), any()))
                .thenThrow(new ConflictException("Product already selected for this store: swCyEYDiK3gLJCQNC27W"));

        SelectOwnerProductRequest request = new SelectOwnerProductRequest("swCyEYDiK3gLJCQNC27W");

        mockMvc.perform(post("/api/v1/tenants/me/stores/store_5fcd29b2b01c/owner-products")
                        .header("Authorization", "Bearer valid_token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Product already selected for this store: swCyEYDiK3gLJCQNC27W"));
    }

    // 10. GET selected products → 200
    @Test
    void testGetOwnerProductsReturns200() throws Exception {
        FirebaseToken mockToken = Mockito.mock(FirebaseToken.class);
        when(firebaseAuthService.verifyToken("Bearer valid_token")).thenReturn(mockToken);

        OwnerProductResponse mockResponse = new OwnerProductResponse(
                "sel_abc123",
                "tenant_da7590066509",
                "store_5fcd29b2b01c",
                "swCyEYDiK3gLJCQNC27W",
                "524",
                "Kiyu ziyu 1240 kada watch",
                "https://example.com/watch.jpg",
                true,
                "2026-09-22T00:00:00Z",
                "2026-09-22T00:00:00Z"
        );

        when(ownerProductService.getOwnerProducts(any(), eq("store_5fcd29b2b01c")))
                .thenReturn(Collections.singletonList(mockResponse));

        mockMvc.perform(get("/api/v1/tenants/me/stores/store_5fcd29b2b01c/owner-products")
                        .header("Authorization", "Bearer valid_token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].selectionId").value("sel_abc123"))
                .andExpect(jsonPath("$.data[0].productId").value("swCyEYDiK3gLJCQNC27W"))
                .andExpect(jsonPath("$.data[0].productCode").value("524"));
    }

    // 11. GET one selected product → 200
    @Test
    void testGetOneOwnerProductReturns200() throws Exception {
        FirebaseToken mockToken = Mockito.mock(FirebaseToken.class);
        when(firebaseAuthService.verifyToken("Bearer valid_token")).thenReturn(mockToken);

        OwnerProductResponse mockResponse = new OwnerProductResponse(
                "sel_abc123",
                "tenant_da7590066509",
                "store_5fcd29b2b01c",
                "swCyEYDiK3gLJCQNC27W",
                "524",
                "Kiyu ziyu 1240 kada watch",
                "https://example.com/watch.jpg",
                true,
                "2026-09-22T00:00:00Z",
                "2026-09-22T00:00:00Z"
        );

        when(ownerProductService.getOwnerProduct(any(), eq("store_5fcd29b2b01c"), eq("swCyEYDiK3gLJCQNC27W")))
                .thenReturn(mockResponse);

        mockMvc.perform(get("/api/v1/tenants/me/stores/store_5fcd29b2b01c/owner-products/swCyEYDiK3gLJCQNC27W")
                        .header("Authorization", "Bearer valid_token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.productId").value("swCyEYDiK3gLJCQNC27W"));
    }

    // 12. Enable/disable → 200
    @Test
    void testUpdateOwnerProductReturns200() throws Exception {
        FirebaseToken mockToken = Mockito.mock(FirebaseToken.class);
        when(firebaseAuthService.verifyToken("Bearer valid_token")).thenReturn(mockToken);

        OwnerProductResponse mockResponse = new OwnerProductResponse(
                "sel_abc123",
                "tenant_da7590066509",
                "store_5fcd29b2b01c",
                "swCyEYDiK3gLJCQNC27W",
                "524",
                "Kiyu ziyu 1240 kada watch",
                "https://example.com/watch.jpg",
                false,
                "2026-09-22T00:00:00Z",
                "2026-09-22T00:05:00Z"
        );

        when(ownerProductService.updateOwnerProduct(any(), eq("store_5fcd29b2b01c"), eq("swCyEYDiK3gLJCQNC27W"), any()))
                .thenReturn(mockResponse);

        UpdateOwnerProductRequest request = new UpdateOwnerProductRequest(false);

        mockMvc.perform(patch("/api/v1/tenants/me/stores/store_5fcd29b2b01c/owner-products/swCyEYDiK3gLJCQNC27W")
                        .header("Authorization", "Bearer valid_token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.enabled").value(false));
    }

    // 13. Delete selection → 204
    @Test
    void testDeleteOwnerProductReturns204() throws Exception {
        FirebaseToken mockToken = Mockito.mock(FirebaseToken.class);
        when(firebaseAuthService.verifyToken("Bearer valid_token")).thenReturn(mockToken);

        doNothing().when(ownerProductService).deleteOwnerProduct(any(), eq("store_5fcd29b2b01c"), eq("swCyEYDiK3gLJCQNC27W"));

        mockMvc.perform(delete("/api/v1/tenants/me/stores/store_5fcd29b2b01c/owner-products/swCyEYDiK3gLJCQNC27W")
                        .header("Authorization", "Bearer valid_token"))
                .andExpect(status().isNoContent());
    }
}
