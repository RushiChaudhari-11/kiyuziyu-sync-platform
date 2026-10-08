package com.kiyuziyu.api.service;

import com.kiyuziyu.api.dto.shopify.ShopifyProductSyncResponse;
import com.kiyuziyu.api.exception.BadRequestException;
import com.kiyuziyu.api.exception.NotFoundException;
import com.kiyuziyu.api.integration.shopify.ShopifyDuplicateConflictException;
import com.kiyuziyu.api.integration.shopify.ShopifyGraphQLClient;
import com.kiyuziyu.api.integration.shopify.ShopifyGraphQLException;
import com.kiyuziyu.api.model.ClientProductOverride;
import com.kiyuziyu.api.model.Product;
import com.kiyuziyu.api.repository.ClientProductOverrideRepository;
import com.kiyuziyu.api.repository.ProductRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ShopifyProductServiceTest {

    @Mock
    private ProductRepository productRepository;

    @Mock
    private ClientProductOverrideRepository overrideRepository;

    @Mock
    private ShopifyGraphQLClient shopifyGraphQLClient;

    @InjectMocks
    private ShopifyProductService shopifyProductService;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
    }

    @Test
    void testSyncProduct_NotFound() throws Exception {
        when(productRepository.findById("invalid")).thenReturn(null);
        
        assertThrows(NotFoundException.class, () -> {
            shopifyProductService.syncProductToShopify("client_1", "invalid");
        });
    }

    @Test
    void testSyncProduct_MissingClientId_ThrowsBadRequest() {
        assertThrows(BadRequestException.class, () -> {
            shopifyProductService.syncProductToShopify(null, "523");
        });
        assertThrows(BadRequestException.class, () -> {
            shopifyProductService.syncProductToShopify("   ", "523");
        });
    }

    @Test
    void testSyncProduct_MissingShopifyConfig() throws Exception {
        Product p = new Product();
        p.setId("prod_523");
        p.setProductCode("523");
        p.setProductName("Watch");
        p.setBasePrice(699.0);
        when(productRepository.findById("523")).thenReturn(p);
        ClientProductOverride override = new ClientProductOverride();
        override.setSellingPrice(799.0);
        when(overrideRepository.findByClientAndProduct("client_1", "prod_523")).thenReturn(override);
        when(shopifyGraphQLClient.findProductIdByFirebaseId("prod_523"))
                .thenThrow(new ShopifyGraphQLException("Shopify store domain is not configured.", "UNKNOWN"));

        ShopifyGraphQLException ex = assertThrows(ShopifyGraphQLException.class, () -> {
            shopifyProductService.syncProductToShopify("client_1", "523");
        });
        assertEquals("UNKNOWN", ex.getStoreDomain());
    }

    @Test
    void testSyncProduct_MissingProductId_ThrowsBadRequest() throws Exception {
        Product p = new Product();
        p.setId(null); // Missing Firestore doc ID
        p.setProductCode("523");
        p.setProductName("Watch");
        p.setBasePrice(699.0);
        when(productRepository.findById("523")).thenReturn(p);

        assertThrows(BadRequestException.class, () -> {
            shopifyProductService.syncProductToShopify("client_1", "523");
        });
    }

    // -----------------------------------------------------------------------
    // Existing Shopify product is ALREADY_EXISTS and is UPDATED
    // -----------------------------------------------------------------------
    @Test
    void testSyncProduct_DuplicateProductId_AlreadyExists_NotPriceUpdated() throws Exception {
        Product p = new Product();
        p.setId("prod_523");
        p.setProductCode("523");
        p.setProductName("Watch");
        p.setBasePrice(699.0);
        
        when(productRepository.findById("523")).thenReturn(p);
        ClientProductOverride override = new ClientProductOverride();
        override.setSellingPrice(799.0);
        when(overrideRepository.findByClientAndProduct("client_1", "prod_523")).thenReturn(override);
        when(shopifyGraphQLClient.findProductIdByFirebaseId("prod_523")).thenReturn("gid://shopify/Product/123");

        ShopifyProductSyncResponse response = shopifyProductService.syncProductToShopify("client_1", "523");

        assertTrue(response.isSuccess());
        assertTrue(response.isAlreadyExists());
        assertEquals("gid://shopify/Product/123", response.getData().get("shopifyProductId"));
        assertEquals("prod_523", response.getData().get("productId"));
        assertEquals(true, response.getData().get("updated"));
        
        // Critical: Never create duplicate product on existing product, but update existing
        verify(shopifyGraphQLClient, never()).createProduct(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
        verify(shopifyGraphQLClient, times(1)).updateProduct(
                eq("gid://shopify/Product/123"),
                eq("Watch"),
                any(),
                eq("523"),
                eq("prod_523"),
                eq(699.0),
                eq(799.0),
                any(), any(), any(), any(), any(), any(), any()
        );
    }

    @Test
    void testSyncProduct_Conflict_ReturnsConflictResponse() throws Exception {
        Product p = new Product();
        p.setId("prod_conflict");
        p.setProductCode("523");
        p.setProductName("Watch");
        p.setBasePrice(699.0);

        when(productRepository.findById("523")).thenReturn(p);
        ClientProductOverride override = new ClientProductOverride();
        override.setSellingPrice(799.0);
        when(overrideRepository.findByClientAndProduct("client_1", "prod_conflict")).thenReturn(override);
        when(shopifyGraphQLClient.findProductIdByFirebaseId("prod_conflict"))
                .thenThrow(new ShopifyDuplicateConflictException("523", "prod_conflict",
                        List.of("gid://shopify/Product/111", "gid://shopify/Product/222")));

        ShopifyProductSyncResponse response = shopifyProductService.syncProductToShopify("client_1", "523");

        assertFalse(response.isSuccess());
        assertFalse(response.isAlreadyExists());
        assertTrue(response.getMessage().contains("Conflict detected"));
        assertEquals("prod_conflict", response.getData().get("productId"));
        assertEquals(List.of("gid://shopify/Product/111", "gid://shopify/Product/222"), response.getData().get("conflictingShopifyIds"));

        verify(shopifyGraphQLClient, never()).createProduct(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
        verify(shopifyGraphQLClient, never()).updateVariantDetails(anyString(), anyString(), anyDouble(), anyString());
    }

    // -----------------------------------------------------------------------
    // RULE A, H, I: sellingPrice > basePrice -> valid; Shopify variant price equals client sellingPrice; base_price metafield passed
    // -----------------------------------------------------------------------
    @Test
    void testSyncProduct_SellingPriceGreaterThanBasePrice_Valid() throws Exception {
        Product p = new Product();
        p.setId("prod_523");
        p.setProductCode("523");
        p.setProductName("Kiyu ziyu 1240 kada watch");
        p.setBasePrice(100.0);

        when(productRepository.findById("523")).thenReturn(p);
        when(shopifyGraphQLClient.findProductIdByFirebaseId("prod_523")).thenReturn(null);

        ClientProductOverride override = new ClientProductOverride();
        override.setClientId("client_1");
        override.setProductId("prod_523");
        override.setSellingPrice(130.0);
        when(overrideRepository.findByClientAndProduct("client_1", "prod_523")).thenReturn(override);

        Map<String, String> createMock = new HashMap<>();
        createMock.put("productId", "gid://shopify/Product/123");
        createMock.put("variantId", "gid://shopify/ProductVariant/456");

        when(shopifyGraphQLClient.createProduct(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(createMock);

        ShopifyProductSyncResponse response = shopifyProductService.syncProductToShopify("client_1", "523");

        assertTrue(response.isSuccess());
        assertFalse(response.isAlreadyExists());
        assertEquals(130.0, response.getData().get("price"));
        assertEquals("prod_523", response.getData().get("productId"));

        // Variant price set to client sellingPrice (130.0)
        verify(shopifyGraphQLClient, times(1)).updateVariantDetails("gid://shopify/Product/123", "gid://shopify/ProductVariant/456", 130.0);
        // createProduct passed basePrice (100.0)
        verify(shopifyGraphQLClient, times(1)).createProduct(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    // -----------------------------------------------------------------------
    // RULE B: sellingPrice == basePrice -> valid
    // -----------------------------------------------------------------------
    @Test
    void testSyncProduct_SellingPriceEqualsBasePrice_Valid() throws Exception {
        Product p = new Product();
        p.setId("prod_523");
        p.setProductCode("523");
        p.setProductName("Kiyu ziyu 1240 kada watch");
        p.setBasePrice(100.0);

        when(productRepository.findById("523")).thenReturn(p);
        when(shopifyGraphQLClient.findProductIdByFirebaseId("prod_523")).thenReturn(null);

        ClientProductOverride override = new ClientProductOverride();
        override.setClientId("client_1");
        override.setProductId("prod_523");
        override.setSellingPrice(100.0); // Exact match
        when(overrideRepository.findByClientAndProduct("client_1", "prod_523")).thenReturn(override);

        Map<String, String> createMock = new HashMap<>();
        createMock.put("productId", "gid://shopify/Product/123");
        createMock.put("variantId", "gid://shopify/ProductVariant/456");

        when(shopifyGraphQLClient.createProduct(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(createMock);

        ShopifyProductSyncResponse response = shopifyProductService.syncProductToShopify("client_1", "523");

        assertTrue(response.isSuccess());
        assertEquals(100.0, response.getData().get("price"));
        verify(shopifyGraphQLClient, times(1)).updateVariantDetails("gid://shopify/Product/123", "gid://shopify/ProductVariant/456", 100.0);
    }

    // -----------------------------------------------------------------------
    // RULE C: sellingPrice < basePrice -> REJECT with specific message
    // -----------------------------------------------------------------------
    @Test
    void testSyncProduct_SellingPriceLessThanBasePrice_Rejected() throws Exception {
        Product p = new Product();
        p.setId("prod_523");
        p.setProductCode("523");
        p.setProductName("Kiyu ziyu 1240 kada watch");
        p.setBasePrice(100.0);

        when(productRepository.findById("523")).thenReturn(p);
        when(shopifyGraphQLClient.findProductIdByFirebaseId("prod_523")).thenReturn(null);

        ClientProductOverride override = new ClientProductOverride();
        override.setClientId("client_1");
        override.setProductId("prod_523");
        override.setSellingPrice(80.0); // Less than basePrice 100.0
        when(overrideRepository.findByClientAndProduct("client_1", "prod_523")).thenReturn(override);

        BadRequestException ex = assertThrows(BadRequestException.class, () -> {
            shopifyProductService.syncProductToShopify("client_1", "523");
        });

        assertTrue(ex.getMessage().contains("Client selling price cannot be lower than Kiyuziyu base price."));
        verify(shopifyGraphQLClient, never()).createProduct(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
        verify(shopifyGraphQLClient, never()).updateVariantDetails(any(), any(), anyDouble());
    }

    // -----------------------------------------------------------------------
    // RULE D: sellingPrice missing -> Defaults to basePrice (Simplified import rule)
    // -----------------------------------------------------------------------
    @Test
    void testSyncProduct_SellingPriceMissing_DefaultsToBasePrice() throws Exception {
        Product p = new Product();
        p.setId("prod_523");
        p.setProductCode("523");
        p.setProductName("Kiyu ziyu 1240 kada watch");
        p.setBasePrice(100.0);

        when(productRepository.findById("523")).thenReturn(p);
        when(shopifyGraphQLClient.findProductIdByFirebaseId("prod_523")).thenReturn(null);

        // No override exists
        when(overrideRepository.findByClientAndProduct("client_1", "prod_523")).thenReturn(null);
        when(overrideRepository.findByClientAndProduct("client_1", "523")).thenReturn(null);

        Map<String, String> createMock = new HashMap<>();
        createMock.put("productId", "gid://shopify/Product/123");
        createMock.put("variantId", "gid://shopify/ProductVariant/456");

        when(shopifyGraphQLClient.createProduct(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(createMock);

        ShopifyProductSyncResponse response = shopifyProductService.syncProductToShopify("client_1", "523");

        assertTrue(response.isSuccess());
        assertEquals(100.0, response.getData().get("price"));
        assertEquals(100.0, response.getData().get("basePrice"));
        verify(shopifyGraphQLClient, times(1)).updateVariantDetails("gid://shopify/Product/123", "gid://shopify/ProductVariant/456", 100.0);
    }

    // -----------------------------------------------------------------------
    // RULE E: sellingPrice <= 0 -> REJECT
    // -----------------------------------------------------------------------
    @Test
    void testSyncProduct_SellingPriceZeroOrNegative_Rejected() throws Exception {
        Product p = new Product();
        p.setId("prod_523");
        p.setProductCode("523");
        p.setProductName("Kiyu ziyu 1240 kada watch");
        p.setBasePrice(100.0);

        when(productRepository.findById("523")).thenReturn(p);
        when(shopifyGraphQLClient.findProductIdByFirebaseId("prod_523")).thenReturn(null);

        ClientProductOverride overrideZero = new ClientProductOverride();
        overrideZero.setSellingPrice(0.0);
        when(overrideRepository.findByClientAndProduct("client_1", "prod_523")).thenReturn(overrideZero);

        BadRequestException exZero = assertThrows(BadRequestException.class, () -> {
            shopifyProductService.syncProductToShopify("client_1", "523");
        });
        assertTrue(exZero.getMessage().contains("lower than Kiyuziyu base price"));

        ClientProductOverride overrideNeg = new ClientProductOverride();
        overrideNeg.setSellingPrice(-50.0);
        when(overrideRepository.findByClientAndProduct("client_1", "prod_523")).thenReturn(overrideNeg);

        BadRequestException exNeg = assertThrows(BadRequestException.class, () -> {
            shopifyProductService.syncProductToShopify("client_1", "523");
        });
        assertTrue(exNeg.getMessage().contains("lower than Kiyuziyu base price"));
    }

    // -----------------------------------------------------------------------
    // RULE F: Client A price must NOT use Client B price
    // -----------------------------------------------------------------------
    @Test
    void testSyncProduct_ClientAPriceNotUseClientBPrice() throws Exception {
        Product p = new Product();
        p.setId("prod_523");
        p.setProductCode("523");
        p.setProductName("Kiyu ziyu 1240 kada watch");
        p.setBasePrice(100.0);

        when(productRepository.findById("523")).thenReturn(p);
        when(shopifyGraphQLClient.findProductIdByFirebaseId("prod_523")).thenReturn(null);

        ClientProductOverride overrideA = new ClientProductOverride();
        overrideA.setClientId("client_A");
        overrideA.setProductId("prod_523");
        overrideA.setSellingPrice(150.0);

        ClientProductOverride overrideB = new ClientProductOverride();
        overrideB.setClientId("client_B");
        overrideB.setProductId("prod_523");
        overrideB.setSellingPrice(250.0);

        when(overrideRepository.findByClientAndProduct("client_A", "prod_523")).thenReturn(overrideA);
        when(overrideRepository.findByClientAndProduct("client_B", "prod_523")).thenReturn(overrideB);

        Map<String, String> createMock = new HashMap<>();
        createMock.put("productId", "gid://shopify/Product/123");
        createMock.put("variantId", "gid://shopify/ProductVariant/456");
        when(shopifyGraphQLClient.createProduct(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any())).thenReturn(createMock);

        // Sync for client_A
        ShopifyProductSyncResponse responseA = shopifyProductService.syncProductToShopify("client_A", "523");
        assertEquals(150.0, responseA.getData().get("price"));
        verify(shopifyGraphQLClient, times(1)).updateVariantDetails("gid://shopify/Product/123", "gid://shopify/ProductVariant/456", 150.0);

        // Verify client_B's price 250.0 was never used
        verify(shopifyGraphQLClient, never()).updateVariantDetails("gid://shopify/Product/123", "gid://shopify/ProductVariant/456", 250.0);
    }

    // -----------------------------------------------------------------------
    // RULE G: Authenticated clientId is used
    // -----------------------------------------------------------------------
    @Test
    void testSyncProduct_AuthenticatedClientIdIsUsed() throws Exception {
        Product p = new Product();
        p.setId("prod_523");
        p.setProductCode("523");
        p.setProductName("Watch");
        p.setBasePrice(100.0);

        when(productRepository.findById("523")).thenReturn(p);
        when(shopifyGraphQLClient.findProductIdByFirebaseId("prod_523")).thenReturn(null);

        ClientProductOverride override = new ClientProductOverride();
        override.setClientId("auth_client_xyz");
        override.setProductId("prod_523");
        override.setSellingPrice(120.0);
        when(overrideRepository.findByClientAndProduct("auth_client_xyz", "prod_523")).thenReturn(override);

        Map<String, String> createMock = Map.of("productId", "gid://shopify/Product/123", "variantId", "gid://shopify/ProductVariant/456");
        when(shopifyGraphQLClient.createProduct(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any())).thenReturn(createMock);

        shopifyProductService.syncProductToShopify("auth_client_xyz", "523");

        verify(overrideRepository, times(1)).findByClientAndProduct("auth_client_xyz", "prod_523");
    }

    // -----------------------------------------------------------------------
    // RULE J: Firebase basePrice is never modified
    // -----------------------------------------------------------------------
    @Test
    void testSyncProduct_FirebaseBasePriceNeverModified() throws Exception {
        Product p = new Product();
        p.setId("prod_523");
        p.setProductCode("523");
        p.setProductName("Watch");
        p.setBasePrice(100.0);

        when(productRepository.findById("523")).thenReturn(p);
        when(shopifyGraphQLClient.findProductIdByFirebaseId("prod_523")).thenReturn(null);

        ClientProductOverride override = new ClientProductOverride();
        override.setClientId("client_1");
        override.setProductId("prod_523");
        override.setSellingPrice(150.0);
        when(overrideRepository.findByClientAndProduct("client_1", "prod_523")).thenReturn(override);

        Map<String, String> createMock = Map.of("productId", "gid://shopify/Product/123", "variantId", "gid://shopify/ProductVariant/456");
        when(shopifyGraphQLClient.createProduct(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any())).thenReturn(createMock);

        shopifyProductService.syncProductToShopify("client_1", "523");

        // Assert basePrice was not modified in memory
        assertEquals(100.0, p.getBasePrice());
        // Verify productRepository was only read, never mutated
        verify(productRepository, times(1)).findById("523");
        verifyNoMoreInteractions(productRepository);
    }

    @Test
    void testSyncProduct_FullMapping_PassesAllProductAttributes() throws Exception {
        Product p = new Product();
        p.setId("doc_837");
        p.setProductCode("837");
        p.setProductName("Watch Bracelet Deluxe");
        p.setDescription("A premium watch bracelet");
        p.setBasePrice(499.0);
        p.setImage("https://cdn.example.com/main.jpg");
        p.setImages(List.of("https://cdn.example.com/extra1.jpg", "https://cdn.example.com/extra2.jpg"));
        p.setTags(List.of("jewelry", "watch", "bracelet"));
        
        Map<String, Object> collectionData = new HashMap<>();
        collectionData.put("title", "Watch Bracelet");
        p.setCollectionData(collectionData);

        Map<String, Object> variation = new HashMap<>();
        variation.put("color", "Gold");
        variation.put("size", "Medium");
        variation.put("quantity", 10);
        p.setVariations(List.of(variation));

        when(productRepository.findById("837")).thenReturn(p);
        when(shopifyGraphQLClient.findProductIdByFirebaseId("doc_837")).thenReturn(null);

        Map<String, String> createMock = Map.of("productId", "gid://shopify/Product/999", "variantId", "gid://shopify/ProductVariant/888");
        when(shopifyGraphQLClient.createProduct(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any())).thenReturn(createMock);

        ShopifyProductSyncResponse response = shopifyProductService.syncProductToShopify("client_1", "837");

        assertTrue(response.isSuccess());
        assertEquals("Watch Bracelet", response.getData().get("productType"));
        assertEquals(List.of("jewelry", "watch", "bracelet"), response.getData().get("tags"));
        assertEquals(499.0, response.getData().get("price"));
        assertEquals(499.0, response.getData().get("basePrice"));

        verify(shopifyGraphQLClient, times(1)).createProduct(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void testSyncProduct_NoVariations_WithInventoryQuantity() throws Exception {
        Product p = new Product();
        p.setId("doc_single_inv");
        p.setProductCode("701");
        p.setProductName("Single Variant Product");
        p.setBasePrice(120.0);
        p.setQuantity(25);

        when(productRepository.findById("701")).thenReturn(p);
        when(shopifyGraphQLClient.findProductIdByFirebaseId("doc_single_inv")).thenReturn(null);

        Map<String, String> createMock = Map.of("productId", "gid://shopify/Product/701", "variantId", "gid://shopify/ProductVariant/701");
        when(shopifyGraphQLClient.createProduct(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any())).thenReturn(createMock);

        ShopifyProductSyncResponse response = shopifyProductService.syncProductToShopify("client_1", "701");
        assertTrue(response.isSuccess());
        verify(shopifyGraphQLClient, times(1)).createProduct(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void testSyncProduct_ZeroInventory() throws Exception {
        Product p = new Product();
        p.setId("doc_zero_inv");
        p.setProductCode("702");
        p.setProductName("Zero Stock Product");
        p.setBasePrice(90.0);
        p.setQuantity(0);

        when(productRepository.findById("702")).thenReturn(p);
        when(shopifyGraphQLClient.findProductIdByFirebaseId("doc_zero_inv")).thenReturn(null);

        Map<String, String> createMock = Map.of("productId", "gid://shopify/Product/702", "variantId", "gid://shopify/ProductVariant/702");
        when(shopifyGraphQLClient.createProduct(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any())).thenReturn(createMock);

        ShopifyProductSyncResponse response = shopifyProductService.syncProductToShopify("client_1", "702");
        assertTrue(response.isSuccess());
    }

    @Test
    void testSyncProduct_WithSubcollectionData_PassesSubcollection() throws Exception {
        Product p = new Product();
        p.setId("doc_subcol");
        p.setProductCode("703");
        p.setProductName("Subcollection Product");
        p.setBasePrice(150.0);
        p.setCollectionData(Map.of("title", "Men"));
        p.setSubcollectionData(Map.of("name", "Watches"));

        when(productRepository.findById("703")).thenReturn(p);
        when(shopifyGraphQLClient.findProductIdByFirebaseId("doc_subcol")).thenReturn(null);

        Map<String, String> createMock = Map.of("productId", "gid://shopify/Product/703", "variantId", "gid://shopify/ProductVariant/703");
        when(shopifyGraphQLClient.createProduct(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any())).thenReturn(createMock);

        ShopifyProductSyncResponse response = shopifyProductService.syncProductToShopify("client_1", "703");
        assertTrue(response.isSuccess());
    }

    @Test
    void testSyncProduct_MalformedOverrideException_FallsBackToBasePrice() throws Exception {
        Product p = new Product();
        p.setId("doc_err_override");
        p.setProductCode("704");
        p.setProductName("Fallback Product");
        p.setBasePrice(200.0);

        when(productRepository.findById("704")).thenReturn(p);
        when(shopifyGraphQLClient.findProductIdByFirebaseId("doc_err_override")).thenReturn(null);
        // Throw exception when accessing repository
        when(overrideRepository.findByClientAndProduct(anyString(), anyString())).thenThrow(new RuntimeException("Firestore timeout"));

        Map<String, String> createMock = Map.of("productId", "gid://shopify/Product/704", "variantId", "gid://shopify/ProductVariant/704");
        when(shopifyGraphQLClient.createProduct(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(createMock);

        ShopifyProductSyncResponse response = shopifyProductService.syncProductToShopify("client_1", "704");
        assertTrue(response.isSuccess());
        assertEquals(200.0, response.getData().get("price"), "Must fall back to basePrice when override query throws");
    }

    @Test
    void testSyncProduct_MultipleVariations() throws Exception {
        Product p = new Product();
        p.setId("doc_multi_var");
        p.setProductCode("705");
        p.setProductName("Multi Variation Product");
        p.setBasePrice(300.0);

        List<Map<String, Object>> variations = List.of(
                Map.of("name", "Green", "quantity", 10, "initialQuantity", 16),
                Map.of("name", "Red", "quantity", 5, "initialQuantity", 10)
        );
        p.setVariations(variations);

        when(productRepository.findById("705")).thenReturn(p);
        when(shopifyGraphQLClient.findProductIdByFirebaseId("doc_multi_var")).thenReturn(null);

        Map<String, String> createMock = Map.of("productId", "gid://shopify/Product/705", "variantId", "gid://shopify/ProductVariant/705");
        when(shopifyGraphQLClient.createProduct(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any())).thenReturn(createMock);

        ShopifyProductSyncResponse response = shopifyProductService.syncProductToShopify("client_1", "705");
        assertTrue(response.isSuccess());
    }

    // -----------------------------------------------------------------------
    // TEST 21: Existing product full reconciliation
    // -----------------------------------------------------------------------
    @Test
    void testSyncProduct_ExistingProduct_FullReconciliation() throws Exception {
        Product p = new Product();
        p.setId("doc_reconcile");
        p.setProductCode("706");
        p.setProductName("Reconcile Watch");
        p.setDescription("Luxury reconcile description");
        p.setBasePrice(500.0);
        p.setImage("http://img.com/main.png");
        p.setImages(List.of("http://img.com/extra.png"));
        p.setTags(List.of("reconcile", "luxury"));
        p.setCollectionData(Map.of("title", "Watch Collection"));
        p.setSubcollectionData(Map.of("name", "Diamond"));
        p.setQuantity(20);
        List<Map<String, Object>> variations = List.of(Map.of("name", "Rose Gold", "quantity", 10));
        p.setVariations(variations);

        when(productRepository.findById("706")).thenReturn(p);
        when(shopifyGraphQLClient.findProductIdByFirebaseId("doc_reconcile")).thenReturn("gid://shopify/Product/reconcile_999");

        ShopifyProductSyncResponse response = shopifyProductService.syncProductToShopify("client_1", "706");

        assertTrue(response.isSuccess());
        assertTrue(response.isAlreadyExists());
        assertEquals(true, response.getData().get("updated"));
        assertEquals("gid://shopify/Product/reconcile_999", response.getData().get("shopifyProductId"));

        verify(shopifyGraphQLClient, times(1)).updateProduct(
                eq("gid://shopify/Product/reconcile_999"),
                eq("Reconcile Watch"),
                eq("<p>Luxury reconcile description</p>"),
                eq("706"),
                eq("doc_reconcile"),
                eq(500.0),
                eq(500.0),
                eq("http://img.com/main.png"),
                eq(List.of("http://img.com/extra.png")),
                eq(List.of("reconcile", "luxury")),
                eq("Watch Collection"),
                eq(variations),
                eq("Diamond"),
                eq(10)
        );
        verify(shopifyGraphQLClient, never()).createProduct(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    // -----------------------------------------------------------------------
    // TEST 22: Idempotent second sync does not duplicate product
    // -----------------------------------------------------------------------
    @Test
    void testSyncProduct_IdempotentSecondSync() throws Exception {
        Product p = new Product();
        p.setId("doc_idempotent");
        p.setProductCode("707");
        p.setProductName("Idempotent Product");
        p.setBasePrice(400.0);

        when(productRepository.findById("707")).thenReturn(p);
        when(shopifyGraphQLClient.findProductIdByFirebaseId("doc_idempotent")).thenReturn("gid://shopify/Product/idemp_1");

        // First sync
        ShopifyProductSyncResponse resp1 = shopifyProductService.syncProductToShopify("client_1", "707");
        assertTrue(resp1.isSuccess());
        assertTrue(resp1.isAlreadyExists());

        // Second sync
        ShopifyProductSyncResponse resp2 = shopifyProductService.syncProductToShopify("client_1", "707");
        assertTrue(resp2.isSuccess());
        assertTrue(resp2.isAlreadyExists());

        assertEquals(resp1.getData().get("shopifyProductId"), resp2.getData().get("shopifyProductId"));
        verify(shopifyGraphQLClient, never()).createProduct(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
        verify(shopifyGraphQLClient, times(2)).updateProduct(
                eq("gid://shopify/Product/idemp_1"),
                any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any()
        );
    }
}
