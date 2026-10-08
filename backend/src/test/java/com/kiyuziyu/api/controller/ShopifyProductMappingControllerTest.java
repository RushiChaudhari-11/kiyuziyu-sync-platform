package com.kiyuziyu.api.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.firebase.auth.FirebaseToken;
import com.kiyuziyu.api.dto.shopifymapping.CreateShopifyProductMappingRequest;
import com.kiyuziyu.api.dto.shopifymapping.ShopifyProductMappingResponse;
import com.kiyuziyu.api.dto.shopifymapping.UpdateShopifyProductMappingRequest;
import com.kiyuziyu.api.exception.ConflictException;
import com.kiyuziyu.api.exception.ForbiddenException;
import com.kiyuziyu.api.exception.GlobalExceptionHandler;
import com.kiyuziyu.api.exception.NotFoundException;
import com.kiyuziyu.api.exception.UnauthorizedException;
import com.kiyuziyu.api.security.AdminSecurityInterceptor;
import com.kiyuziyu.api.security.ApiKeyInterceptor;
import com.kiyuziyu.api.security.FirebaseAuthenticationService;
import com.kiyuziyu.api.service.ShopifyProductMappingService;
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

@WebMvcTest(ShopifyProductMappingController.class)
@Import(GlobalExceptionHandler.class)
@AutoConfigureMockMvc(addFilters = false)
class ShopifyProductMappingControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private FirebaseAuthenticationService firebaseAuthService;

    @MockBean
    private ShopifyProductMappingService shopifyProductMappingService;

    @MockBean
    private ApiKeyInterceptor apiKeyInterceptor;

    @MockBean
    private AdminSecurityInterceptor adminSecurityInterceptor;

    // 7. Missing Firebase authentication -> 401
    @Test
    void testCreateMappingMissingAuthReturns401() throws Exception {
        when(firebaseAuthService.verifyToken(null))
                .thenThrow(new UnauthorizedException("Authorization header is required (format: 'Bearer <Firebase ID Token>')"));

        CreateShopifyProductMappingRequest request = new CreateShopifyProductMappingRequest("p1", "gid://shopify/Product/1");

        mockMvc.perform(post("/api/v1/tenants/me/stores/store_123/shopify-product-mappings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false));
    }

    // Invalid token -> 401
    @Test
    void testCreateMappingInvalidTokenReturns401() throws Exception {
        when(firebaseAuthService.verifyToken("Bearer invalid_token"))
                .thenThrow(new UnauthorizedException("Invalid or expired Firebase ID token"));

        CreateShopifyProductMappingRequest request = new CreateShopifyProductMappingRequest("p1", "gid://shopify/Product/1");

        mockMvc.perform(post("/api/v1/tenants/me/stores/store_123/shopify-product-mappings")
                        .header("Authorization", "Bearer invalid_token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false));
    }

    // 1. Create mapping successfully -> 201
    @Test
    void testCreateMappingSuccessReturns201() throws Exception {
        FirebaseToken mockToken = Mockito.mock(FirebaseToken.class);
        when(firebaseAuthService.verifyToken("Bearer valid_token")).thenReturn(mockToken);

        ShopifyProductMappingResponse mockResponse = new ShopifyProductMappingResponse(
                "map_123",
                "tenant_da7590066509",
                "store_5fcd29b2b01c",
                "sc_1",
                "swCyEYDiK3gLJCQNC27W",
                "524",
                "gid://shopify/Product/123456789",
                "kiyu-ziyu-watch",
                "MAPPED",
                "2026-09-23T00:00:00Z",
                "2026-09-23T00:00:00Z"
        );

        when(shopifyProductMappingService.createMapping(any(), eq("store_5fcd29b2b01c"), any()))
                .thenReturn(mockResponse);

        CreateShopifyProductMappingRequest request = new CreateShopifyProductMappingRequest(
                "swCyEYDiK3gLJCQNC27W",
                "gid://shopify/Product/123456789",
                "kiyu-ziyu-watch"
        );

        mockMvc.perform(post("/api/v1/tenants/me/stores/store_5fcd29b2b01c/shopify-product-mappings")
                        .header("Authorization", "Bearer valid_token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.mappingId").value("map_123"))
                .andExpect(jsonPath("$.data.productId").value("swCyEYDiK3gLJCQNC27W"))
                .andExpect(jsonPath("$.data.productCode").value("524"))
                .andExpect(jsonPath("$.data.shopifyProductId").value("gid://shopify/Product/123456789"))
                .andExpect(jsonPath("$.data.status").value("MAPPED"));
    }

    // 2. Duplicate mapping -> 409 Conflict
    @Test
    void testCreateDuplicateMappingReturns409() throws Exception {
        FirebaseToken mockToken = Mockito.mock(FirebaseToken.class);
        when(firebaseAuthService.verifyToken("Bearer valid_token")).thenReturn(mockToken);

        when(shopifyProductMappingService.createMapping(any(), eq("store_5fcd29b2b01c"), any()))
                .thenThrow(new ConflictException("Product already mapped for this store: swCyEYDiK3gLJCQNC27W"));

        CreateShopifyProductMappingRequest request = new CreateShopifyProductMappingRequest(
                "swCyEYDiK3gLJCQNC27W",
                "gid://shopify/Product/123456789"
        );

        mockMvc.perform(post("/api/v1/tenants/me/stores/store_5fcd29b2b01c/shopify-product-mappings")
                        .header("Authorization", "Bearer valid_token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Product already mapped for this store: swCyEYDiK3gLJCQNC27W"));
    }

    // 8. Cross-tenant store -> 403 Forbidden
    @Test
    void testCrossTenantStoreReturns403() throws Exception {
        FirebaseToken mockToken = Mockito.mock(FirebaseToken.class);
        when(firebaseAuthService.verifyToken("Bearer valid_token")).thenReturn(mockToken);

        when(shopifyProductMappingService.createMapping(any(), eq("store_cross_tenant"), any()))
                .thenThrow(new ForbiddenException("Store does not belong to user's tenant"));

        CreateShopifyProductMappingRequest request = new CreateShopifyProductMappingRequest("p1", "gid://shopify/Product/1");

        mockMvc.perform(post("/api/v1/tenants/me/stores/store_cross_tenant/shopify-product-mappings")
                        .header("Authorization", "Bearer valid_token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Store does not belong to user's tenant"));
    }

    // 9. Missing store -> 404 Not Found
    @Test
    void testStoreNotFoundReturns404() throws Exception {
        FirebaseToken mockToken = Mockito.mock(FirebaseToken.class);
        when(firebaseAuthService.verifyToken("Bearer valid_token")).thenReturn(mockToken);

        when(shopifyProductMappingService.createMapping(any(), eq("non_existent_store"), any()))
                .thenThrow(new NotFoundException("Store not found: non_existent_store"));

        CreateShopifyProductMappingRequest request = new CreateShopifyProductMappingRequest("p1", "gid://shopify/Product/1");

        mockMvc.perform(post("/api/v1/tenants/me/stores/non_existent_store/shopify-product-mappings")
                        .header("Authorization", "Bearer valid_token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Store not found: non_existent_store"));
    }

    // 3. Get all mappings -> 200 OK
    @Test
    void testGetAllMappingsReturns200() throws Exception {
        FirebaseToken mockToken = Mockito.mock(FirebaseToken.class);
        when(firebaseAuthService.verifyToken("Bearer valid_token")).thenReturn(mockToken);

        ShopifyProductMappingResponse mockResponse = new ShopifyProductMappingResponse(
                "map_123", "tenant_1", "store_1", "sc_1", "p1", "524",
                "gid://shopify/Product/1", "handle", "MAPPED", "2026-09-23T00:00:00Z", "2026-09-23T00:00:00Z"
        );

        when(shopifyProductMappingService.getAllMappings(any(), eq("store_1")))
                .thenReturn(Collections.singletonList(mockResponse));

        mockMvc.perform(get("/api/v1/tenants/me/stores/store_1/shopify-product-mappings")
                        .header("Authorization", "Bearer valid_token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].mappingId").value("map_123"))
                .andExpect(jsonPath("$.data[0].productId").value("p1"));
    }

    // 4. Get single mapping -> 200 OK
    @Test
    void testGetSingleMappingReturns200() throws Exception {
        FirebaseToken mockToken = Mockito.mock(FirebaseToken.class);
        when(firebaseAuthService.verifyToken("Bearer valid_token")).thenReturn(mockToken);

        ShopifyProductMappingResponse mockResponse = new ShopifyProductMappingResponse(
                "map_123", "tenant_1", "store_1", "sc_1", "p1", "524",
                "gid://shopify/Product/1", "handle", "MAPPED", "2026-09-23T00:00:00Z", "2026-09-23T00:00:00Z"
        );

        when(shopifyProductMappingService.getSingleMapping(any(), eq("store_1"), eq("p1")))
                .thenReturn(mockResponse);

        mockMvc.perform(get("/api/v1/tenants/me/stores/store_1/shopify-product-mappings/p1")
                        .header("Authorization", "Bearer valid_token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.mappingId").value("map_123"));
    }

    // 5. Update mapping -> 200 OK
    @Test
    void testUpdateMappingReturns200() throws Exception {
        FirebaseToken mockToken = Mockito.mock(FirebaseToken.class);
        when(firebaseAuthService.verifyToken("Bearer valid_token")).thenReturn(mockToken);

        ShopifyProductMappingResponse mockResponse = new ShopifyProductMappingResponse(
                "map_123", "tenant_1", "store_1", "sc_1", "p1", "524",
                "gid://shopify/Product/1", "new-handle", "UNMAPPED", "2026-09-23T00:00:00Z", "2026-09-23T00:10:00Z"
        );

        when(shopifyProductMappingService.updateMapping(any(), eq("store_1"), eq("p1"), any()))
                .thenReturn(mockResponse);

        UpdateShopifyProductMappingRequest request = new UpdateShopifyProductMappingRequest("UNMAPPED");
        request.setShopifyProductHandle("new-handle");

        mockMvc.perform(patch("/api/v1/tenants/me/stores/store_1/shopify-product-mappings/p1")
                        .header("Authorization", "Bearer valid_token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.status").value("UNMAPPED"))
                .andExpect(jsonPath("$.data.shopifyProductHandle").value("new-handle"));
    }

    // 6. Delete mapping -> 204 No Content
    @Test
    void testDeleteMappingReturns204() throws Exception {
        FirebaseToken mockToken = Mockito.mock(FirebaseToken.class);
        when(firebaseAuthService.verifyToken("Bearer valid_token")).thenReturn(mockToken);

        doNothing().when(shopifyProductMappingService).deleteMapping(any(), eq("store_1"), eq("p1"));

        mockMvc.perform(delete("/api/v1/tenants/me/stores/store_1/shopify-product-mappings/p1")
                        .header("Authorization", "Bearer valid_token"))
                .andExpect(status().isNoContent());
    }
}
