package com.kiyuziyu.api.service;

import com.google.cloud.firestore.*;
import com.kiyuziyu.api.model.Product;
import com.kiyuziyu.api.model.ShopifyConnection;
import com.kiyuziyu.api.model.ShopifyProductMapping;
import com.kiyuziyu.api.model.TenantOrder;
import com.kiyuziyu.api.repository.ProductRepository;
import com.kiyuziyu.api.repository.ShopifyConnectionRepository;
import com.kiyuziyu.api.repository.ShopifyProductMappingRepository;
import com.kiyuziyu.api.repository.TenantOrderRepository;
import com.kiyuziyu.api.util.ShopifySkuParser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.*;
import java.util.concurrent.ExecutionException;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

public class ShopifyVariantOrderRegressionTest {

    @Mock
    private Firestore firestore;

    @Mock
    private ProductRepository productRepository;

    @Mock
    private ShopifyProductMappingRepository shopifyProductMappingRepository;

    @Mock
    private ShopifyConnectionRepository shopifyConnectionRepository;

    @Mock
    private TenantOrderRepository tenantOrderRepository;

    @InjectMocks
    private ShopifyOrderWebhookService orderWebhookService;

    private Product ringProduct;
    private Product chainProduct;
    private ShopifyProductMapping ringMapping;
    private ShopifyProductMapping chainMapping;

