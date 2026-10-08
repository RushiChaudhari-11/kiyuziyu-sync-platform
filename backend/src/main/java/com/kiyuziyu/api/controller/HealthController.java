package com.kiyuziyu.api.controller;

import com.kiyuziyu.api.dto.HealthResponse;
import com.kiyuziyu.api.service.FirebaseHealthService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/v1")
public class HealthController {

    private final FirebaseHealthService firebaseHealthService;

    @Autowired
    public HealthController(FirebaseHealthService firebaseHealthService) {
        this.firebaseHealthService = firebaseHealthService;
    }

    @GetMapping("/health")
    public ResponseEntity<HealthResponse> healthCheck() {
        HealthResponse response = new HealthResponse(true, "Kiyuziyu API is running");
        return ResponseEntity.ok(response);
    }

    @GetMapping("/health/firebase")
    public ResponseEntity<Map<String, Object>> firebaseHealthCheck() {
        boolean isConnected = firebaseHealthService.checkFirebaseConnection();
        Map<String, Object> response = new HashMap<>();
        response.put("success", isConnected);
        response.put("firebaseConnected", isConnected);
        response.put("message", isConnected ? "Firebase connection is healthy" : "Firebase connection failed");
        
        return ResponseEntity.ok(response);
    }
}
