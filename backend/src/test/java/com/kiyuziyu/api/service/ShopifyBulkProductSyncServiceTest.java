package com.kiyuziyu.api.service;

import com.kiyuziyu.api.dto.PagedResult;
import com.kiyuziyu.api.dto.shopify.ShopifyBulkSyncRequest;
import com.kiyuziyu.api.dto.shopify.ShopifyBulkSyncResponse;
import com.kiyuziyu.api.exception.BadRequestException;
import com.kiyuziyu.api.integration.shopify.ShopifyDuplicateConflictException;
import com.kiyuziyu.api.integration.shopify.ShopifyGraphQLClient;
import com.kiyuziyu.api.model.ClientProductOverride;
import com.kiyuziyu.api.model.Product;
import com.kiyuziyu.api.repository.ClientProductOverrideRepository;
import com.kiyuziyu.api.repository.ProductRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ShopifyBulkProductSyncServiceTest {

    @Mock
    private ProductRepository productRepository;

    @Mock
    private ClientProductOverrideRepository overrideRepository;

    @Mock
    private ShopifyGraphQLClient shopifyGraphQLClient;

    @InjectMocks
    private ShopifyBulkProductSyncService syncService;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
    }

    @Test
    void testSyncProductsBulk_MissingClientId() {
        ShopifyBulkSyncRequest req = new ShopifyBulkSyncRequest();
        req.setLimit(10);
        req.setPage(1);

        assertThrows(BadRequestException.class, () -> {
            syncService.syncProductsBulk(null, req);
        });
        assertThrows(BadRequestException.class, () -> {
            syncService.syncProductsBulk("   ", req);
        });
    }

    @Test
    void testSyncProductsBulk_InvalidLimit() {
        ShopifyBulkSyncRequest req = new ShopifyBulkSyncRequest();
        req.setLimit(51);
        
        assertThrows(BadRequestException.class, () -> {
            syncService.syncProductsBulk("client_test", req);
        });

        req.setLimit(0);
        assertThrows(BadRequestException.class, () -> {
            syncService.syncProductsBulk("client_test", req);
        });
    }

    @Test
    void testSyncProductsBulk_EmptyPage() throws Exception {
        ShopifyBulkSyncRequest req = new ShopifyBulkSyncRequest();
        req.setLimit(10);
        req.setPage(1);

        when(productRepository.findAllProducts(10, 0)).thenReturn(new PagedResult<>(new ArrayList<>(), 0));

        ShopifyBulkSyncResponse response = syncService.syncProductsBulk("client_test", req);
        assertEquals(0, response.getTotalProcessed());
        assertEquals(0, response.getResults().size());
        verify(shopifyGraphQLClient, never()).findProductIdByProductCode(anyString(), anyString());
    }

    @Test
    void testSyncProductsBulk_MixedResults() throws Exception {
        List<Product> products = new ArrayList<>();
        
        // 1. Valid new product -> CREATED
        Product p1 = new Product();
        p1.setId("doc_P001");
        p1.setProductCode("P001");
        p1.setProductName("Product 1");
        p1.setBasePrice(100.0);
        products.add(p1);

        // 2. Existing product -> ALREADY_EXISTS
        Product p2 = new Product();
        p2.setId("doc_P002");
        p2.setProductCode("P002");
        p2.setProductName("Product 2");
        p2.setBasePrice(200.0);
        products.add(p2);

        // 3. Fails during creation -> FAILED
        Product p3 = new Product();
        p3.setId("doc_P003");
        p3.setProductCode("P003");
        p3.setProductName("Product 3");
        p3.setBasePrice(300.0);
        products.add(p3);

        // 4. Missing basePrice -> FAILED
        Product p4 = new Product();
        p4.setId("doc_P004");
        p4.setProductCode("P004");
        p4.setProductName("Product 4");
        // basePrice is null
        products.add(p4);

        // 5. sellingPrice < basePrice -> FAILED
        Product p5 = new Product();
        p5.setId("doc_P005");
        p5.setProductCode("P005");
        p5.setProductName("Product 5");
        p5.setBasePrice(500.0);
        products.add(p5);

        when(productRepository.findAllProducts(10, 0)).thenReturn(new PagedResult<>(products, 5));

        // Overrides
        ClientProductOverride o1 = new ClientProductOverride();
        o1.setSellingPrice(150.0); // > 100.0
        when(overrideRepository.findByClientAndProduct("client_test", "doc_P001")).thenReturn(o1);

        ClientProductOverride o2 = new ClientProductOverride();
        o2.setSellingPrice(250.0); // > 200.0
        when(overrideRepository.findByClientAndProduct("client_test", "doc_P002")).thenReturn(o2);

        ClientProductOverride o3 = new ClientProductOverride();
        o3.setSellingPrice(350.0); // > 300.0
        when(overrideRepository.findByClientAndProduct("client_test", "doc_P003")).thenReturn(o3);

        ClientProductOverride o5 = new ClientProductOverride();
        o5.setSellingPrice(450.0); // < 500.0 -> must be rejected
        when(overrideRepository.findByClientAndProduct("client_test", "doc_P005")).thenReturn(o5);

        // P001 Mocks
        when(shopifyGraphQLClient.findProductIdByFirebaseId("doc_P001")).thenReturn(null);
        Map<String, String> c1 = new HashMap<>();
        c1.put("productId", "gid://shopify/Product/1");
        c1.put("variantId", "gid://shopify/ProductVariant/1");
        // P002 Mocks (Duplicate)
        when(shopifyGraphQLClient.findProductIdByFirebaseId("doc_P002")).thenReturn("gid://shopify/Product/2");

        // P003 Mocks (Exception during createProduct)
        when(shopifyGraphQLClient.findProductIdByFirebaseId("doc_P003")).thenReturn(null);
        org.mockito.Mockito.doReturn(c1).doThrow(new RuntimeException("API Error"))
                .when(shopifyGraphQLClient).createProduct(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any());

        ShopifyBulkSyncRequest req = new ShopifyBulkSyncRequest();
        req.setLimit(10);
        req.setPage(1);
        ShopifyBulkSyncResponse response = syncService.syncProductsBulk("client_test", req);

        // Verify summary
        assertTrue(response.isSuccess());
        assertEquals(5, response.getTotalProcessed());
        assertEquals(1, response.getCreated());
        assertEquals(1, response.getAlreadyExists());
        assertEquals(1, response.getUpdated());
        assertEquals(3, response.getFailed()); // P003, P004, P005
        assertEquals(5, response.getResults().size());

        // Verify variant was updated for P001 with sellingPrice 150.0 and SKU P001
        verify(shopifyGraphQLClient, times(1)).updateVariantDetails("gid://shopify/Product/1", "gid://shopify/ProductVariant/1", 150.0, "P001");
    }

    // -----------------------------------------------------------------------
    // RULE L: Bulk sync handles invalid sellingPrice as FAILED without stopping batch
    // -----------------------------------------------------------------------
    @Test
    void testSyncProductsBulk_InvalidSellingPrices_HandledAsFailed() throws Exception {
        List<Product> products = new ArrayList<>();

        // Item 1: Valid (sellingPrice > basePrice) -> CREATED
        Product p1 = new Product();
        p1.setId("doc_1");
        p1.setProductCode("101");
        p1.setProductName("Valid Product");
        p1.setBasePrice(100.0);
        products.add(p1);

        // Item 2: Missing sellingPrice override -> FAILED
        Product p2 = new Product();
        p2.setId("doc_2");
        p2.setProductCode("102");
        p2.setProductName("Missing Price Product");
        p2.setBasePrice(100.0);
        products.add(p2);

        // Item 3: Zero sellingPrice -> FAILED
        Product p3 = new Product();
        p3.setId("doc_3");
        p3.setProductCode("103");
        p3.setProductName("Zero Price Product");
        p3.setBasePrice(100.0);
        products.add(p3);

        // Item 4: sellingPrice < basePrice -> FAILED
        Product p4 = new Product();
        p4.setId("doc_4");
        p4.setProductCode("104");
        p4.setProductName("Underpriced Product");
        p4.setBasePrice(100.0);
        products.add(p4);

        // Item 5: Valid (sellingPrice == basePrice) -> CREATED
        Product p5 = new Product();
        p5.setId("doc_5");
        p5.setProductCode("105");
        p5.setProductName("Equal Price Product");
        p5.setBasePrice(100.0);
        products.add(p5);

        when(productRepository.findAllProducts(10, 0)).thenReturn(new PagedResult<>(products, 5));

        ClientProductOverride o1 = new ClientProductOverride();
        o1.setSellingPrice(150.0);
        when(overrideRepository.findByClientAndProduct("client_x", "doc_1")).thenReturn(o1);

        // o2 is null (missing)
        when(overrideRepository.findByClientAndProduct("client_x", "doc_2")).thenReturn(null);

        ClientProductOverride o3 = new ClientProductOverride();
        o3.setSellingPrice(0.0);
        when(overrideRepository.findByClientAndProduct("client_x", "doc_3")).thenReturn(o3);

        ClientProductOverride o4 = new ClientProductOverride();
        o4.setSellingPrice(80.0);
        when(overrideRepository.findByClientAndProduct("client_x", "doc_4")).thenReturn(o4);

        ClientProductOverride o5 = new ClientProductOverride();
        o5.setSellingPrice(100.0);
        when(overrideRepository.findByClientAndProduct("client_x", "doc_5")).thenReturn(o5);

        when(shopifyGraphQLClient.findProductIdByFirebaseId(anyString())).thenReturn(null);
        Map<String, String> c = Map.of("productId", "gid://shopify/Product/1", "variantId", "gid://shopify/ProductVariant/1");
        when(shopifyGraphQLClient.createProduct(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any())).thenReturn(c);

        ShopifyBulkSyncRequest req = new ShopifyBulkSyncRequest();
        req.setLimit(10);
        req.setPage(1);

        ShopifyBulkSyncResponse response = syncService.syncProductsBulk("client_x", req);

        assertEquals(5, response.getTotalProcessed());
        assertEquals(3, response.getCreated()); // Item 1, Item 2 (defaults to basePrice), Item 5
        assertEquals(2, response.getFailed());  // Item 3 (zero < basePrice), Item 4 (80 < basePrice)
        assertEquals(0, response.getAlreadyExists());

        // Check error messages
        assertEquals("CREATED", response.getResults().get(0).getStatus());
        assertEquals("CREATED", response.getResults().get(1).getStatus()); // Missing override defaults to basePrice

        assertEquals("FAILED", response.getResults().get(2).getStatus());
        assertTrue(response.getResults().get(2).getError().contains("Client selling price cannot be lower than Kiyuziyu base price."));

        assertEquals("FAILED", response.getResults().get(3).getStatus());
        assertTrue(response.getResults().get(3).getError().contains("Client selling price cannot be lower than Kiyuziyu base price."));

        assertEquals("CREATED", response.getResults().get(4).getStatus());
    }

    @Test
    void testSyncProductsBulk_TenProductsSuccess() throws Exception {
        List<Product> products = new ArrayList<>();
        for (int i = 1; i <= 10; i++) {
            Product p = new Product();
            p.setId("doc_P" + i);
            p.setProductCode("P" + i);
            p.setProductName("Product " + i);
            p.setBasePrice(100.0);
            products.add(p);

            ClientProductOverride o = new ClientProductOverride();
            o.setSellingPrice(120.0);
            when(overrideRepository.findByClientAndProduct("client_test", "doc_P" + i)).thenReturn(o);
        }

        when(productRepository.findAllProducts(10, 0)).thenReturn(new PagedResult<>(products, 10));
        when(shopifyGraphQLClient.findProductIdByFirebaseId(anyString())).thenReturn(null);
        
        Map<String, String> c = new HashMap<>();
        c.put("productId", "gid://shopify/Product/1");
        c.put("variantId", "gid://shopify/ProductVariant/1");
        when(shopifyGraphQLClient.createProduct(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any())).thenReturn(c);

        ShopifyBulkSyncRequest req = new ShopifyBulkSyncRequest();
        ShopifyBulkSyncResponse response = syncService.syncProductsBulk("client_test", req);
        
        assertEquals(10, response.getTotalProcessed());
        assertEquals(10, response.getCreated());
        assertEquals(0, response.getFailed());
    }

    @Test
    void testSyncProductsBulk_FiftyProductsSuccess() throws Exception {
        List<Product> products = new ArrayList<>();
        for (int i = 1; i <= 50; i++) {
            Product p = new Product();
            p.setId("doc_P" + i);
            p.setProductCode("P" + i);
            p.setProductName("Product " + i);
            p.setBasePrice(100.0);
            products.add(p);

            ClientProductOverride o = new ClientProductOverride();
            o.setSellingPrice(120.0);
            when(overrideRepository.findByClientAndProduct("client_test", "doc_P" + i)).thenReturn(o);
        }

        when(productRepository.findAllProducts(50, 0)).thenReturn(new PagedResult<>(products, 50));
        when(shopifyGraphQLClient.findProductIdByFirebaseId(anyString())).thenReturn(null);
        
        Map<String, String> c = new HashMap<>();
        c.put("productId", "gid://shopify/Product/1");
        c.put("variantId", "gid://shopify/ProductVariant/1");
        when(shopifyGraphQLClient.createProduct(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any())).thenReturn(c);

        ShopifyBulkSyncRequest req = new ShopifyBulkSyncRequest();
        req.setLimit(50);
        req.setPage(1);
        ShopifyBulkSyncResponse response = syncService.syncProductsBulk("client_test", req);
        
        assertEquals(50, response.getTotalProcessed());
        assertEquals(50, response.getCreated());
        assertEquals(0, response.getFailed());
    }

    // -----------------------------------------------------------------------
    // TEST: unique Firebase productId
    // -----------------------------------------------------------------------
    @Test
    void testSyncProductsBulk_UniqueFirebaseProductId() throws Exception {
        List<Product> products = new ArrayList<>();
        Product p1 = new Product();
        p1.setId("doc_unique_1");
        p1.setProductCode("CODE_1");
        p1.setProductName("Product 1");
        p1.setBasePrice(100.0);
        products.add(p1);

        Product p2 = new Product();
        p2.setId("doc_unique_2");
        p2.setProductCode("CODE_2");
        p2.setProductName("Product 2");
        p2.setBasePrice(200.0);
        products.add(p2);

        ClientProductOverride o1 = new ClientProductOverride();
        o1.setSellingPrice(150.0);
        when(overrideRepository.findByClientAndProduct("client_test", "doc_unique_1")).thenReturn(o1);

        ClientProductOverride o2 = new ClientProductOverride();
        o2.setSellingPrice(250.0);
        when(overrideRepository.findByClientAndProduct("client_test", "doc_unique_2")).thenReturn(o2);

        when(productRepository.findAllProducts(10, 0)).thenReturn(new PagedResult<>(products, 2));
        when(shopifyGraphQLClient.findProductIdByFirebaseId("doc_unique_1")).thenReturn(null);
        when(shopifyGraphQLClient.findProductIdByFirebaseId("doc_unique_2")).thenReturn(null);

        Map<String, String> c1 = Map.of("productId", "gid://shopify/Product/1", "variantId", "gid://shopify/ProductVariant/1");
        Map<String, String> c2 = Map.of("productId", "gid://shopify/Product/2", "variantId", "gid://shopify/ProductVariant/2");
        when(shopifyGraphQLClient.createProduct(anyString(), anyString(), anyString(), anyString(), any(), any(), anyString(), any(), any(), anyString(), any(), any(), any())).thenReturn(c1);
        when(shopifyGraphQLClient.createProduct(anyString(), anyString(), anyString(), anyString(), any(), any(), anyString(), any(), any(), anyString(), any(), any(), any())).thenReturn(c2);

        ShopifyBulkSyncRequest req = new ShopifyBulkSyncRequest();
        req.setLimit(10);
        req.setPage(1);

        ShopifyBulkSyncResponse response = syncService.syncProductsBulk("client_test", req);
        assertEquals(2, response.getCreated());
        assertEquals(0, response.getAlreadyExists());
        assertEquals(0, response.getConflict());
        assertEquals(0, response.getFailed());
        assertEquals("doc_unique_1", response.getResults().get(0).getProductId());
        assertEquals("doc_unique_2", response.getResults().get(1).getProductId());
    }

    // -----------------------------------------------------------------------
    // RULE M: same productCode with different Firebase productIds continues to work independently
    // -----------------------------------------------------------------------
    @Test
    void testSyncProductsBulk_SameProductCode_DifferentProductIds() throws Exception {
        List<Product> products = new ArrayList<>();
        Product p1 = new Product();
        p1.setId("doc_837_a");
        p1.setProductCode("837");
        p1.setProductName("Watch 837 Style A");
        p1.setBasePrice(499.0);
        products.add(p1);

        Product p2 = new Product();
        p2.setId("doc_837_b");
        p2.setProductCode("837");
        p2.setProductName("Watch 837 Style B");
        p2.setBasePrice(599.0);
        products.add(p2);

        ClientProductOverride o1 = new ClientProductOverride();
        o1.setSellingPrice(550.0);
        when(overrideRepository.findByClientAndProduct("client_test", "doc_837_a")).thenReturn(o1);

        ClientProductOverride o2 = new ClientProductOverride();
        o2.setSellingPrice(650.0);
        when(overrideRepository.findByClientAndProduct("client_test", "doc_837_b")).thenReturn(o2);

        when(productRepository.findAllProducts(10, 0)).thenReturn(new PagedResult<>(products, 2));
        when(shopifyGraphQLClient.findProductIdByFirebaseId("doc_837_a")).thenReturn(null);
        when(shopifyGraphQLClient.findProductIdByFirebaseId("doc_837_b")).thenReturn(null);

        Map<String, String> c1 = Map.of("productId", "gid://shopify/Product/101", "variantId", "gid://shopify/ProductVariant/101");
        Map<String, String> c2 = Map.of("productId", "gid://shopify/Product/102", "variantId", "gid://shopify/ProductVariant/102");
        org.mockito.Mockito.doReturn(c1).doReturn(c2)
                .when(shopifyGraphQLClient).createProduct(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any());

        ShopifyBulkSyncRequest req = new ShopifyBulkSyncRequest();
        req.setLimit(10);
        req.setPage(1);

        ShopifyBulkSyncResponse response = syncService.syncProductsBulk("client_test", req);
        assertEquals(2, response.getCreated());
        assertEquals(0, response.getAlreadyExists());
        assertEquals(0, response.getConflict());
        assertEquals(0, response.getFailed());

        verify(shopifyGraphQLClient).findProductIdByFirebaseId("doc_837_a");
        verify(shopifyGraphQLClient).findProductIdByFirebaseId("doc_837_b");
        verify(shopifyGraphQLClient, never()).findProductIdByProductCode(anyString(), anyString());

        assertEquals("gid://shopify/Product/101", response.getResults().get(0).getShopifyProductId());
        assertEquals("gid://shopify/Product/102", response.getResults().get(1).getShopifyProductId());

        verify(shopifyGraphQLClient).updateVariantDetails("gid://shopify/Product/101", "gid://shopify/ProductVariant/101", 550.0, "837");
        verify(shopifyGraphQLClient).updateVariantDetails("gid://shopify/Product/102", "gid://shopify/ProductVariant/102", 650.0, "837");
    }

    // -----------------------------------------------------------------------
    // TEST: exact productId match -> ALREADY_EXISTS
    // -----------------------------------------------------------------------
    @Test
    void testSyncProductsBulk_ExactProductIdMatch_AlreadyExists() throws Exception {
        Product p = new Product();
        p.setId("nvVLkJ9cxcrdXp3UfSMP");
        p.setProductCode("837");
        p.setProductName("Watch 837");
        p.setBasePrice(499.0);

        when(productRepository.findAllProducts(10, 0)).thenReturn(new PagedResult<>(List.of(p), 1));
        ClientProductOverride override = new ClientProductOverride();
        override.setSellingPrice(599.0);
        when(overrideRepository.findByClientAndProduct("client_test", "nvVLkJ9cxcrdXp3UfSMP")).thenReturn(override);
        when(shopifyGraphQLClient.findProductIdByFirebaseId("nvVLkJ9cxcrdXp3UfSMP"))
                .thenReturn("gid://shopify/Product/777");

        ShopifyBulkSyncRequest req = new ShopifyBulkSyncRequest();
        req.setLimit(10);
        req.setPage(1);

        ShopifyBulkSyncResponse response = syncService.syncProductsBulk("client_test", req);
        assertEquals(1, response.getTotalProcessed());
        assertEquals(0, response.getCreated());
        assertEquals(1, response.getAlreadyExists());
        assertEquals(1, response.getUpdated());
        assertEquals(0, response.getFailed());
        assertEquals("ALREADY_EXISTS", response.getResults().get(0).getStatus());
        assertEquals("gid://shopify/Product/777", response.getResults().get(0).getShopifyProductId());
        assertEquals("nvVLkJ9cxcrdXp3UfSMP", response.getResults().get(0).getProductId());

        verify(shopifyGraphQLClient, never()).createProduct(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
        verify(shopifyGraphQLClient, times(1)).updateProduct(
                eq("gid://shopify/Product/777"),
                eq("Watch 837"),
                any(),
                eq("837"),
                eq("nvVLkJ9cxcrdXp3UfSMP"),
                eq(499.0),
                eq(599.0),
                any(), any(), any(), any(), any(), any(), any()
        );
    }

    // -----------------------------------------------------------------------
    // TEST: missing productId -> FAILED
    // -----------------------------------------------------------------------
    @Test
    void testSyncProductsBulk_MissingProductId_Fails() throws Exception {
        Product p = new Product();
        p.setId(null); // Missing productId
        p.setProductCode("837");
        p.setProductName("Watch 837");
        p.setBasePrice(499.0);

        when(productRepository.findAllProducts(10, 0)).thenReturn(new PagedResult<>(List.of(p), 1));

        ShopifyBulkSyncRequest req = new ShopifyBulkSyncRequest();
        req.setLimit(10);
        req.setPage(1);

        ShopifyBulkSyncResponse response = syncService.syncProductsBulk("client_test", req);
        assertEquals(1, response.getTotalProcessed());
        assertEquals(0, response.getCreated());
        assertEquals(0, response.getAlreadyExists());
        assertEquals(1, response.getFailed());
        assertEquals("FAILED", response.getResults().get(0).getStatus());
        assertTrue(response.getResults().get(0).getError().contains("missing Firestore document ID"));

        verify(shopifyGraphQLClient, never()).findProductIdByFirebaseId(any());
        verify(shopifyGraphQLClient, never()).createProduct(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    // -----------------------------------------------------------------------
    // TEST: multiple productId matches -> CONFLICT
    // -----------------------------------------------------------------------
    @Test
    void testSyncProductsBulk_MultipleProductIdMatches_Conflict() throws Exception {
        Product p = new Product();
        p.setId("doc_conflict");
        p.setProductCode("837");
        p.setProductName("Watch 837");
        p.setBasePrice(499.0);

        when(productRepository.findAllProducts(10, 0)).thenReturn(new PagedResult<>(List.of(p), 1));
        ClientProductOverride override = new ClientProductOverride();
        override.setSellingPrice(599.0);
        when(overrideRepository.findByClientAndProduct("client_test", "doc_conflict")).thenReturn(override);
        when(shopifyGraphQLClient.findProductIdByFirebaseId("doc_conflict"))
                .thenThrow(new ShopifyDuplicateConflictException("837", "doc_conflict",
                        List.of("gid://shopify/Product/111", "gid://shopify/Product/222")));

        ShopifyBulkSyncRequest req = new ShopifyBulkSyncRequest();
        req.setLimit(10);
        req.setPage(1);

        ShopifyBulkSyncResponse response = syncService.syncProductsBulk("client_test", req);
        assertEquals(1, response.getTotalProcessed());
        assertEquals(0, response.getCreated());
        assertEquals(0, response.getAlreadyExists());
        assertEquals(1, response.getConflict());
        assertEquals(0, response.getFailed());
        assertEquals("CONFLICT", response.getResults().get(0).getStatus());
        assertNull(response.getResults().get(0).getShopifyProductId());
        assertTrue(response.getResults().get(0).getError().contains("Multiple Shopify products found"));
        assertTrue(response.getResults().get(0).getError().contains("gid://shopify/Product/111"));
        assertTrue(response.getResults().get(0).getError().contains("gid://shopify/Product/222"));

        verify(shopifyGraphQLClient, never()).createProduct(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
        verify(shopifyGraphQLClient, never()).updateVariantPrice(any(), any(), anyDouble());
    }

    @Test
    void testSyncProductsBulk_ImageUploadFailure_DoesNotStopBatch() throws Exception {
        Product p1 = new Product();
        p1.setId("doc_img_1");
        p1.setProductCode("P01");
        p1.setProductName("Product 1");
        p1.setBasePrice(100.0);

        Product p2 = new Product();
        p2.setId("doc_img_2");
        p2.setProductCode("P02");
        p2.setProductName("Product 2 Trial Fail");
        p2.setBasePrice(200.0);

        Product p3 = new Product();
        p3.setId("doc_img_3");
        p3.setProductCode("P03");
        p3.setProductName("Product 3");
        p3.setBasePrice(300.0);

        when(productRepository.findAllProducts(10, 0)).thenReturn(new PagedResult<>(List.of(p1, p2, p3), 3));
        when(shopifyGraphQLClient.findProductIdByFirebaseId(anyString())).thenReturn(null);

        Map<String, String> c1 = Map.of("productId", "gid://shopify/Product/1", "variantId", "gid://shopify/ProductVariant/1");
        Map<String, String> c3 = Map.of("productId", "gid://shopify/Product/3", "variantId", "gid://shopify/ProductVariant/3");

        org.mockito.Mockito.doReturn(c1)
                .doThrow(new RuntimeException("The file is not supported on trial accounts. Select a plan to upload this file."))
                .doReturn(c3)
                .when(shopifyGraphQLClient).createProduct(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any());

        ShopifyBulkSyncRequest req = new ShopifyBulkSyncRequest();
        req.setLimit(10);
        req.setPage(1);

        ShopifyBulkSyncResponse response = syncService.syncProductsBulk("client_test", req);

        assertEquals(3, response.getTotalProcessed());
        assertEquals(2, response.getCreated());
        assertEquals(1, response.getFailed());
        assertEquals("CREATED", response.getResults().get(0).getStatus());
        assertEquals("FAILED", response.getResults().get(1).getStatus());
        assertTrue(response.getResults().get(1).getError().contains("trial accounts"));
        assertEquals("CREATED", response.getResults().get(2).getStatus());
    }

    @Test
    void testSyncProductsBulk_IdempotentSecondSync() throws Exception {
        Product p1 = new Product();
        p1.setId("doc_idem_1");
        p1.setProductCode("IDEM1");
        p1.setProductName("Idempotent 1");
        p1.setBasePrice(100.0);

        Product p2 = new Product();
        p2.setId("doc_idem_2");
        p2.setProductCode("IDEM2");
        p2.setProductName("Idempotent 2");
        p2.setBasePrice(200.0);

        when(productRepository.findAllProducts(10, 0)).thenReturn(new PagedResult<>(List.of(p1, p2), 2));

        // FIRST RUN: products do not exist in Shopify -> created
        when(shopifyGraphQLClient.findProductIdByFirebaseId("doc_idem_1")).thenReturn(null);
        when(shopifyGraphQLClient.findProductIdByFirebaseId("doc_idem_2")).thenReturn(null);

        Map<String, String> c1 = Map.of("productId", "gid://shopify/Product/1001", "variantId", "gid://shopify/ProductVariant/1001");
        Map<String, String> c2 = Map.of("productId", "gid://shopify/Product/1002", "variantId", "gid://shopify/ProductVariant/1002");
        when(shopifyGraphQLClient.createProduct(anyString(), anyString(), anyString(), anyString(), any(), any(), anyString(), any(), any(), anyString(), any(), any(), any())).thenReturn(c1);
        when(shopifyGraphQLClient.createProduct(anyString(), anyString(), anyString(), anyString(), any(), any(), anyString(), any(), any(), anyString(), any(), any(), any())).thenReturn(c2);

        ShopifyBulkSyncRequest req = new ShopifyBulkSyncRequest();
        req.setLimit(10);
        req.setPage(1);

        ShopifyBulkSyncResponse firstResponse = syncService.syncProductsBulk("client_test", req);
        assertEquals(2, firstResponse.getCreated());
        assertEquals(0, firstResponse.getAlreadyExists());
        assertEquals(0, firstResponse.getUpdated());

        // SECOND RUN: products already exist in Shopify -> updated, never created again
        when(shopifyGraphQLClient.findProductIdByFirebaseId("doc_idem_1")).thenReturn("gid://shopify/Product/1001");
        when(shopifyGraphQLClient.findProductIdByFirebaseId("doc_idem_2")).thenReturn("gid://shopify/Product/1002");

        ShopifyBulkSyncResponse secondResponse = syncService.syncProductsBulk("client_test", req);
        assertEquals(0, secondResponse.getCreated(), "Must not create duplicate products on second sync");
        assertEquals(2, secondResponse.getAlreadyExists());
        assertEquals(2, secondResponse.getUpdated());

        verify(shopifyGraphQLClient, times(1)).updateProduct(eq("gid://shopify/Product/1001"), eq("Idempotent 1"), any(), eq("IDEM1"), eq("doc_idem_1"), eq(100.0), eq(100.0), any(), any(), any(), any(), any(), any(), any());
        verify(shopifyGraphQLClient, times(1)).updateProduct(eq("gid://shopify/Product/1002"), eq("Idempotent 2"), any(), eq("IDEM2"), eq("doc_idem_2"), eq(200.0), eq(200.0), any(), any(), any(), any(), any(), any(), any());
    }
}