    @BeforeEach
    void setUp() throws ExecutionException, InterruptedException {
        MockitoAnnotations.openMocks(this);
        ReflectionTestUtils.setField(orderWebhookService, "firestore", firestore);
        ReflectionTestUtils.setField(orderWebhookService, "productRepository", productRepository);
        ReflectionTestUtils.setField(orderWebhookService, "shopifyProductMappingRepository", shopifyProductMappingRepository);
        ReflectionTestUtils.setField(orderWebhookService, "shopifyConnectionRepository", shopifyConnectionRepository);
        ReflectionTestUtils.setField(orderWebhookService, "tenantOrderRepository", tenantOrderRepository);

        // Setup ring product with 3 variations (matching actual Firestore document 5kl6FDPFB9xlPgHLeOq3)
        ringProduct = new Product();
        ringProduct.setId("5kl6FDPFB9xlPgHLeOq3");
        ringProduct.setProductName("Kiyu ziyu g rings ");
        ringProduct.setProductCode("A-3/ 3 in 1 colour rings ");
        ringProduct.setCollectionId("v88gO6nhwPPHFf6r6C0C");
        ringProduct.setSubcollectionId("WNszzXYULpCb0pgcJpl4");
        ringProduct.setQuantity(11);
        ringProduct.setBasePrice(140.0);
        ringProduct.setPurchaseRate(125.0);

        List<Map<String, Object>> ringVars = new ArrayList<>();
        Map<String, Object> var1 = new HashMap<>();
        var1.put("size", "Size 6 ");
        var1.put("color", "");
        var1.put("quantity", 4);
        var1.put("initialQuantity", 5);
        ringVars.add(var1);

        Map<String, Object> var2 = new HashMap<>();
        var2.put("size", "Size 7 ");
        var2.put("color", "");
        var2.put("quantity", 4);
        var2.put("initialQuantity", 1);
        ringVars.add(var2);

        Map<String, Object> var3 = new HashMap<>();
        var3.put("size", "Size 8");
        var3.put("color", "");
        var3.put("quantity", 3);
        var3.put("initialQuantity", 1);
        ringVars.add(var3);

        ringProduct.setVariations(ringVars);

        // Setup chain product (non-variant SKU 903)
        chainProduct = new Product();
        chainProduct.setId("mgrMvw5lI2T7B2jk7Gsm");
        chainProduct.setProductName("H hand chain");
        chainProduct.setProductCode("903");
        chainProduct.setCollectionId("dhbzF8iOjx7zN6JFpdzu");
        chainProduct.setSubcollectionId("rgnnzz06cCF9UOuKVzGC");
        chainProduct.setQuantity(2);
        chainProduct.setBasePrice(195.0);
        chainProduct.setPurchaseRate(170.0);
        chainProduct.setVariations(null);

        // Mappings
        ringMapping = new ShopifyProductMapping("map_ring", "g0usC1NMyehaoSKJRhOqUUhZAO62", "store_3db44654fc9b", "conn_1",
                "5kl6FDPFB9xlPgHLeOq3", "A-3/ 3 in 1 colour rings ", "gid://shopify/Product/10241636598016", null, "MAPPED", "", "");
        chainMapping = new ShopifyProductMapping("map_chain", "g0usC1NMyehaoSKJRhOqUUhZAO62", "store_3db44654fc9b", "conn_1",
                "mgrMvw5lI2T7B2jk7Gsm", "903", "gid://shopify/Product/9999999999999", null, "MAPPED", "", "");

        // Mock repositories
        when(shopifyProductMappingRepository.findByShopifyProductId("10241636598016")).thenReturn(ringMapping);
        when(shopifyProductMappingRepository.findByShopifyProductId("gid://shopify/Product/10241636598016")).thenReturn(ringMapping);
        when(shopifyProductMappingRepository.findBySkuOrProductCode("A-3/ 3 in 1 colour rings")).thenReturn(ringMapping);
        when(shopifyProductMappingRepository.findBySkuOrProductCode("A-3/ 3 in 1 colour rings-1")).thenReturn(ringMapping);
        when(shopifyProductMappingRepository.findBySkuOrProductCode("A-3/ 3 in 1 colour rings-2")).thenReturn(ringMapping);
        when(shopifyProductMappingRepository.findBySkuOrProductCode("A-3/ 3 in 1 colour rings-3")).thenReturn(ringMapping);

        when(shopifyProductMappingRepository.findByShopifyProductId("9999999999999")).thenReturn(chainMapping);
        when(shopifyProductMappingRepository.findBySkuOrProductCode("903")).thenReturn(chainMapping);

        when(productRepository.findByDocumentId("5kl6FDPFB9xlPgHLeOq3")).thenReturn(ringProduct);
        when(productRepository.findByDocumentId("mgrMvw5lI2T7B2jk7Gsm")).thenReturn(chainProduct);
        when(productRepository.findById("903")).thenReturn(chainProduct);
        when(productRepository.findById("A-3/ 3 in 1 colour rings")).thenReturn(ringProduct);
        when(productRepository.findById("A-3/ 3 in 1 colour rings ")).thenReturn(ringProduct);

        when(tenantOrderRepository.acquireLock(anyString(), anyString())).thenReturn(true);

        // Firestore mock for orders collection check (no existing order initially)
        CollectionReference ordersCol = mock(CollectionReference.class);
        when(firestore.collection(TenantOrderRepository.COLLECTION_NAME)).thenReturn(ordersCol);
        Query orderQuery = mock(Query.class);
        when(ordersCol.whereEqualTo(eq("shopifyOrderId"), any())).thenReturn(orderQuery);
        when(orderQuery.limit(1)).thenReturn(orderQuery);
        com.google.api.core.ApiFuture<QuerySnapshot> futureSnap = mock(com.google.api.core.ApiFuture.class);
        QuerySnapshot emptySnap = mock(QuerySnapshot.class);
        when(emptySnap.isEmpty()).thenReturn(true);
        when(futureSnap.get()).thenReturn(emptySnap);
        when(orderQuery.get()).thenReturn(futureSnap);

        // Firestore mock for product document updates
        CollectionReference colsRef = mock(CollectionReference.class);
        when(firestore.collection("collections")).thenReturn(colsRef);
        DocumentReference colRef = mock(DocumentReference.class);
        when(colsRef.document(anyString())).thenReturn(colRef);
        CollectionReference subsRef = mock(CollectionReference.class);
        when(colRef.collection("subcollections")).thenReturn(subsRef);
        DocumentReference subRef = mock(DocumentReference.class);
        when(subsRef.document(anyString())).thenReturn(subRef);
        CollectionReference prodsRef = mock(CollectionReference.class);
        when(subRef.collection("products")).thenReturn(prodsRef);
        DocumentReference prodRef = mock(DocumentReference.class);
        when(prodsRef.document(anyString())).thenReturn(prodRef);
        com.google.api.core.ApiFuture<WriteResult> writeFuture = mock(com.google.api.core.ApiFuture.class);
        when(prodRef.update(anyMap())).thenReturn(writeFuture);
    }

