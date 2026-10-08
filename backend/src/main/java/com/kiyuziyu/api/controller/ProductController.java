package com.kiyuziyu.api.controller;

import com.kiyuziyu.api.dto.PagedResult;
import com.kiyuziyu.api.dto.PaginatedResponse;
import com.kiyuziyu.api.dto.ProductResponse;
import com.kiyuziyu.api.repository.ProductRepository;
import com.kiyuziyu.api.service.ProductService;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1")
public class ProductController {

    private static final Logger log = LoggerFactory.getLogger(ProductController.class);

    @Autowired
    private ProductService productService;

    @Autowired
    private ProductRepository productRepository;

    @GetMapping("/products")
    public ResponseEntity<?> getAllProducts(
            HttpServletRequest request,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int limit) {
        long t0 = System.currentTimeMillis();
        try {
            int offset = (page - 1) * limit;
            String clientId = (String) request.getAttribute("clientId");
            PagedResult<ProductResponse> result = productService.getAllProducts(clientId, limit, offset);
            log.info("[ProductCtrl] GET /products page={} limit={} -> {} products {}ms", page, limit, result.getData().size(), System.currentTimeMillis()-t0);
            return ResponseEntity.ok(new PaginatedResponse<>(true, result.getData(), (int) result.getTotalCount(), page, limit));
        } catch (Exception e) {
            log.error("[ProductCtrl] GET /products failed: {}", e.getMessage());
            return ResponseEntity.status(500).body(errorResponse("Failed to retrieve products"));
        }
    }

    @GetMapping("/products/search")
    public ResponseEntity<?> searchProducts(
            HttpServletRequest request,
            @RequestParam String query,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int limit) {
        long t0 = System.currentTimeMillis();
        try {
            int offset = (page - 1) * limit;
            String clientId = (String) request.getAttribute("clientId");
            PagedResult<ProductResponse> result = productService.searchProducts(clientId, query, limit, offset);
            log.info("[ProductCtrl] GET /products/search query='{}' -> {} products {}ms", query, result.getData().size(), System.currentTimeMillis()-t0);
            return ResponseEntity.ok(new PaginatedResponse<>(true, result.getData(), (int) result.getTotalCount(), page, limit));
        } catch (Exception e) {
            log.error("[ProductCtrl] GET /products/search failed: {}", e.getMessage());
            return ResponseEntity.status(500).body(errorResponse("Search failed"));
        }
    }

    @GetMapping("/products/{id}")
    public ResponseEntity<?> getProductById(HttpServletRequest request, @PathVariable String id) {
        long t0 = System.currentTimeMillis();
        try {
            String clientId = (String) request.getAttribute("clientId");
            ProductResponse product = productService.getProductById(clientId, id);
            log.info("[ProductCtrl] GET /products/{} -> {} {}ms", id, product != null ? "found" : "not found", System.currentTimeMillis()-t0);
            if (product != null) {
                Map<String, Object> success = new HashMap<>();
                success.put("success", true);
                success.put("data", product);
                return ResponseEntity.ok(success);
            }
            return ResponseEntity.status(404).body(errorResponse("Product not found"));
        } catch (Exception e) {
            log.error("[ProductCtrl] GET /products/{} failed: {}", id, e.getMessage());
            return ResponseEntity.status(500).body(errorResponse("Failed to retrieve product"));
        }
    }

    @GetMapping("/collections")
    public ResponseEntity<?> getCollections() {
        long t0 = System.currentTimeMillis();
        try {
            List<Map<String, Object>> result = productRepository.findAllCollections();
            log.info("[ProductCtrl] GET /collections -> {} collections {}ms", result.size(), System.currentTimeMillis()-t0);
            Map<String, Object> success = new HashMap<>();
            success.put("success", true);
            success.put("data", result);
            return ResponseEntity.ok(success);
        } catch (Exception e) {
            log.error("[ProductCtrl] GET /collections failed: {}", e.getMessage());
            return ResponseEntity.status(500).body(errorResponse("Failed to retrieve collections"));
        }
    }

    @GetMapping("/collections/{collectionId}/products")
    public ResponseEntity<?> getProductsByCollection(
            HttpServletRequest request,
            @PathVariable String collectionId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int limit) {
        long t0 = System.currentTimeMillis();
        try {
            int offset = (page - 1) * limit;
            String clientId = (String) request.getAttribute("clientId");
            PagedResult<ProductResponse> result = productService.getProductsByCollection(clientId, collectionId, limit, offset);
            log.info("[ProductCtrl] GET /collections/{}/products -> {} products {}ms", collectionId, result.getData().size(), System.currentTimeMillis()-t0);
            return ResponseEntity.ok(new PaginatedResponse<>(true, result.getData(), (int) result.getTotalCount(), page, limit));
        } catch (Exception e) {
            log.error("[ProductCtrl] GET /collections/{}/products failed: {}", collectionId, e.getMessage());
            return ResponseEntity.status(500).body(errorResponse("Failed to retrieve products"));
        }
    }

    private Map<String, Object> errorResponse(String message) {
        Map<String, Object> error = new HashMap<>();
        error.put("success", false);
        error.put("message", message);
        return error;
    }
}
