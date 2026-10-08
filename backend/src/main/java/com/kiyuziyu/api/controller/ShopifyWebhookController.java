package com.kiyuziyu.api.controller;

import com.kiyuziyu.api.service.ShopifyOrderWebhookService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/webhooks/shopify")
@CrossOrigin(origins = "*")
public class ShopifyWebhookController {

    @Autowired
    private ShopifyOrderWebhookService orderWebhookService;

    @PostMapping("/orders/create")
    public ResponseEntity<String> handleOrderCreate(
            @RequestParam("tenantId") String tenantId,
            @RequestBody Map<String, Object> payload) {
        
        // Return 200 OK so Shopify knows we received it successfully
        orderWebhookService.processOrderWebhook(tenantId, payload);
        
        return ResponseEntity.ok("Webhook received");
    }
}