    @Test
    @DisplayName("ShopifySkuParser correctly extracts base product code and variant indices for complex punctuation SKUs")
    void testShopifySkuParser() {
        // Test base SKU without variant suffix
        ShopifySkuParser.SkuParseResult baseResult = ShopifySkuParser.parse("A-3/ 3 in 1 colour rings");
        assertEquals("A-3/ 3 in 1 colour rings", baseResult.getBaseProductCode());
        assertEquals(-1, baseResult.getVariantIndex());
        assertFalse(baseResult.hasVariantSuffix());

        // Test suffix -1
        ShopifySkuParser.SkuParseResult res1 = ShopifySkuParser.parse("A-3/ 3 in 1 colour rings-1");
        assertEquals("A-3/ 3 in 1 colour rings", res1.getBaseProductCode());
        assertEquals(0, res1.getVariantIndex()); // 0-based
        assertTrue(res1.hasVariantSuffix());

        // Test suffix -2
        ShopifySkuParser.SkuParseResult res2 = ShopifySkuParser.parse("A-3/ 3 in 1 colour rings-2");
        assertEquals("A-3/ 3 in 1 colour rings", res2.getBaseProductCode());
        assertEquals(1, res2.getVariantIndex());
        assertTrue(res2.hasVariantSuffix());

        // Test suffix -3
        ShopifySkuParser.SkuParseResult res3 = ShopifySkuParser.parse("A-3/ 3 in 1 colour rings-3");
        assertEquals("A-3/ 3 in 1 colour rings", res3.getBaseProductCode());
        assertEquals(2, res3.getVariantIndex());
        assertTrue(res3.hasVariantSuffix());

        // Test non-variant SKU 903
        ShopifySkuParser.SkuParseResult res903 = ShopifySkuParser.parse("903");
        assertEquals("903", res903.getBaseProductCode());
        assertEquals(-1, res903.getVariantIndex());
        assertFalse(res903.hasVariantSuffix());

        // Test space resilience
        ShopifySkuParser.SkuParseResult resSpaced = ShopifySkuParser.parse("A-3/ 3 in 1 colour rings - 2");
        assertEquals("A-3/ 3 in 1 colour rings", resSpaced.getBaseProductCode());
        assertEquals(1, resSpaced.getVariantIndex());

        // Test matchesBaseProductCode with trailing spaces in productCode
        assertTrue(ShopifySkuParser.matchesBaseProductCode("A-3/ 3 in 1 colour rings-1", "A-3/ 3 in 1 colour rings "));
        assertTrue(ShopifySkuParser.matchesBaseProductCode("A-3/ 3 in 1 colour rings-2", "A-3/ 3 in 1 colour rings "));
        assertTrue(ShopifySkuParser.matchesBaseProductCode("A-3/ 3 in 1 colour rings-3", "A-3/ 3 in 1 colour rings "));
        assertTrue(ShopifySkuParser.matchesBaseProductCode("903", "903"));
    }

