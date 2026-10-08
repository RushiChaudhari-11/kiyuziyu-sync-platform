package com.kiyuziyu.api.controller;

import com.kiyuziyu.api.dto.shopify.ShopifyBulkSyncRequest;
import com.kiyuziyu.api.dto.shopify.ShopifyBulkSyncResponse;
import com.kiyuziyu.api.dto.shopify.ShopifyProductSyncResponse;
import com.kiyuziyu.api.service.ShopifyBulkProductSyncService;
import com.kiyuziyu.api.service.ShopifyProductService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.concurrent.ExecutionException;

@RestController
@RequestMapping("/api/v1/integrations/shopify/products")
public class ShopifyProductController {

    @Autowired
    private ShopifyProductService shopifyProductService;

    @Autowired
    private ShopifyBulkProductSyncService shopifyBulkProductSyncService;

    /**
     * Synchronize a batch of Kiyuziyu products to Shopify.
     * Authentication: X-API-Key
     *
     * @param httpRequest The HTTP request containing authenticated clientId attribute
     * @param request The bulk sync request containing limit and page
     * @return ShopifyBulkSyncResponse
     */
    @PostMapping("/bulk-sync")
    public ResponseEntity<ShopifyBulkSyncResponse> syncProductsBulk(
            HttpServletRequest httpRequest,
            @RequestBody ShopifyBulkSyncRequest request) {
        String clientId = (String) httpRequest.getAttribute("clientId");
        ShopifyBulkSyncResponse response = shopifyBulkProductSyncService.syncProductsBulk(clientId, request);
        return ResponseEntity.ok(response);
    }

    /**
     * Synchronize one Kiyuziyu product to Shopify.
     * Authentication: X-API-Key
     *
     * @param httpRequest The HTTP request containing authenticated clientId attribute
     * @param productCode The unique Kiyuziyu product code
     * @return ShopifyProductSyncResponse
     */
    @PostMapping("/{productCode:\\d+}")
    public ResponseEntity<ShopifyProductSyncResponse> syncProduct(
            HttpServletRequest httpRequest,
            @PathVariable String productCode) throws ExecutionException, InterruptedException {
        String clientId = (String) httpRequest.getAttribute("clientId");
        ShopifyProductSyncResponse response = shopifyProductService.syncProductToShopify(clientId, productCode);
        return ResponseEntity.ok(response);
    }
}
