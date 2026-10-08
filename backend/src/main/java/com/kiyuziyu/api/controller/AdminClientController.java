package com.kiyuziyu.api.controller;

import com.kiyuziyu.api.model.ApiClient;
import com.kiyuziyu.api.service.ApiClientService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ExecutionException;

@RestController
@RequestMapping("/api/v1/internal/admin/clients")
public class AdminClientController {

    @Autowired
    private ApiClientService apiClientService;

    @PostMapping
    public ResponseEntity<?> createClient(@RequestBody Map<String, String> body) throws ExecutionException, InterruptedException {
        String name = body.get("clientName");
        String domain = body.get("domain");
        if (name == null || name.isEmpty()) {
            return ResponseEntity.badRequest().body("clientName is required");
        }
        
        ApiClient client = apiClientService.createClient(name, domain);
        return ResponseEntity.ok(client);
    }

    @PostMapping("/{clientId}/keys")
    public ResponseEntity<?> generateKey(@PathVariable String clientId) throws ExecutionException, InterruptedException {
        String apiKey = apiClientService.generateApiKey(clientId);
        Map<String, String> response = new HashMap<>();
        response.put("apiKey", apiKey);
        response.put("message", "Store this key securely. It will not be shown again.");
        return ResponseEntity.ok(response);
    }

    @PostMapping("/keys/revoke")
    public ResponseEntity<?> revokeKey(@RequestBody Map<String, String> body) throws ExecutionException, InterruptedException {
        String apiKey = body.get("apiKey");
        if (apiKey != null) {
            String hash = apiClientService.hashKey(apiKey);
            apiClientService.revokeKeyByHash(hash);
            return ResponseEntity.ok("Key revoked");
        }
        return ResponseEntity.badRequest().body("apiKey is required");
    }

    @PostMapping("/{clientId}/suspend")
    public ResponseEntity<?> suspendClient(@PathVariable String clientId) throws ExecutionException, InterruptedException {
        apiClientService.suspendClient(clientId);
        return ResponseEntity.ok("Client suspended");
    }

    @PostMapping("/{clientId}/overrides")
    public ResponseEntity<?> setOverride(@PathVariable String clientId, @RequestBody Map<String, Object> body) throws ExecutionException, InterruptedException {
        String productCode = (String) body.get("productCode");
        String customName = (String) body.get("customProductName");
        String customDesc = (String) body.get("customDescription");
        String customImg = (String) body.get("customImage");
        
        Double sellingPrice = null;
        if (body.get("sellingPrice") != null) {
            Object sp = body.get("sellingPrice");
            if (sp instanceof Number) {
                sellingPrice = ((Number) sp).doubleValue();
            } else if (sp instanceof String) {
                sellingPrice = Double.parseDouble((String) sp);
            }
        }
        
        if (productCode == null) return ResponseEntity.badRequest().body("productCode is required");
        
        try {
            apiClientService.setProductOverride(clientId, productCode, productCode, customName, customDesc, customImg, sellingPrice);
            return ResponseEntity.ok("Override saved");
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}