    @Test
    @DisplayName("Mixed Order with variant SKUs (-1, -2, -3) and non-variant SKU 903 preserves all 4 items and decrements stock")
    void testMixedVariantOrderProcessing() throws Exception {
        Map<String, Object> payload = new HashMap<>();
        payload.put("id", 7268536221952L);
        payload.put("order_number", 1035);
        payload.put("financial_status", "pending");

        List<Map<String, Object>> lineItems = new ArrayList<>();

        // Variant 1: Size 8
        Map<String, Object> item1 = new HashMap<>();
        item1.put("product_id", 10241636598016L);
        item1.put("variant_id", 50730105831680L);
        item1.put("sku", "A-3/ 3 in 1 colour rings-3");
        item1.put("title", "Kiyu ziyu g rings");
        item1.put("variant_title", "Size 8");
        item1.put("quantity", 1);
        item1.put("price", "144.00");
        lineItems.add(item1);

        // Variant 2: Size 7
        Map<String, Object> item2 = new HashMap<>();
        item2.put("product_id", 10241636598016L);
        item2.put("variant_id", 50730105798912L);
        item2.put("sku", "A-3/ 3 in 1 colour rings-2");
        item2.put("title", "Kiyu ziyu g rings");
        item2.put("variant_title", "Size 7");
        item2.put("quantity", 1);
        item2.put("price", "144.00");
        lineItems.add(item2);

        // Variant 3: Size 6
        Map<String, Object> item3 = new HashMap<>();
        item3.put("product_id", 10241636598016L);
        item3.put("variant_id", 50730105766144L);
        item3.put("sku", "A-3/ 3 in 1 colour rings-1");
        item3.put("title", "Kiyu ziyu g rings");
        item3.put("variant_title", "Size 6");
        item3.put("quantity", 1);
        item3.put("price", "144.00");
        lineItems.add(item3);

        // Non-variant item: SKU 903
        Map<String, Object> item4 = new HashMap<>();
        item4.put("product_id", 9999999999999L);
        item4.put("variant_id", 50730106519808L);
        item4.put("sku", "903");
        item4.put("title", "H hand chain");
        item4.put("variant_title", null);
        item4.put("quantity", 1);
        item4.put("price", "200.00");
        lineItems.add(item4);

        payload.put("line_items", lineItems);

        // Process webhook
        orderWebhookService.processOrderWebhook("g0usC1NMyehaoSKJRhOqUUhZAO62", "kiyuziyu-test-store.myshopify.com", payload);

        // Verify order saved with exactly 4 items
        ArgumentCaptor<TenantOrder> orderCaptor = ArgumentCaptor.forClass(TenantOrder.class);
        verify(tenantOrderRepository, times(1)).save(orderCaptor.capture());

        TenantOrder savedOrder = orderCaptor.getValue();
        assertNotNull(savedOrder);
        assertEquals(4, savedOrder.getItems().size(), "Tenant order must contain all 4 line items");
        assertEquals(632.0, savedOrder.getTotalSellingPrice(), 0.01, "Total selling price must be $632.00");

        // Verify variant items in order
        boolean foundSize6 = false, foundSize7 = false, foundSize8 = false, foundChain = false;
        for (var it : savedOrder.getItems()) {
            if ("Size 6".equalsIgnoreCase(it.getVariantName())) {
                foundSize6 = true;
                assertEquals("A-3/ 3 in 1 colour rings-1", it.getSku());
                assertEquals(144.0, it.getSellingPrice(), 0.01);
            }
            if ("Size 7".equalsIgnoreCase(it.getVariantName())) {
                foundSize7 = true;
                assertEquals("A-3/ 3 in 1 colour rings-2", it.getSku());
                assertEquals(144.0, it.getSellingPrice(), 0.01);
            }
            if ("Size 8".equalsIgnoreCase(it.getVariantName())) {
                foundSize8 = true;
                assertEquals("A-3/ 3 in 1 colour rings-3", it.getSku());
                assertEquals(144.0, it.getSellingPrice(), 0.01);
            }
            if ("903".equalsIgnoreCase(it.getSku())) {
                foundChain = true;
                assertEquals("H hand chain", it.getProductName());
                assertEquals(200.0, it.getSellingPrice(), 0.01);
            }
        }
        assertTrue(foundSize6, "Size 6 variant item must be present");
        assertTrue(foundSize7, "Size 7 variant item must be present");
        assertTrue(foundSize8, "Size 8 variant item must be present");
        assertTrue(foundChain, "Non-variant 903 item must be present");

        // Verify variant stock decrements:
        // Size 6: 4 -> 3
        // Size 7: 4 -> 3
        // Size 8: 3 -> 2
        // Total ring quantity: 11 -> 8 (decremented by 3)
        // Non-variant 903 quantity: 2 -> 1 (decremented by 1)
        List<Map<String, Object>> updatedVars = ringProduct.getVariations();
        assertEquals(3, ((Number) updatedVars.get(0).get("quantity")).intValue(), "Size 6 quantity decremented to 3");
        assertEquals(3, ((Number) updatedVars.get(1).get("quantity")).intValue(), "Size 7 quantity decremented to 3");
        assertEquals(2, ((Number) updatedVars.get(2).get("quantity")).intValue(), "Size 8 quantity decremented to 2");
        assertEquals(8, ((Number) ringProduct.getQuantity()).intValue(), "Total ring product quantity decremented to 8");
        assertEquals(1, ((Number) chainProduct.getQuantity()).intValue(), "Chain product quantity decremented to 1");
    }

