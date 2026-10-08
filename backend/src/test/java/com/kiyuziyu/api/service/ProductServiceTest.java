package com.kiyuziyu.api.service;

import com.kiyuziyu.api.dto.PagedResult;
import com.kiyuziyu.api.dto.ProductResponse;
import com.kiyuziyu.api.model.Product;
import com.kiyuziyu.api.repository.ClientProductOverrideRepository;
import com.kiyuziyu.api.repository.ProductRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Arrays;
import java.util.List;
import java.util.concurrent.ExecutionException;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ProductServiceTest {

    @Mock
    private ProductRepository productRepository;

    @Mock
    private ClientProductOverrideRepository overrideRepository;

    @InjectMocks
    private ProductService productService;

    private Product product1;
    private Product product2;

    @BeforeEach
    void setUp() {
        product1 = new Product();
        product1.setId("p1");
        product1.setProductCode("code1");
        product1.setProductName("Product 1");

        product2 = new Product();
        product2.setId("p2");
        product2.setProductCode("code2");
        product2.setProductName("Product 2");
    }

    @Test
    void getAllProducts_ShouldReturnPagedResultWithTotalCount() throws ExecutionException, InterruptedException {
        // Arrange
        List<Product> products = Arrays.asList(product1, product2);
        long totalCount = 100L;
        PagedResult<Product> repoResult = new PagedResult<>(products, totalCount);
        
        when(productRepository.findAllProducts(10, 0)).thenReturn(repoResult);
        when(overrideRepository.findByClientAndProduct(anyString(), anyString())).thenReturn(null);

        // Act
        PagedResult<ProductResponse> result = productService.getAllProducts("client1", 10, 0);

        // Assert
        assertNotNull(result);
        assertEquals(2, result.getData().size());
        assertEquals(100L, result.getTotalCount());
        assertEquals("p1", result.getData().get(0).getProductId());
    }

    @Test
    void searchProducts_ShouldReturnPagedResultWithTotalCount() throws ExecutionException, InterruptedException {
        // Arrange
        List<Product> products = Arrays.asList(product1);
        long totalCount = 1L;
        PagedResult<Product> repoResult = new PagedResult<>(products, totalCount);
        
        when(productRepository.searchProducts("prod", 10, 0)).thenReturn(repoResult);
        when(overrideRepository.findByClientAndProduct(anyString(), anyString())).thenReturn(null);

        // Act
        PagedResult<ProductResponse> result = productService.searchProducts("client1", "prod", 10, 0);

        // Assert
        assertNotNull(result);
        assertEquals(1, result.getData().size());
        assertEquals(1L, result.getTotalCount());
    }

    @Test
    void getProductsByCollection_ShouldReturnPagedResultWithTotalCount() throws ExecutionException, InterruptedException {
        // Arrange
        List<Product> products = Arrays.asList(product1, product2);
        long totalCount = 50L;
        PagedResult<Product> repoResult = new PagedResult<>(products, totalCount);
        
        when(productRepository.findByCollectionId("col1", 10, 0)).thenReturn(repoResult);
        when(overrideRepository.findByClientAndProduct(anyString(), anyString())).thenReturn(null);

        // Act
        PagedResult<ProductResponse> result = productService.getProductsByCollection("client1", "col1", 10, 0);

        // Assert
        assertNotNull(result);
        assertEquals(2, result.getData().size());
        assertEquals(50L, result.getTotalCount());
    }
}
