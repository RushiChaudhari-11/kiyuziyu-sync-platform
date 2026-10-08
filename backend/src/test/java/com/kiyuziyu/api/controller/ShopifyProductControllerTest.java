package com.kiyuziyu.api.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kiyuziyu.api.dto.shopify.ShopifyBulkSyncRequest;
import com.kiyuziyu.api.dto.shopify.ShopifyBulkSyncResponse;
import com.kiyuziyu.api.dto.shopify.ShopifyProductSyncResponse;
import com.kiyuziyu.api.security.ApiKeyInterceptor;
import com.kiyuziyu.api.service.ShopifyBulkProductSyncService;
import com.kiyuziyu.api.service.ShopifyProductService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(ShopifyProductController.class)
@AutoConfigureMockMvc(addFilters = false) // Disable security filters for simple routing test
class ShopifyProductControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private ShopifyProductService shopifyProductService;

    @MockBean
    private ShopifyBulkProductSyncService shopifyBulkProductSyncService;
    
    @MockBean
    private ApiKeyInterceptor apiKeyInterceptor;

    @Test
    void testSingleProductSyncRouting() throws Exception {
        ShopifyProductSyncResponse mockRes = new ShopifyProductSyncResponse();
        mockRes.setSuccess(true);
        mockRes.setMessage("Single sync mock");
        when(shopifyProductService.syncProductToShopify("client_abc", "123")).thenReturn(mockRes);
        
        when(apiKeyInterceptor.preHandle(any(), any(), any())).thenReturn(true);

        mockMvc.perform(post("/api/v1/integrations/shopify/products/123")
                        .requestAttr("clientId", "client_abc"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Single sync mock"));

        org.mockito.Mockito.verify(shopifyProductService, org.mockito.Mockito.times(1))
                .syncProductToShopify("client_abc", "123");
    }

    @Test
    void testBulkProductSyncRouting() throws Exception {
        ShopifyBulkSyncResponse mockRes = new ShopifyBulkSyncResponse();
        mockRes.setSuccess(true);
        mockRes.setMessage("Bulk sync mock");
        when(shopifyBulkProductSyncService.syncProductsBulk(org.mockito.ArgumentMatchers.eq("client_abc"), any(ShopifyBulkSyncRequest.class))).thenReturn(mockRes);

        when(apiKeyInterceptor.preHandle(any(), any(), any())).thenReturn(true);
        
        ShopifyBulkSyncRequest req = new ShopifyBulkSyncRequest();
        req.setLimit(5);
        req.setPage(1);

        mockMvc.perform(post("/api/v1/integrations/shopify/products/bulk-sync")
                        .requestAttr("clientId", "client_abc")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Bulk sync mock"));

        org.mockito.Mockito.verify(shopifyBulkProductSyncService, org.mockito.Mockito.times(1))
                .syncProductsBulk(org.mockito.ArgumentMatchers.eq("client_abc"), any(ShopifyBulkSyncRequest.class));
    }

    @Test
    void testInvalidProductCodeRouting() throws Exception {
        when(apiKeyInterceptor.preHandle(any(), any(), any())).thenReturn(true);

        mockMvc.perform(post("/api/v1/integrations/shopify/products/abc")
                        .requestAttr("clientId", "client_abc"))
                .andExpect(status().isInternalServerError()); // GlobalExceptionHandler maps NoResourceFoundException to 500

        org.mockito.Mockito.verify(shopifyProductService, org.mockito.Mockito.never()).syncProductToShopify(any(), any());
    }
}
