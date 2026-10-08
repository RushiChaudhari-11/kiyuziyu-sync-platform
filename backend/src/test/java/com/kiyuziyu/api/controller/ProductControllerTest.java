package com.kiyuziyu.api.controller;

import com.kiyuziyu.api.dto.PagedResult;
import com.kiyuziyu.api.dto.PaginatedResponse;
import com.kiyuziyu.api.dto.ProductResponse;
import com.kiyuziyu.api.repository.ProductRepository;
import com.kiyuziyu.api.service.ProductService;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.util.Collections;
import java.util.List;
import java.util.concurrent.ExecutionException;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ProductControllerTest {

    @Mock
    private ProductService productService;

    @Mock
    private ProductRepository productRepository;

    @Mock
    private HttpServletRequest request;

    @InjectMocks
    private ProductController productController;

    private ProductResponse productResponse;

    @BeforeEach
    void setUp() {
        productResponse = new ProductResponse();
        productResponse.setProductId("p1");
        productResponse.setProductName("Test Product");
    }

    @Test
    void getAllProducts_ShouldReturnPaginatedResponseWithTotalCount() throws ExecutionException, InterruptedException {
        // Arrange
        List<ProductResponse> responses = Collections.singletonList(productResponse);
        PagedResult<ProductResponse> pagedResult = new PagedResult<>(responses, 150L);
        
        when(request.getAttribute("clientId")).thenReturn("client1");
        when(productService.getAllProducts(eq("client1"), eq(20), eq(0))).thenReturn(pagedResult);

        // Act
        ResponseEntity<?> responseEntity = productController.getAllProducts(request, 1, 20);

        // Assert
        assertEquals(200, responseEntity.getStatusCodeValue());
        assertTrue(responseEntity.getBody() instanceof PaginatedResponse);
        
        PaginatedResponse<?> body = (PaginatedResponse<?>) responseEntity.getBody();
        assertTrue(body.isSuccess());
        assertEquals(150L, body.getTotalCount());
        assertEquals(1, body.getPage());
        assertEquals(20, body.getLimit());
    }

    @Test
    void searchProducts_ShouldReturnPaginatedResponseWithTotalCount() throws ExecutionException, InterruptedException {
        // Arrange
        List<ProductResponse> responses = Collections.singletonList(productResponse);
        PagedResult<ProductResponse> pagedResult = new PagedResult<>(responses, 5L);
        
        when(request.getAttribute("clientId")).thenReturn("client1");
        when(productService.searchProducts(eq("client1"), eq("Test"), eq(20), eq(0))).thenReturn(pagedResult);

        // Act
        ResponseEntity<?> responseEntity = productController.searchProducts(request, "Test", 1, 20);

        // Assert
        assertEquals(200, responseEntity.getStatusCodeValue());
        assertTrue(responseEntity.getBody() instanceof PaginatedResponse);
        
        PaginatedResponse<?> body = (PaginatedResponse<?>) responseEntity.getBody();
        assertTrue(body.isSuccess());
        assertEquals(5L, body.getTotalCount());
        assertEquals(1, body.getPage());
        assertEquals(20, body.getLimit());
    }

    @Test
    void getProductsByCollection_ShouldReturnPaginatedResponseWithTotalCount() throws ExecutionException, InterruptedException {
        // Arrange
        List<ProductResponse> responses = Collections.singletonList(productResponse);
        PagedResult<ProductResponse> pagedResult = new PagedResult<>(responses, 42L);
        
        when(request.getAttribute("clientId")).thenReturn("client1");
        when(productService.getProductsByCollection(eq("client1"), eq("col1"), eq(20), eq(0))).thenReturn(pagedResult);

        // Act
        ResponseEntity<?> responseEntity = productController.getProductsByCollection(request, "col1", 1, 20);

        // Assert
        assertEquals(200, responseEntity.getStatusCodeValue());
        assertTrue(responseEntity.getBody() instanceof PaginatedResponse);
        
        PaginatedResponse<?> body = (PaginatedResponse<?>) responseEntity.getBody();
        assertTrue(body.isSuccess());
        assertEquals(42L, body.getTotalCount());
        assertEquals(1, body.getPage());
        assertEquals(20, body.getLimit());
    }
}
