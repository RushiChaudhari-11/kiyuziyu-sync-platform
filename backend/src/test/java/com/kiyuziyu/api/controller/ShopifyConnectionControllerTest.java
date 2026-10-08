package com.kiyuziyu.api.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.firebase.auth.FirebaseToken;
import com.kiyuziyu.api.dto.shopifyconnection.CreateShopifyConnectionRequest;
import com.kiyuziyu.api.dto.shopifyconnection.ShopifyConnectionResponse;
import com.kiyuziyu.api.dto.shopifyconnection.UpdateShopifyConnectionRequest;
import com.kiyuziyu.api.exception.ConflictException;
import com.kiyuziyu.api.exception.ForbiddenException;
import com.kiyuziyu.api.exception.GlobalExceptionHandler;
import com.kiyuziyu.api.exception.NotFoundException;
import com.kiyuziyu.api.exception.UnauthorizedException;
import com.kiyuziyu.api.security.AdminSecurityInterceptor;
import com.kiyuziyu.api.security.ApiKeyInterceptor;
import com.kiyuziyu.api.security.FirebaseAuthenticationService;
import com.kiyuziyu.api.service.ShopifyConnectionService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(ShopifyConnectionController.class)
@Import(GlobalExceptionHandler.class)
@AutoConfigureMockMvc(addFilters = false)
class ShopifyConnectionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private FirebaseAuthenticationService firebaseAuthService;

    @MockBean
    private ShopifyConnectionService shopifyConnectionService;

    @MockBean
    private ApiKeyInterceptor apiKeyInterceptor;

    @MockBean
    private AdminSecurityInterceptor adminSecurityInterceptor;

    // 6. Missing Firebase authentication -> 401
    @Test
    void testCreateConnectionMissingAuthReturns401() throws Exception {
        when(firebaseAuthService.verifyToken(null))
                .thenThrow(new UnauthorizedException("Authorization header is required (format: 'Bearer <Firebase ID Token>')"));

        CreateShopifyConnectionRequest request = new CreateShopifyConnectionRequest("test.myshopify.com");

        mockMvc.perform(post("/api/v1/tenants/me/stores/store_123/shopify-connection")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false));
    }

    // Invalid token -> 401
    @Test
    void testCreateConnectionInvalidTokenReturns401() throws Exception {
        when(firebaseAuthService.verifyToken("Bearer invalid_token"))
                .thenThrow(new UnauthorizedException("Invalid or expired Firebase ID token"));

        CreateShopifyConnectionRequest request = new CreateShopifyConnectionRequest("test.myshopify.com");

        mockMvc.perform(post("/api/v1/tenants/me/stores/store_123/shopify-connection")
                        .header("Authorization", "Bearer invalid_token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false));
    }

    // 1. Successful Shopify connection creation -> 201
    @Test
    void testCreateConnectionSuccessReturns201() throws Exception {
        FirebaseToken mockToken = Mockito.mock(FirebaseToken.class);
        when(firebaseAuthService.verifyToken("Bearer valid_token")).thenReturn(mockToken);

        ShopifyConnectionResponse mockResponse = new ShopifyConnectionResponse(
                "sc_123abc",
                "tenant_da7590066509",
                "store_5fcd29b2b01c",
                "test.myshopify.com",
                "shp_123",
                true,
                "CONNECTED",
                "2026-09-23T00:00:00Z",
                "2026-09-23T00:00:00Z"
        );

        when(shopifyConnectionService.createConnection(any(), eq("store_5fcd29b2b01c"), any()))
                .thenReturn(mockResponse);

        CreateShopifyConnectionRequest request = new CreateShopifyConnectionRequest("test.myshopify.com");

        mockMvc.perform(post("/api/v1/tenants/me/stores/store_5fcd29b2b01c/shopify-connection")
                        .header("Authorization", "Bearer valid_token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.connectionId").value("sc_123abc"))
                .andExpect(jsonPath("$.data.tenantId").value("tenant_da7590066509"))
                .andExpect(jsonPath("$.data.storeId").value("store_5fcd29b2b01c"))
                .andExpect(jsonPath("$.data.shopifyStoreDomain").value("test.myshopify.com"))
                .andExpect(jsonPath("$.data.status").value("CONNECTED"));
    }

    // 2. Duplicate connection -> 409 Conflict
    @Test
    void testCreateDuplicateConnectionReturns409() throws Exception {
        FirebaseToken mockToken = Mockito.mock(FirebaseToken.class);
        when(firebaseAuthService.verifyToken("Bearer valid_token")).thenReturn(mockToken);

        when(shopifyConnectionService.createConnection(any(), eq("store_5fcd29b2b01c"), any()))
                .thenThrow(new ConflictException("Shopify connection already exists for this store"));

        CreateShopifyConnectionRequest request = new CreateShopifyConnectionRequest("test.myshopify.com");

        mockMvc.perform(post("/api/v1/tenants/me/stores/store_5fcd29b2b01c/shopify-connection")
                        .header("Authorization", "Bearer valid_token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Shopify connection already exists for this store"));
    }

    // 7. Store belonging to another tenant -> 403 Forbidden
    @Test
    void testCrossTenantStoreAccessReturns403() throws Exception {
        FirebaseToken mockToken = Mockito.mock(FirebaseToken.class);
        when(firebaseAuthService.verifyToken("Bearer valid_token")).thenReturn(mockToken);

        when(shopifyConnectionService.createConnection(any(), eq("store_cross_tenant"), any()))
                .thenThrow(new ForbiddenException("Store does not belong to user's tenant"));

        CreateShopifyConnectionRequest request = new CreateShopifyConnectionRequest("test.myshopify.com");

        mockMvc.perform(post("/api/v1/tenants/me/stores/store_cross_tenant/shopify-connection")
                        .header("Authorization", "Bearer valid_token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Store does not belong to user's tenant"));
    }

    // 8. Non-existing store -> 404 Not Found
    @Test
    void testStoreNotFoundReturns404() throws Exception {
        FirebaseToken mockToken = Mockito.mock(FirebaseToken.class);
        when(firebaseAuthService.verifyToken("Bearer valid_token")).thenReturn(mockToken);

        when(shopifyConnectionService.createConnection(any(), eq("non_existent_store"), any()))
                .thenThrow(new NotFoundException("Store not found: non_existent_store"));

        CreateShopifyConnectionRequest request = new CreateShopifyConnectionRequest("test.myshopify.com");

        mockMvc.perform(post("/api/v1/tenants/me/stores/non_existent_store/shopify-connection")
                        .header("Authorization", "Bearer valid_token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Store not found: non_existent_store"));
    }

    // 3. Get connection -> 200 OK
    @Test
    void testGetConnectionReturns200() throws Exception {
        FirebaseToken mockToken = Mockito.mock(FirebaseToken.class);
        when(firebaseAuthService.verifyToken("Bearer valid_token")).thenReturn(mockToken);

        ShopifyConnectionResponse mockResponse = new ShopifyConnectionResponse(
                "sc_123abc",
                "tenant_da7590066509",
                "store_5fcd29b2b01c",
                "test.myshopify.com",
                "shp_123",
                true,
                "CONNECTED",
                "2026-09-23T00:00:00Z",
                "2026-09-23T00:00:00Z"
        );

        when(shopifyConnectionService.getConnection(any(), eq("store_5fcd29b2b01c")))
                .thenReturn(mockResponse);

        mockMvc.perform(get("/api/v1/tenants/me/stores/store_5fcd29b2b01c/shopify-connection")
                        .header("Authorization", "Bearer valid_token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.connectionId").value("sc_123abc"))
                .andExpect(jsonPath("$.data.shopifyStoreDomain").value("test.myshopify.com"));
    }

    // 4. Update connection (PATCH) -> 200 OK
    @Test
    void testUpdateConnectionReturns200() throws Exception {
        FirebaseToken mockToken = Mockito.mock(FirebaseToken.class);
        when(firebaseAuthService.verifyToken("Bearer valid_token")).thenReturn(mockToken);

        ShopifyConnectionResponse mockResponse = new ShopifyConnectionResponse(
                "sc_123abc",
                "tenant_da7590066509",
                "store_5fcd29b2b01c",
                "test.myshopify.com",
                "shp_123",
                false,
                "DISCONNECTED",
                "2026-09-23T00:00:00Z",
                "2026-09-23T00:10:00Z"
        );

        when(shopifyConnectionService.updateConnection(any(), eq("store_5fcd29b2b01c"), any()))
                .thenReturn(mockResponse);

        UpdateShopifyConnectionRequest request = new UpdateShopifyConnectionRequest("DISCONNECTED");

        mockMvc.perform(patch("/api/v1/tenants/me/stores/store_5fcd29b2b01c/shopify-connection")
                        .header("Authorization", "Bearer valid_token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.status").value("DISCONNECTED"));
    }

    // 5. Delete/disconnect connection -> 204 No Content
    @Test
    void testDeleteConnectionReturns204() throws Exception {
        FirebaseToken mockToken = Mockito.mock(FirebaseToken.class);
        when(firebaseAuthService.verifyToken("Bearer valid_token")).thenReturn(mockToken);

        doNothing().when(shopifyConnectionService).deleteConnection(any(), eq("store_5fcd29b2b01c"));

        mockMvc.perform(delete("/api/v1/tenants/me/stores/store_5fcd29b2b01c/shopify-connection")
                        .header("Authorization", "Bearer valid_token"))
                .andExpect(status().isNoContent());
    }
}