    @Test
    @DisplayName("Webhook retry on complete order does not duplicate inventory deductions")
    void testWebhookRetryDoesNotDoubleDeduct() throws ExecutionException, InterruptedException {
        // Mock existing order with complete 4 items in Firestore
        CollectionReference ordersCol = mock(CollectionReference.class);
        when(firestore.collection(TenantOrderRepository.COLLECTION_NAME)).thenReturn(ordersCol);
        Query orderQuery = mock(Query.class);
        when(ordersCol.whereEqualTo(eq("shopifyOrderId"), any())).thenReturn(orderQuery);
        when(orderQuery.limit(1)).thenReturn(orderQuery);

        com.google.api.core.ApiFuture<QuerySnapshot> futureSnap = mock(com.google.api.core.ApiFuture.class);
        QuerySnapshot completeSnap = mock(QuerySnapshot.class);
        QueryDocumentSnapshot existingDoc = mock(QueryDocumentSnapshot.class);
        DocumentReference docRef = mock(DocumentReference.class);
        com.google.api.core.ApiFuture<WriteResult> updateFuture = mock(com.google.api.core.ApiFuture.class);
        when(docRef.update(anyMap())).thenReturn(updateFuture);
        when(existingDoc.getReference()).thenReturn(docRef);

        List<Map<String, Object>> existingItems = List.of(
                Map.of("sku", "A-3/ 3 in 1 colour rings-1", "variantName", "Size 6", "quantity", 1),
                Map.of("sku", "A-3/ 3 in 1 colour rings-2", "variantName", "Size 7", "quantity", 1),
                Map.of("sku", "A-3/ 3 in 1 colour rings-3", "variantName", "Size 8", "quantity", 1),
                Map.of("sku", "903", "quantity", 1)
        );
        when(existingDoc.get("items")).thenReturn(existingItems);
        when(existingDoc.getId()).thenReturn("order_g0usC1NMyehaoSKJRhOqUUhZAO62_7268536221952");
        when(completeSnap.isEmpty()).thenReturn(false);
        when(completeSnap.getDocuments()).thenReturn(Collections.singletonList(existingDoc));
        when(futureSnap.get()).thenReturn(completeSnap);
        when(orderQuery.get()).thenReturn(futureSnap);

        Map<String, Object> payload = new HashMap<>();
        payload.put("id", 7268536221952L);
        payload.put("order_number", 1035);
        payload.put("financial_status", "paid");
        payload.put("line_items", List.of(
                Map.of("sku", "A-3/ 3 in 1 colour rings-1", "quantity", 1),
                Map.of("sku", "A-3/ 3 in 1 colour rings-2", "quantity", 1),
                Map.of("sku", "A-3/ 3 in 1 colour rings-3", "quantity", 1),
                Map.of("sku", "903", "quantity", 1)
        ));

        int ringQtyBefore = ((Number) ringProduct.getQuantity()).intValue();

        // Process webhook retry
        orderWebhookService.processOrderWebhook("g0usC1NMyehaoSKJRhOqUUhZAO62", "kiyuziyu-test-store.myshopify.com", payload);

        // Verify no order save and no inventory deducted
        verify(tenantOrderRepository, never()).save(any());
        assertEquals(ringQtyBefore, ((Number) ringProduct.getQuantity()).intValue(), "Ring inventory must not be deducted on retry");
    }
}
