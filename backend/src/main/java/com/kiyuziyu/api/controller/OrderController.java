package com.kiyuziyu.api.controller;

import com.kiyuziyu.api.dto.OrderRequest;
import com.kiyuziyu.api.dto.OrderResponse;
import com.kiyuziyu.api.dto.PaginatedOrderResponse;
import com.kiyuziyu.api.dto.UpdateOrderStatusRequest;
import com.kiyuziyu.api.service.OrderService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ExecutionException;

@RestController
@RequestMapping("/api/v1/orders")
public class OrderController {

    @Autowired
    private OrderService orderService;

    private String getClientId(HttpServletRequest request) {
        return (String) request.getAttribute("clientId");
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> createOrder(
            HttpServletRequest servletRequest,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @Valid @RequestBody OrderRequest request) throws ExecutionException, InterruptedException {
        
        String clientId = getClientId(servletRequest);
        if (idempotencyKey == null || idempotencyKey.isEmpty()) {
            idempotencyKey = request.getExternalOrderId(); // Fallback if not provided
        }

        OrderResponse order = orderService.createOrder(clientId, idempotencyKey, request);
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", order);
        return new ResponseEntity<>(response, HttpStatus.CREATED);
    }

    @GetMapping("/{orderId}")
    public ResponseEntity<Map<String, Object>> getOrder(
            HttpServletRequest servletRequest,
            @PathVariable String orderId) throws ExecutionException, InterruptedException {
        
        String clientId = getClientId(servletRequest);
        OrderResponse order = orderService.getOrderById(clientId, orderId);
        
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", order);
        return ResponseEntity.ok(response);
    }

    @GetMapping
    public ResponseEntity<PaginatedOrderResponse> getOrders(
            HttpServletRequest servletRequest,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int limit) throws ExecutionException, InterruptedException {
        
        String clientId = getClientId(servletRequest);
        if (page < 1) page = 1;
        if (limit < 1 || limit > 100) limit = 20;

        PaginatedOrderResponse response = orderService.getOrders(clientId, page, limit);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/{orderId}/status")
    public ResponseEntity<Map<String, Object>> updateStatus(
            HttpServletRequest servletRequest,
            @PathVariable String orderId,
            @Valid @RequestBody UpdateOrderStatusRequest request) throws ExecutionException, InterruptedException {
        
        String clientId = getClientId(servletRequest);
        OrderResponse order = orderService.updateOrderStatus(clientId, orderId, request.getStatus());
        
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", order);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{orderId}/cancel")
    public ResponseEntity<Map<String, Object>> cancelOrder(
            HttpServletRequest servletRequest,
            @PathVariable String orderId) throws ExecutionException, InterruptedException {
        
        String clientId = getClientId(servletRequest);
        OrderResponse order = orderService.cancelOrder(clientId, orderId);
        
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", order);
        return ResponseEntity.ok(response);
    }
}
