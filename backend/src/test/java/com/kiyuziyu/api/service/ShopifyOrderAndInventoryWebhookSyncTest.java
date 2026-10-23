package com.kiyuziyu.api.service;

import com.google.api.core.ApiFutures;
import com.google.cloud.firestore.*;
import com.kiyuziyu.api.integration.shopify.ShopifyGraphQLClient;
import com.kiyuziyu.api.model.Product;
import com.kiyuziyu.api.model.ShopifyConnection;
import com.kiyuziyu.api.model.TenantOrder;
import com.kiyuziyu.api.repository.ProductRepository;
import com.kiyuziyu.api.repository.ShopifyConnectionRepository;
import com.kiyuziyu.api.repository.ShopifyProductMappingRepository;
import com.kiyuziyu.api.repository.TenantOrderRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ShopifyOrderAndInventoryWebhookSyncTest {

    @Mock
    private ProductRepository productRepository;

    @Mock
    private TenantOrderRepository tenantOrderRepository;

    @Mock
    private ShopifyConnectionRepository shopifyConnectionRepository;

    @Mock
    private ShopifyProductMappingRepository mappingRepository;

    @Mock
    private ShopifyGraphQLClient graphQLClient;

    @Mock
    private Firestore firestore;

    @InjectMocks
    private ShopifyOrderWebhookService orderWebhookService;

    @InjectMocks
    private ShopifyInventoryWebhookService inventoryWebhookService;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        ReflectionTestUtils.setField(orderWebhookService, "firestore", firestore);
        ReflectionTestUtils.setField(inventoryWebhookService, "firestore", firestore);

        // Default empty snapshot for existing orders check
        CollectionReference mockOrderCol = mock(CollectionReference.class);
        Query mockOrderQuery = mock(Query.class);
        Query mockLimitQuery = mock(Query.class);
        QuerySnapshot emptyOrderSnap = mock(QuerySnapshot.class);
        when(firestore.collection(TenantOrderRepository.COLLECTION_NAME)).thenReturn(mockOrderCol);
        when(mockOrderCol.whereEqualTo(eq("shopifyOrderId"), any())).thenReturn(mockOrderQuery);
        when(mockOrderQuery.limit(1)).thenReturn(mockLimitQuery);
        when(mockLimitQuery.get()).thenReturn(ApiFutures.immediateFuture(emptyOrderSnap));
        when(emptyOrderSnap.isEmpty()).thenReturn(true);
        when(emptyOrderSnap.getDocuments()).thenReturn(Collections.emptyList());
        when(tenantOrderRepository.acquireLock(any(), any())).thenReturn(true);
    }

    @Test
    void testOrder1022Ingestion_Success() throws Exception {
        String tenantId = "tenant_test_123";
        String shopDomain = "kiyuziyu-test-store.myshopify.com";

        ShopifyConnection conn = new ShopifyConnection();
        conn.setTenantId(tenantId);
        conn.setStoreId("store_abc");
        conn.setShopifyStoreDomain(shopDomain);
        when(shopifyConnectionRepository.findByShopifyStoreDomain(shopDomain)).thenReturn(conn);

        when(tenantOrderRepository.existsByShopifyOrderId(eq(tenantId), eq("1022"))).thenReturn(false);
        when(tenantOrderRepository.acquireLock(eq(tenantId), eq("1022"))).thenReturn(true);

        Product mockProduct = new Product();
        mockProduct.setId("prod_3623");
        mockProduct.setProductCode("3623");
        mockProduct.setBasePrice(100.0);
        mockProduct.setPurchaseRate(70.0);
        when(productRepository.findById("3623")).thenReturn(mockProduct);

        // Mock firestore query for stock update
        CollectionGroup mockColGroup = mock(CollectionGroup.class);
        Query mockQuery = mock(Query.class);
        QuerySnapshot mockSnapshot = mock(QuerySnapshot.class);
        when(firestore.collectionGroup("products")).thenReturn(mockColGroup);
        when(mockColGroup.whereEqualTo("productCode", "3623")).thenReturn(mockQuery);
        when(mockQuery.get()).thenReturn(ApiFutures.immediateFuture(mockSnapshot));
        when(mockSnapshot.getDocuments()).thenReturn(Collections.emptyList());

        Map<String, Object> payload = new HashMap<>();
        payload.put("id", 1022L);
        payload.put("order_number", 1022);
        payload.put("financial_status", "paid");
        payload.put("currency", "USD");
        payload.put("gateway", "Cash on Delivery (COD)");
        payload.put("customer", Map.of("first_name", "rahul", "last_name", "mehata", "email", "yashkalyani0727@gmail.com"));
        payload.put("shipping_address", Map.of(
                "name", "rahul mehata",
                "address1", "xion mall",
                "city", "pune",
                "province", "MH",
                "zip", "412101",
                "country", "India",
                "phone", "+911234567890"
        ));
        payload.put("line_items", List.of(
                Map.of("sku", "3623", "title", "D loose bracelet", "quantity", 2, "price", "150.00")
        ));

        orderWebhookService.processOrderWebhook(tenantId, shopDomain, payload);

        ArgumentCaptor<TenantOrder> captor = ArgumentCaptor.forClass(TenantOrder.class);
        verify(tenantOrderRepository, times(1)).save(captor.capture());

        TenantOrder saved = captor.getValue();
        assertEquals("order_tenant_test_123_1022", saved.getOrderId());
        assertEquals("1022", saved.getShopifyOrderId());
        assertEquals("1022", saved.getOrderNumber());
        assertEquals(tenantId, saved.getTenantId());
        assertEquals("store_abc", saved.getStoreId());
        assertEquals("Payment Done", saved.getStatus());
        assertEquals("rahul mehata", saved.getCustomerName());
        assertEquals("yashkalyani0727@gmail.com", saved.getCustomerEmail());
        assertEquals("+911234567890", saved.getCustomerPhone());
        assertEquals("rahul mehata, xion mall, pune, MH, 412101, India", saved.getShippingAddress());
        assertEquals("USD", saved.getCurrency());
        assertEquals("Cash on Delivery (COD)", saved.getPaymentMethod());
        assertEquals(300.0, saved.getTotalSellingPrice());
        assertEquals(200.0, saved.getTotalBasePrice());
        assertEquals(100.0, saved.getTotalProfit());
        assertEquals(1, saved.getItems().size());
        assertEquals("3623", saved.getItems().get(0).getProductCode());
        assertEquals(2, saved.getItems().get(0).getQuantity());
    }

    @Test
    void testExistingOrder_SafeCustomerDetailsUpdate_DoesNotDeductInventoryAgain() throws Exception {
        String tenantId = "tenant_test_123";
        String shopDomain = "kiyuziyu-test-store.myshopify.com";

        // Mock existing order in Firestore
        CollectionReference mockOrderCol = mock(CollectionReference.class);
        Query mockOrderQuery = mock(Query.class);
        Query mockLimitQuery = mock(Query.class);
        QuerySnapshot existingOrderSnap = mock(QuerySnapshot.class);
        QueryDocumentSnapshot existingDoc = mock(QueryDocumentSnapshot.class);
        DocumentReference existingDocRef = mock(DocumentReference.class);

        when(firestore.collection(TenantOrderRepository.COLLECTION_NAME)).thenReturn(mockOrderCol);
        when(mockOrderCol.whereEqualTo(eq("shopifyOrderId"), eq("1022"))).thenReturn(mockOrderQuery);
        when(mockOrderQuery.limit(1)).thenReturn(mockLimitQuery);
        when(mockLimitQuery.get()).thenReturn(ApiFutures.immediateFuture(existingOrderSnap));
        when(existingOrderSnap.isEmpty()).thenReturn(false);
        when(existingOrderSnap.getDocuments()).thenReturn(List.of(existingDoc));
        when(existingDoc.getId()).thenReturn("order_tenant_test_123_1022");
        when(existingDoc.getReference()).thenReturn(existingDocRef);
        when(existingDocRef.update(anyMap())).thenReturn(ApiFutures.immediateFuture(mock(WriteResult.class)));

        Map<String, Object> payload = new HashMap<>();
        payload.put("id", 1022L);
        payload.put("order_number", 1022);
        payload.put("financial_status", "paid");
        payload.put("currency", "USD");
        payload.put("customer", Map.of("first_name", "rahul", "last_name", "mehata", "email", "yashkalyani0727@gmail.com"));
        payload.put("shipping_address", Map.of(
                "name", "rahul mehata",
                "address1", "xion mall",
                "city", "pune",
                "province", "MH",
                "zip", "412101",
                "country", "India",
                "phone", "+911234567890"
        ));
        payload.put("line_items", List.of(
                Map.of("sku", "3623", "title", "D loose bracelet", "quantity", 2, "price", "150.00")
        ));

        orderWebhookService.processOrderWebhook(tenantId, shopDomain, payload);

        // Must NOT save a new order or deduct inventory again
        verify(tenantOrderRepository, never()).save(any());
        verify(productRepository, never()).findById(any());

        // Must update existing document with real customer details
        ArgumentCaptor<Map<String, Object>> updateCaptor = ArgumentCaptor.forClass(Map.class);
        verify(existingDocRef, times(1)).update(updateCaptor.capture());
        Map<String, Object> updates = updateCaptor.getValue();
        assertEquals("rahul mehata", updates.get("customerName"));
        assertEquals("yashkalyani0727@gmail.com", updates.get("customerEmail"));
        assertEquals("+911234567890", updates.get("customerPhone"));
        assertEquals("rahul mehata, xion mall, pune, MH, 412101, India", updates.get("shippingAddress"));
        assertEquals("USD", updates.get("currency"));
        assertEquals("Payment Done", updates.get("status"));
    }

    @Test
    void testGuestCheckout_ExtractsCustomerInfoFromOrderAndShipping() {
        Map<String, Object> payload = new HashMap<>();
        payload.put("id", 1029L);
        payload.put("order_number", 1029);
        payload.put("email", "guest@example.com");
        payload.put("phone", "+919988776655");
        payload.put("currency", "USD");
        payload.put("shipping_address", Map.of(
                "first_name", "Guest",
                "last_name", "Shopper",
                "address1", "Flat 4B",
                "city", "Pune",
                "country", "India"
        ));

        ShopifyOrderWebhookService.ExtractedOrderDetails extracted = orderWebhookService.extractOrderDetails(payload);
        assertEquals("Guest Shopper", extracted.customerName);
        assertEquals("guest@example.com", extracted.customerEmail);
        assertEquals("+919988776655", extracted.customerPhone);
        assertEquals("Guest Shopper, Flat 4B, Pune, India", extracted.shippingAddressStr);
        assertEquals("USD", extracted.currency);
    }

    @Test
    void testPendingPaymentOrderHandling() throws Exception {
        String tenantId = "tenant_test_123";
        when(tenantOrderRepository.existsByShopifyOrderId(tenantId, "1025")).thenReturn(false);
        when(tenantOrderRepository.acquireLock(tenantId, "1025")).thenReturn(true);

        Product mockProduct = new Product();
        mockProduct.setId("prod_3623");
        mockProduct.setProductCode("3623");
        when(productRepository.findById("3623")).thenReturn(mockProduct);

        CollectionGroup mockColGroup = mock(CollectionGroup.class);
        Query mockQuery = mock(Query.class);
        QuerySnapshot mockSnapshot = mock(QuerySnapshot.class);
        when(firestore.collectionGroup("products")).thenReturn(mockColGroup);
        when(mockColGroup.whereEqualTo("productCode", "3623")).thenReturn(mockQuery);
        when(mockQuery.get()).thenReturn(ApiFutures.immediateFuture(mockSnapshot));
        when(mockSnapshot.getDocuments()).thenReturn(Collections.emptyList());

        Map<String, Object> payload = new HashMap<>();
        payload.put("id", 1025L);
        payload.put("order_number", 1025);
        payload.put("financial_status", "pending");
        payload.put("line_items", List.of(Map.of("sku", "3623", "quantity", 1, "price", "100.00")));

        orderWebhookService.processOrderWebhook(tenantId, payload);

        ArgumentCaptor<TenantOrder> captor = ArgumentCaptor.forClass(TenantOrder.class);
        verify(tenantOrderRepository, times(1)).save(captor.capture());
        assertEquals("Pending Payment", captor.getValue().getStatus());
    }

    @Test
    void testInventoryLevelUpdate_From5To3_SuppressesLoopAndUpdatesQuantity() throws Exception {
        String shopDomain = "kiyuziyu-test-store.myshopify.com";
        String inventoryItemId = "48123456";

        when(graphQLClient.getInventoryItem(inventoryItemId)).thenReturn(Map.of(
                "id", "gid://shopify/InventoryItem/" + inventoryItemId,
                "sku", "3623",
                "variant", Map.of("product", Map.of("id", "gid://shopify/Product/999"))
        ));

        // Mock Firestore document
        QueryDocumentSnapshot mockDoc = mock(QueryDocumentSnapshot.class);
        DocumentReference mockDocRef = mock(DocumentReference.class);
        when(mockDoc.getId()).thenReturn("doc_JcOPkWyYbLSfI2qguMf3");
        when(mockDoc.getReference()).thenReturn(mockDocRef);
        when(mockDocRef.update(anyMap())).thenReturn(ApiFutures.immediateFuture(mock(WriteResult.class)));

        CollectionGroup mockColGroup = mock(CollectionGroup.class);
        Query mockQuery = mock(Query.class);
        QuerySnapshot mockSnapshot = mock(QuerySnapshot.class);
        when(firestore.collectionGroup("products")).thenReturn(mockColGroup);
        when(mockColGroup.whereEqualTo("productCode", "3623")).thenReturn(mockQuery);
        when(mockQuery.get()).thenReturn(ApiFutures.immediateFuture(mockSnapshot));
        when(mockSnapshot.getDocuments()).thenReturn(List.of(mockDoc));

        Map<String, Object> payload = Map.of(
                "inventory_item_id", 48123456L,
                "available", 3
        );

        boolean processed = inventoryWebhookService.processInventoryLevelUpdate(shopDomain, "tenant_123", payload);
        assertTrue(processed, "Inventory webhook should be successfully processed");

        // Verify loop suppression was activated for both docId and productCode
        assertTrue(RealtimeStockListener.isSuppressed("doc_JcOPkWyYbLSfI2qguMf3"));
        assertTrue(RealtimeStockListener.isSuppressed("3623"));

        // Verify firestore doc was updated with available=3
        ArgumentCaptor<Map<String, Object>> updateCaptor = ArgumentCaptor.forClass(Map.class);
        verify(mockDocRef, times(1)).update(updateCaptor.capture());
        assertEquals(3, updateCaptor.getValue().get("quantity"));
    }

    @Test
    void testInventoryLevelUpdate_VariantSku() throws Exception {
        String shopDomain = "kiyuziyu-test-store.myshopify.com";
        String inventoryItemId = "48777777";

        when(graphQLClient.getInventoryItem(inventoryItemId)).thenReturn(Map.of(
                "id", "gid://shopify/InventoryItem/" + inventoryItemId,
                "sku", "3623-2"
        ));

        QueryDocumentSnapshot mockDoc = mock(QueryDocumentSnapshot.class);
        DocumentReference mockDocRef = mock(DocumentReference.class);
        when(mockDoc.getId()).thenReturn("doc_var_123");
        when(mockDoc.getReference()).thenReturn(mockDocRef);
        when(mockDocRef.update(anyMap())).thenReturn(ApiFutures.immediateFuture(mock(WriteResult.class)));

        List<Map<String, Object>> existingVariations = List.of(
                Map.of("color", "Red", "quantity", 5),
                Map.of("color", "Blue", "quantity", 5)
        );
        when(mockDoc.get("variations")).thenReturn(existingVariations);

        CollectionGroup mockColGroup = mock(CollectionGroup.class);
        Query mockQuery = mock(Query.class);
        QuerySnapshot mockSnapshot = mock(QuerySnapshot.class);
        when(firestore.collectionGroup("products")).thenReturn(mockColGroup);
        when(mockColGroup.whereEqualTo("productCode", "3623")).thenReturn(mockQuery);
        when(mockQuery.get()).thenReturn(ApiFutures.immediateFuture(mockSnapshot));
        when(mockSnapshot.getDocuments()).thenReturn(List.of(mockDoc));

        Map<String, Object> payload = Map.of(
                "inventory_item_id", 48777777L,
                "available", 3
        );

        boolean processed = inventoryWebhookService.processInventoryLevelUpdate(shopDomain, "tenant_123", payload);
        assertTrue(processed);

        ArgumentCaptor<Map<String, Object>> updateCaptor = ArgumentCaptor.forClass(Map.class);
        verify(mockDocRef, times(1)).update(updateCaptor.capture());

        Map<String, Object> updates = updateCaptor.getValue();
        // Variant 2 (index 1) updated to 3, variant 1 remained 5 -> total quantity = 5 + 3 = 8
        assertEquals(8, updates.get("quantity"));
        List<Map<String, Object>> updatedVars = (List<Map<String, Object>>) updates.get("variations");
        assertEquals(3, updatedVars.get(1).get("quantity"));
    }

    @Test
    void testOrder_VariantOnly_DeductsTargetVariantAndPersistsTotalQuantity() throws Exception {
        String tenantId = "tenant_test_123";
        String shopDomain = "kiyuziyu-test-store.myshopify.com";

        ShopifyConnection conn = new ShopifyConnection();
        conn.setTenantId(tenantId);
        conn.setStoreId("store_abc");
        conn.setShopifyStoreDomain(shopDomain);
        when(shopifyConnectionRepository.findByShopifyStoreDomain(shopDomain)).thenReturn(conn);

        // Product with 3 variants, each with quantity 5 (total 15)
        Product mockProduct = new Product();
        mockProduct.setId("prod_var_3");
        mockProduct.setProductCode("VAR3");
        mockProduct.setBasePrice(100.0);
        mockProduct.setPurchaseRate(70.0);
        List<Map<String, Object>> variations = new ArrayList<>();
        variations.add(new HashMap<>(Map.of("color", "Red", "quantity", 5)));
        variations.add(new HashMap<>(Map.of("color", "Green", "quantity", 5)));
        variations.add(new HashMap<>(Map.of("color", "Blue", "quantity", 5)));
        mockProduct.setVariations(variations);
        mockProduct.setQuantity(15);
        when(productRepository.findById("VAR3")).thenReturn(mockProduct);

        QueryDocumentSnapshot mockDoc = mock(QueryDocumentSnapshot.class);
        DocumentReference mockDocRef = mock(DocumentReference.class);
        when(mockDoc.getId()).thenReturn("doc_var_3");
        when(mockDoc.getReference()).thenReturn(mockDocRef);
        when(mockDocRef.update(anyMap())).thenReturn(ApiFutures.immediateFuture(mock(WriteResult.class)));

        CollectionGroup mockColGroup = mock(CollectionGroup.class);
        Query mockQuery = mock(Query.class);
        QuerySnapshot mockSnapshot = mock(QuerySnapshot.class);
        when(firestore.collectionGroup("products")).thenReturn(mockColGroup);
        when(mockColGroup.whereEqualTo("productCode", "VAR3")).thenReturn(mockQuery);
        when(mockQuery.get()).thenReturn(ApiFutures.immediateFuture(mockSnapshot));
        when(mockSnapshot.getDocuments()).thenReturn(List.of(mockDoc));

        Map<String, Object> payload = new HashMap<>();
        payload.put("id", 3001L);
        payload.put("order_number", 3001);
        payload.put("financial_status", "paid");
        // Ordered 2 of variant 2 (Green)
        payload.put("line_items", List.of(
                Map.of("sku", "VAR3-2", "title", "Var Ring", "variant_title", "Green", "quantity", 2, "price", "150.00")
        ));

        orderWebhookService.processOrderWebhook(tenantId, shopDomain, payload);

        ArgumentCaptor<Map<String, Object>> updateCaptor = ArgumentCaptor.forClass(Map.class);
        verify(mockDocRef, times(1)).update(updateCaptor.capture());
        Map<String, Object> updates = updateCaptor.getValue();

        // Total quantity must be 5 + (5 - 2) + 5 = 13
        assertEquals(13, updates.get("quantity"));
        List<Map<String, Object>> updatedVars = (List<Map<String, Object>>) updates.get("variations");
        assertEquals(3, updatedVars.size());
        assertEquals(5, updatedVars.get(0).get("quantity"));
        assertEquals(3, updatedVars.get(1).get("quantity"));
        assertEquals(5, updatedVars.get(2).get("quantity"));
    }

    @Test
    void testOrder_NonVariantOnly_DeductsQuantityCorrectly_WithHyphenatedCode() throws Exception {
        String tenantId = "tenant_test_123";
        String shopDomain = "kiyuziyu-test-store.myshopify.com";

        ShopifyConnection conn = new ShopifyConnection();
        conn.setTenantId(tenantId);
        conn.setStoreId("store_abc");
        conn.setShopifyStoreDomain(shopDomain);
        when(shopifyConnectionRepository.findByShopifyStoreDomain(shopDomain)).thenReturn(conn);

        // Non-variant product with hyphens in product code
        Product mockProduct = new Product();
        mockProduct.setId("prod_hyphen_1");
        mockProduct.setProductCode("BRACELET-RED-01");
        mockProduct.setBasePrice(80.0);
        mockProduct.setPurchaseRate(50.0);
        mockProduct.setQuantity(10);
        when(productRepository.findById("BRACELET-RED-01")).thenReturn(mockProduct);

        QueryDocumentSnapshot mockDoc = mock(QueryDocumentSnapshot.class);
        DocumentReference mockDocRef = mock(DocumentReference.class);
        when(mockDoc.getId()).thenReturn("doc_hyphen_1");
        when(mockDoc.getReference()).thenReturn(mockDocRef);
        when(mockDocRef.update(anyMap())).thenReturn(ApiFutures.immediateFuture(mock(WriteResult.class)));

        CollectionGroup mockColGroup = mock(CollectionGroup.class);
        Query mockQuery = mock(Query.class);
        QuerySnapshot mockSnapshot = mock(QuerySnapshot.class);
        when(firestore.collectionGroup("products")).thenReturn(mockColGroup);
        when(mockColGroup.whereEqualTo("productCode", "BRACELET-RED-01")).thenReturn(mockQuery);
        when(mockQuery.get()).thenReturn(ApiFutures.immediateFuture(mockSnapshot));
        when(mockSnapshot.getDocuments()).thenReturn(List.of(mockDoc));

        Map<String, Object> payload = new HashMap<>();
        payload.put("id", 3002L);
        payload.put("order_number", 3002);
        payload.put("financial_status", "paid");
        payload.put("line_items", List.of(
                Map.of("sku", "BRACELET-RED-01", "title", "Red Bracelet", "quantity", 3, "price", "120.00")
        ));

        orderWebhookService.processOrderWebhook(tenantId, shopDomain, payload);

        ArgumentCaptor<Map<String, Object>> updateCaptor = ArgumentCaptor.forClass(Map.class);
        verify(mockDocRef, times(1)).update(updateCaptor.capture());
        Map<String, Object> updates = updateCaptor.getValue();

        // 10 - 3 = 7
        assertEquals(7, updates.get("quantity"));
    }

    @Test
    void testOrder_MixedVariantAndNonVariant_DeductsBothIndependently() throws Exception {
        String tenantId = "tenant_test_123";
        String shopDomain = "kiyuziyu-test-store.myshopify.com";

        ShopifyConnection conn = new ShopifyConnection();
        conn.setTenantId(tenantId);
        conn.setStoreId("store_abc");
        conn.setShopifyStoreDomain(shopDomain);
        when(shopifyConnectionRepository.findByShopifyStoreDomain(shopDomain)).thenReturn(conn);

        // Product A: 3 variants (5 each, total 15)
        Product prodA = new Product();
        prodA.setId("prod_A");
        prodA.setProductCode("PROD-A");
        prodA.setBasePrice(100.0);
        prodA.setPurchaseRate(60.0);
        List<Map<String, Object>> varsA = new ArrayList<>();
        varsA.add(new HashMap<>(Map.of("size", "S", "quantity", 5)));
        varsA.add(new HashMap<>(Map.of("size", "M", "quantity", 5)));
        varsA.add(new HashMap<>(Map.of("size", "L", "quantity", 5)));
        prodA.setVariations(varsA);
        prodA.setQuantity(15);
        when(productRepository.findById("PROD-A")).thenReturn(prodA);

        // Product B: non-variant (quantity 8)
        Product prodB = new Product();
        prodB.setId("prod_B");
        prodB.setProductCode("PROD-B");
        prodB.setBasePrice(50.0);
        prodB.setPurchaseRate(30.0);
        prodB.setQuantity(8);
        when(productRepository.findById("PROD-B")).thenReturn(prodB);

        QueryDocumentSnapshot mockDocA = mock(QueryDocumentSnapshot.class);
        DocumentReference mockDocRefA = mock(DocumentReference.class);
        when(mockDocA.getId()).thenReturn("doc_A");
        when(mockDocA.getReference()).thenReturn(mockDocRefA);
        when(mockDocRefA.update(anyMap())).thenReturn(ApiFutures.immediateFuture(mock(WriteResult.class)));

        QueryDocumentSnapshot mockDocB = mock(QueryDocumentSnapshot.class);
        DocumentReference mockDocRefB = mock(DocumentReference.class);
        when(mockDocB.getId()).thenReturn("doc_B");
        when(mockDocB.getReference()).thenReturn(mockDocRefB);
        when(mockDocRefB.update(anyMap())).thenReturn(ApiFutures.immediateFuture(mock(WriteResult.class)));

        CollectionGroup mockColGroup = mock(CollectionGroup.class);
        Query mockQueryA = mock(Query.class);
        Query mockQueryB = mock(Query.class);
        QuerySnapshot mockSnapshotA = mock(QuerySnapshot.class);
        QuerySnapshot mockSnapshotB = mock(QuerySnapshot.class);

        when(firestore.collectionGroup("products")).thenReturn(mockColGroup);
        when(mockColGroup.whereEqualTo("productCode", "PROD-A")).thenReturn(mockQueryA);
        when(mockQueryA.get()).thenReturn(ApiFutures.immediateFuture(mockSnapshotA));
        when(mockSnapshotA.getDocuments()).thenReturn(List.of(mockDocA));

        when(mockColGroup.whereEqualTo("productCode", "PROD-B")).thenReturn(mockQueryB);
        when(mockQueryB.get()).thenReturn(ApiFutures.immediateFuture(mockSnapshotB));
        when(mockSnapshotB.getDocuments()).thenReturn(List.of(mockDocB));

        Map<String, Object> payload = new HashMap<>();
        payload.put("id", 3003L);
        payload.put("order_number", 3003);
        payload.put("financial_status", "paid");
        payload.put("line_items", List.of(
                Map.of("sku", "PROD-A-1", "title", "Product A - S", "variant_title", "S", "quantity", 2, "price", "150.00"),
                Map.of("sku", "PROD-B", "title", "Product B", "quantity", 3, "price", "80.00")
        ));

        orderWebhookService.processOrderWebhook(tenantId, shopDomain, payload);

        ArgumentCaptor<Map<String, Object>> captorA = ArgumentCaptor.forClass(Map.class);
        verify(mockDocRefA, times(1)).update(captorA.capture());
        Map<String, Object> updatesA = captorA.getValue();
        // Product A: 5-2 = 3 for S, total = 3 + 5 + 5 = 13
        assertEquals(13, updatesA.get("quantity"));
        List<Map<String, Object>> varsUpdatedA = (List<Map<String, Object>>) updatesA.get("variations");
        assertEquals(3, varsUpdatedA.get(0).get("quantity"));
        assertEquals(5, varsUpdatedA.get(1).get("quantity"));
        assertEquals(5, varsUpdatedA.get(2).get("quantity"));

        ArgumentCaptor<Map<String, Object>> captorB = ArgumentCaptor.forClass(Map.class);
        verify(mockDocRefB, times(1)).update(captorB.capture());
        Map<String, Object> updatesB = captorB.getValue();
        // Product B: 8 - 3 = 5
        assertEquals(5, updatesB.get("quantity"));
    }

    @Test
    void testOrder_MultipleVariantsOfSameProduct_AccumulatesDeductions() throws Exception {
        String tenantId = "tenant_test_123";
        String shopDomain = "kiyuziyu-test-store.myshopify.com";

        ShopifyConnection conn = new ShopifyConnection();
        conn.setTenantId(tenantId);
        conn.setStoreId("store_abc");
        conn.setShopifyStoreDomain(shopDomain);
        when(shopifyConnectionRepository.findByShopifyStoreDomain(shopDomain)).thenReturn(conn);

        Product prod = new Product();
        prod.setId("prod_multi");
        prod.setProductCode("MULTI-VAR");
        prod.setBasePrice(100.0);
        prod.setPurchaseRate(60.0);
        List<Map<String, Object>> vars = new ArrayList<>();
        vars.add(new HashMap<>(Map.of("color", "Red", "quantity", 5)));
        vars.add(new HashMap<>(Map.of("color", "Green", "quantity", 5)));
        vars.add(new HashMap<>(Map.of("color", "Blue", "quantity", 5)));
        prod.setVariations(vars);
        prod.setQuantity(15);
        when(productRepository.findById("MULTI-VAR")).thenReturn(prod);

        QueryDocumentSnapshot mockDoc = mock(QueryDocumentSnapshot.class);
        DocumentReference mockDocRef = mock(DocumentReference.class);
        when(mockDoc.getId()).thenReturn("doc_multi");
        when(mockDoc.getReference()).thenReturn(mockDocRef);
        when(mockDocRef.update(anyMap())).thenReturn(ApiFutures.immediateFuture(mock(WriteResult.class)));

        CollectionGroup mockColGroup = mock(CollectionGroup.class);
        Query mockQuery = mock(Query.class);
        QuerySnapshot mockSnapshot = mock(QuerySnapshot.class);
        when(firestore.collectionGroup("products")).thenReturn(mockColGroup);
        when(mockColGroup.whereEqualTo("productCode", "MULTI-VAR")).thenReturn(mockQuery);
        when(mockQuery.get()).thenReturn(ApiFutures.immediateFuture(mockSnapshot));
        when(mockSnapshot.getDocuments()).thenReturn(List.of(mockDoc));

        Map<String, Object> payload = new HashMap<>();
        payload.put("id", 3004L);
        payload.put("order_number", 3004);
        payload.put("financial_status", "paid");
        // Line 1: variant 1 (Red) ordered 2. Line 2: variant 3 (Blue) ordered 1.
        payload.put("line_items", List.of(
                Map.of("sku", "MULTI-VAR-1", "title", "Item Red", "variant_title", "Red", "quantity", 2, "price", "120.00"),
                Map.of("sku", "MULTI-VAR-3", "title", "Item Blue", "variant_title", "Blue", "quantity", 1, "price", "120.00")
        ));

        orderWebhookService.processOrderWebhook(tenantId, shopDomain, payload);

        // Exactly one batch update to Firestore for MULTI-VAR
        ArgumentCaptor<Map<String, Object>> captor = ArgumentCaptor.forClass(Map.class);
        verify(mockDocRef, times(1)).update(captor.capture());
        Map<String, Object> updates = captor.getValue();

        // Total quantity: (5 - 2) + 5 + (5 - 1) = 3 + 5 + 4 = 12
        assertEquals(12, updates.get("quantity"));
        List<Map<String, Object>> updatedVars = (List<Map<String, Object>>) updates.get("variations");
        assertEquals(3, updatedVars.get(0).get("quantity"));
        assertEquals(5, updatedVars.get(1).get("quantity"));
        assertEquals(4, updatedVars.get(2).get("quantity"));
    }

    @Test
    void testOrder_DuplicateWebhookDelivery_DeduplicatesAndDoesNotDeductTwice() throws Exception {
        String tenantId = "tenant_test_123";
        String shopDomain = "kiyuziyu-test-store.myshopify.com";

        ShopifyConnection conn = new ShopifyConnection();
        conn.setTenantId(tenantId);
        conn.setStoreId("store_abc");
        conn.setShopifyStoreDomain(shopDomain);
        when(shopifyConnectionRepository.findByShopifyStoreDomain(shopDomain)).thenReturn(conn);

        Product mockProduct = new Product();
        mockProduct.setId("prod_dup");
        mockProduct.setProductCode("DUP-PROD");
        mockProduct.setQuantity(10);
        when(productRepository.findById("DUP-PROD")).thenReturn(mockProduct);

        QueryDocumentSnapshot mockDoc = mock(QueryDocumentSnapshot.class);
        DocumentReference mockDocRef = mock(DocumentReference.class);
        when(mockDoc.getId()).thenReturn("doc_dup");
        when(mockDoc.getReference()).thenReturn(mockDocRef);
        when(mockDocRef.update(anyMap())).thenReturn(ApiFutures.immediateFuture(mock(WriteResult.class)));

        CollectionGroup mockColGroup = mock(CollectionGroup.class);
        Query mockQuery = mock(Query.class);
        QuerySnapshot mockSnapshot = mock(QuerySnapshot.class);
        when(firestore.collectionGroup("products")).thenReturn(mockColGroup);
        when(mockColGroup.whereEqualTo("productCode", "DUP-PROD")).thenReturn(mockQuery);
        when(mockQuery.get()).thenReturn(ApiFutures.immediateFuture(mockSnapshot));
        when(mockSnapshot.getDocuments()).thenReturn(List.of(mockDoc));

        Map<String, Object> payload = new HashMap<>();
        payload.put("id", 3005L);
        payload.put("order_number", 3005);
        payload.put("financial_status", "paid");
        payload.put("line_items", List.of(
                Map.of("sku", "DUP-PROD", "title", "Dup Product", "quantity", 2, "price", "100.00")
        ));

        // First delivery: processes order, deducts stock, saves TenantOrder
        orderWebhookService.processOrderWebhook(tenantId, shopDomain, payload);
        verify(mockDocRef, times(1)).update(anyMap());
        verify(tenantOrderRepository, times(1)).save(any());

        // Now mock that order 3005 exists in Firestore for the duplicate delivery
        CollectionReference mockOrderCol = mock(CollectionReference.class);
        Query mockOrderQuery = mock(Query.class);
        Query mockLimitQuery = mock(Query.class);
        QuerySnapshot existingOrderSnap = mock(QuerySnapshot.class);
        QueryDocumentSnapshot existingDoc = mock(QueryDocumentSnapshot.class);
        DocumentReference existingOrderRef = mock(DocumentReference.class);

        when(firestore.collection(TenantOrderRepository.COLLECTION_NAME)).thenReturn(mockOrderCol);
        when(mockOrderCol.whereEqualTo(eq("shopifyOrderId"), eq("3005"))).thenReturn(mockOrderQuery);
        when(mockOrderQuery.limit(1)).thenReturn(mockLimitQuery);
        when(mockLimitQuery.get()).thenReturn(ApiFutures.immediateFuture(existingOrderSnap));
        when(existingOrderSnap.isEmpty()).thenReturn(false);
        when(existingOrderSnap.getDocuments()).thenReturn(List.of(existingDoc));
        when(existingDoc.getId()).thenReturn("order_tenant_test_123_3005");
        when(existingDoc.getReference()).thenReturn(existingOrderRef);
        when(existingOrderRef.update(anyMap())).thenReturn(ApiFutures.immediateFuture(mock(WriteResult.class)));

        // Second duplicate delivery
        orderWebhookService.processOrderWebhook(tenantId, shopDomain, payload);

        // Product stock must NOT be updated a second time (still exactly 1 invocation)
        verify(mockDocRef, times(1)).update(anyMap());
        // TenantOrder save must NOT be invoked a second time
        verify(tenantOrderRepository, times(1)).save(any());
    }

    @Test
    void testOrder_AmbiguousVariantMapping_DoesNotDeductWrongVariant() throws Exception {
        String tenantId = "tenant_test_123";
        String shopDomain = "kiyuziyu-test-store.myshopify.com";

        ShopifyConnection conn = new ShopifyConnection();
        conn.setTenantId(tenantId);
        conn.setStoreId("store_abc");
        conn.setShopifyStoreDomain(shopDomain);
        when(shopifyConnectionRepository.findByShopifyStoreDomain(shopDomain)).thenReturn(conn);

        Product prod = new Product();
        prod.setId("prod_strict");
        prod.setProductCode("VAR-STRICT");
        prod.setBasePrice(100.0);
        prod.setPurchaseRate(60.0);
        List<Map<String, Object>> vars = new ArrayList<>();
        vars.add(new HashMap<>(Map.of("color", "Red", "quantity", 5)));
        vars.add(new HashMap<>(Map.of("color", "Blue", "quantity", 5)));
        prod.setVariations(vars);
        prod.setQuantity(10);
        when(productRepository.findById("VAR-STRICT")).thenReturn(prod);

        QueryDocumentSnapshot mockDoc = mock(QueryDocumentSnapshot.class);
        DocumentReference mockDocRef = mock(DocumentReference.class);
        when(mockDoc.getId()).thenReturn("doc_strict");
        when(mockDoc.getReference()).thenReturn(mockDocRef);

        CollectionGroup mockColGroup = mock(CollectionGroup.class);
        Query mockQuery = mock(Query.class);
        QuerySnapshot mockSnapshot = mock(QuerySnapshot.class);
        when(firestore.collectionGroup("products")).thenReturn(mockColGroup);
        when(mockColGroup.whereEqualTo("productCode", "VAR-STRICT")).thenReturn(mockQuery);
        when(mockQuery.get()).thenReturn(ApiFutures.immediateFuture(mockSnapshot));
        when(mockSnapshot.getDocuments()).thenReturn(List.of(mockDoc));

        Map<String, Object> payload = new HashMap<>();
        payload.put("id", 3006L);
        payload.put("order_number", 3006);
        payload.put("financial_status", "paid");
        // Out-of-range variant index 99
        payload.put("line_items", List.of(
                Map.of("sku", "VAR-STRICT-99", "title", "Strict Ring", "quantity", 2, "price", "120.00")
        ));

        orderWebhookService.processOrderWebhook(tenantId, shopDomain, payload);

        // Ambiguous/unmatched variant mapping must NOT deduct any inventory
        verify(mockDocRef, never()).update(anyMap());
        assertEquals(5, vars.get(0).get("quantity"));
        assertEquals(5, vars.get(1).get("quantity"));
        assertEquals(10, prod.getQuantity());
        verify(tenantOrderRepository, never()).save(any());
    }

    @Test
    void testOrder_UnknownSku_FirstTokenMatchingExistingProduct_NeverDeductsStockOrAssociatesProduct() throws Exception {
        String tenantId = "tenant_test_123";
        String shopDomain = "kiyuziyu-test-store.myshopify.com";

        ShopifyConnection conn = new ShopifyConnection();
        conn.setTenantId(tenantId);
        conn.setStoreId("store_abc");
        conn.setShopifyStoreDomain(shopDomain);
        when(shopifyConnectionRepository.findByShopifyStoreDomain(shopDomain)).thenReturn(conn);

        // Existing product 5971 (non-variant, stock 10)
        Product prod5971 = new Product();
        prod5971.setId("prod_5971");
        prod5971.setProductCode("5971");
        prod5971.setQuantity(10);
        when(productRepository.findById("5971")).thenReturn(prod5971);

        QueryDocumentSnapshot mockDoc = mock(QueryDocumentSnapshot.class);
        DocumentReference mockDocRef = mock(DocumentReference.class);
        when(mockDoc.getId()).thenReturn("doc_5971");
        when(mockDoc.getReference()).thenReturn(mockDocRef);

        CollectionGroup mockColGroup = mock(CollectionGroup.class);
        Query mockQuery = mock(Query.class);
        QuerySnapshot mockSnapshot = mock(QuerySnapshot.class);
        when(firestore.collectionGroup("products")).thenReturn(mockColGroup);
        when(mockColGroup.whereEqualTo("productCode", "5971")).thenReturn(mockQuery);
        when(mockQuery.get()).thenReturn(ApiFutures.immediateFuture(mockSnapshot));
        when(mockSnapshot.getDocuments()).thenReturn(List.of(mockDoc));

        // Unknown SKU whose first token is 5971 (e.g. 5971-NEW-DESIGN)
        Map<String, Object> payload = new HashMap<>();
        payload.put("id", 4001L);
        payload.put("order_number", 4001);
        payload.put("financial_status", "paid");
        payload.put("line_items", List.of(
                Map.of("sku", "5971-NEW-DESIGN", "title", "New Design", "quantity", 2, "price", "100.00")
        ));

        orderWebhookService.processOrderWebhook(tenantId, shopDomain, payload);

        // Product 5971 must NOT be touched or updated in Firestore
        verify(mockDocRef, never()).update(anyMap());
        assertEquals(10, prod5971.getQuantity());
        verify(tenantOrderRepository, never()).save(any());
    }

    @Test
    void testOrder_NegativeZeroAndMalformedQuantities_SafelyRejected() throws Exception {
        String tenantId = "tenant_test_123";
        String shopDomain = "kiyuziyu-test-store.myshopify.com";

        ShopifyConnection conn = new ShopifyConnection();
        conn.setTenantId(tenantId);
        conn.setStoreId("store_abc");
        conn.setShopifyStoreDomain(shopDomain);
        when(shopifyConnectionRepository.findByShopifyStoreDomain(shopDomain)).thenReturn(conn);

        Product prod = new Product();
        prod.setId("prod_qty_test");
        prod.setProductCode("PROD-QTY");
        prod.setQuantity(10);
        when(productRepository.findById("PROD-QTY")).thenReturn(prod);

        QueryDocumentSnapshot mockDoc = mock(QueryDocumentSnapshot.class);
        DocumentReference mockDocRef = mock(DocumentReference.class);
        when(mockDoc.getId()).thenReturn("doc_qty_test");
        when(mockDoc.getReference()).thenReturn(mockDocRef);

        CollectionGroup mockColGroup = mock(CollectionGroup.class);
        Query mockQuery = mock(Query.class);
        QuerySnapshot mockSnapshot = mock(QuerySnapshot.class);
        when(firestore.collectionGroup("products")).thenReturn(mockColGroup);
        when(mockColGroup.whereEqualTo("productCode", "PROD-QTY")).thenReturn(mockQuery);
        when(mockQuery.get()).thenReturn(ApiFutures.immediateFuture(mockSnapshot));
        when(mockSnapshot.getDocuments()).thenReturn(List.of(mockDoc));

        Map<String, Object> payload = new HashMap<>();
        payload.put("id", 4002L);
        payload.put("order_number", 4002);
        payload.put("financial_status", "paid");
        // Line items with negative, zero, and malformed quantities
        payload.put("line_items", List.of(
                Map.of("sku", "PROD-QTY", "title", "Test Prod", "quantity", -3, "price", "50.00"),
                Map.of("sku", "PROD-QTY", "title", "Test Prod", "quantity", 0, "price", "50.00"),
                Map.of("sku", "PROD-QTY", "title", "Test Prod", "quantity", "invalid_number", "price", "50.00")
        ));

        orderWebhookService.processOrderWebhook(tenantId, shopDomain, payload);

        // None of the invalid items should deduct stock or increase stock
        verify(mockDocRef, never()).update(anyMap());
        assertEquals(10, prod.getQuantity());
        // No order should be saved since all items were rejected
        verify(tenantOrderRepository, never()).save(any());
    }

    @Test
    void testOrder_InvalidVariantSku_FailsSafely_NotSavedAsSuccessfulOrderWithoutStockDeduction() throws Exception {
        String tenantId = "tenant_test_123";
        String shopDomain = "kiyuziyu-test-store.myshopify.com";

        ShopifyConnection conn = new ShopifyConnection();
        conn.setTenantId(tenantId);
        conn.setStoreId("store_abc");
        conn.setShopifyStoreDomain(shopDomain);
        when(shopifyConnectionRepository.findByShopifyStoreDomain(shopDomain)).thenReturn(conn);

        // Multi-variant product with 3 variants
        Product prod = new Product();
        prod.setId("prod_fail_safe");
        prod.setProductCode("VAR-FAILSAFE");
        prod.setBasePrice(100.0);
        prod.setPurchaseRate(60.0);
        List<Map<String, Object>> vars = new ArrayList<>();
        vars.add(new HashMap<>(Map.of("color", "Red", "quantity", 5)));
        vars.add(new HashMap<>(Map.of("color", "Blue", "quantity", 5)));
        vars.add(new HashMap<>(Map.of("color", "Green", "quantity", 5)));
        prod.setVariations(vars);
        prod.setQuantity(15);
        when(productRepository.findById("VAR-FAILSAFE")).thenReturn(prod);

        QueryDocumentSnapshot mockDoc = mock(QueryDocumentSnapshot.class);
        DocumentReference mockDocRef = mock(DocumentReference.class);
        when(mockDoc.getId()).thenReturn("doc_fail_safe");
        when(mockDoc.getReference()).thenReturn(mockDocRef);

        CollectionGroup mockColGroup = mock(CollectionGroup.class);
        Query mockQuery = mock(Query.class);
        QuerySnapshot mockSnapshot = mock(QuerySnapshot.class);
        when(firestore.collectionGroup("products")).thenReturn(mockColGroup);
        when(mockColGroup.whereEqualTo("productCode", "VAR-FAILSAFE")).thenReturn(mockQuery);
        when(mockQuery.get()).thenReturn(ApiFutures.immediateFuture(mockSnapshot));
        when(mockSnapshot.getDocuments()).thenReturn(List.of(mockDoc));

        // Test missing variant index on a multi-variant product: sku="VAR-FAILSAFE"
        Map<String, Object> payloadMissingIndex = new HashMap<>();
        payloadMissingIndex.put("id", 4003L);
        payloadMissingIndex.put("order_number", 4003);
        payloadMissingIndex.put("financial_status", "paid");
        payloadMissingIndex.put("line_items", List.of(
                Map.of("sku", "VAR-FAILSAFE", "title", "Ring", "quantity", 2, "price", "120.00")
        ));

        orderWebhookService.processOrderWebhook(tenantId, shopDomain, payloadMissingIndex);

        // Must fail safely: no inventory update, not saved as ordinary successful order
        verify(mockDocRef, never()).update(anyMap());
        verify(tenantOrderRepository, never()).save(any());
        assertEquals(15, prod.getQuantity());

        // Test out-of-range variant index: sku="VAR-FAILSAFE-99"
        Map<String, Object> payloadOutOfRange = new HashMap<>();
        payloadOutOfRange.put("id", 4004L);
        payloadOutOfRange.put("order_number", 4004);
        payloadOutOfRange.put("financial_status", "paid");
        payloadOutOfRange.put("line_items", List.of(
                Map.of("sku", "VAR-FAILSAFE-99", "title", "Ring", "quantity", 2, "price", "120.00")
        ));

        orderWebhookService.processOrderWebhook(tenantId, shopDomain, payloadOutOfRange);

        verify(mockDocRef, never()).update(anyMap());
        verify(tenantOrderRepository, never()).save(any());
        assertEquals(15, prod.getQuantity());
    }

    @Test
    void testOrder_MixedValidAndInvalidRecognizedLineItems_RejectsEntireOrder_NoStockDeductionNoOrderSave() throws Exception {
        String tenantId = "tenant_test_123";
        String shopDomain = "kiyuziyu-test-store.myshopify.com";

        ShopifyConnection conn = new ShopifyConnection();
        conn.setTenantId(tenantId);
        conn.setStoreId("store_abc");
        conn.setShopifyStoreDomain(shopDomain);
        when(shopifyConnectionRepository.findByShopifyStoreDomain(shopDomain)).thenReturn(conn);

        // Product A: Valid recognized product
        Product prodA = new Product();
        prodA.setId("prod_valid_a");
        prodA.setProductCode("PROD-VALID-A");
        prodA.setQuantity(10);
        prodA.setBasePrice(100.0);
        prodA.setPurchaseRate(70.0);
        when(productRepository.findById("PROD-VALID-A")).thenReturn(prodA);

        QueryDocumentSnapshot mockDocA = mock(QueryDocumentSnapshot.class);
        DocumentReference mockDocRefA = mock(DocumentReference.class);
        when(mockDocA.getId()).thenReturn("doc_valid_a");
        when(mockDocA.getReference()).thenReturn(mockDocRefA);

        // Product B: Another recognized product
        Product prodB = new Product();
        prodB.setId("prod_valid_b");
        prodB.setProductCode("PROD-VALID-B");
        prodB.setQuantity(10);
        prodB.setBasePrice(100.0);
        prodB.setPurchaseRate(70.0);
        when(productRepository.findById("PROD-VALID-B")).thenReturn(prodB);

        QueryDocumentSnapshot mockDocB = mock(QueryDocumentSnapshot.class);
        DocumentReference mockDocRefB = mock(DocumentReference.class);
        when(mockDocB.getId()).thenReturn("doc_valid_b");
        when(mockDocB.getReference()).thenReturn(mockDocRefB);

        CollectionGroup mockColGroup = mock(CollectionGroup.class);
        Query mockQueryA = mock(Query.class);
        Query mockQueryB = mock(Query.class);
        QuerySnapshot mockSnapshotA = mock(QuerySnapshot.class);
        QuerySnapshot mockSnapshotB = mock(QuerySnapshot.class);
        when(firestore.collectionGroup("products")).thenReturn(mockColGroup);
        when(mockColGroup.whereEqualTo("productCode", "PROD-VALID-A")).thenReturn(mockQueryA);
        when(mockColGroup.whereEqualTo("productCode", "PROD-VALID-B")).thenReturn(mockQueryB);
        when(mockQueryA.get()).thenReturn(ApiFutures.immediateFuture(mockSnapshotA));
        when(mockQueryB.get()).thenReturn(ApiFutures.immediateFuture(mockSnapshotB));
        when(mockSnapshotA.getDocuments()).thenReturn(List.of(mockDocA));
        when(mockSnapshotB.getDocuments()).thenReturn(List.of(mockDocB));

        // Mixed payload: Item 1 has valid quantity (2), Item 2 has invalid negative quantity (-1)
        Map<String, Object> payload = new HashMap<>();
        payload.put("id", 4005L);
        payload.put("order_number", 4005);
        payload.put("financial_status", "paid");
        payload.put("line_items", List.of(
                Map.of("sku", "PROD-VALID-A", "title", "Prod A", "quantity", 2, "price", "150.00"),
                Map.of("sku", "PROD-VALID-B", "title", "Prod B", "quantity", -1, "price", "150.00")
        ));

        orderWebhookService.processOrderWebhook(tenantId, shopDomain, payload);

        // Neither product A nor product B must have its stock updated in Firestore
        verify(mockDocRefA, never()).update(anyMap());
        verify(mockDocRefB, never()).update(anyMap());
        assertEquals(10, prodA.getQuantity());
        assertEquals(10, prodB.getQuantity());
        // No partial order should be saved
        verify(tenantOrderRepository, never()).save(any());
    }

    @Test
    void testParsePositiveQuantity_PreventIntegerOverflowAndRejectsInvalidValues() {
        // Integer overflow values (Long and String representations)
        assertNull(orderWebhookService.parsePositiveQuantity(4294967297L));
        assertNull(orderWebhookService.parsePositiveQuantity(2147483648L));
        assertNull(orderWebhookService.parsePositiveQuantity(Long.MAX_VALUE));
        assertNull(orderWebhookService.parsePositiveQuantity("4294967297"));
        assertNull(orderWebhookService.parsePositiveQuantity("2147483648"));

        // Fractional and special floating point values
        assertNull(orderWebhookService.parsePositiveQuantity(2.5));
        assertNull(orderWebhookService.parsePositiveQuantity(1.00001));
        assertNull(orderWebhookService.parsePositiveQuantity("2.5"));
        assertNull(orderWebhookService.parsePositiveQuantity(Double.NaN));
        assertNull(orderWebhookService.parsePositiveQuantity(Double.POSITIVE_INFINITY));
        assertNull(orderWebhookService.parsePositiveQuantity(Double.NEGATIVE_INFINITY));
        assertNull(orderWebhookService.parsePositiveQuantity(Double.MAX_VALUE));

        // Zero and negatives
        assertNull(orderWebhookService.parsePositiveQuantity(0));
        assertNull(orderWebhookService.parsePositiveQuantity(0L));
        assertNull(orderWebhookService.parsePositiveQuantity(-1));
        assertNull(orderWebhookService.parsePositiveQuantity(-999L));
        assertNull(orderWebhookService.parsePositiveQuantity("0"));
        assertNull(orderWebhookService.parsePositiveQuantity("-5"));

        // Malformed and null
        assertNull(orderWebhookService.parsePositiveQuantity(null));
        assertNull(orderWebhookService.parsePositiveQuantity(""));
        assertNull(orderWebhookService.parsePositiveQuantity("abc"));
        assertNull(orderWebhookService.parsePositiveQuantity("1e5"));

        // Valid positive integers within [1, Integer.MAX_VALUE] continue to work
        assertEquals(1, orderWebhookService.parsePositiveQuantity(1));
        assertEquals(5, orderWebhookService.parsePositiveQuantity(5L));
        assertEquals(100, orderWebhookService.parsePositiveQuantity(100));
        assertEquals(Integer.MAX_VALUE, orderWebhookService.parsePositiveQuantity(Integer.MAX_VALUE));
        assertEquals(Integer.MAX_VALUE, orderWebhookService.parsePositiveQuantity((long) Integer.MAX_VALUE));
        assertEquals(1, orderWebhookService.parsePositiveQuantity("1"));
        assertEquals(10, orderWebhookService.parsePositiveQuantity("10"));
        assertEquals(Integer.MAX_VALUE, orderWebhookService.parsePositiveQuantity(String.valueOf(Integer.MAX_VALUE)));
    }

    @Test
    void testOrder_IntegerOverflowQuantity_SafelyRejected() throws Exception {
        String tenantId = "tenant_test_123";
        String shopDomain = "kiyuziyu-test-store.myshopify.com";

        ShopifyConnection conn = new ShopifyConnection();
        conn.setTenantId(tenantId);
        conn.setStoreId("store_abc");
        conn.setShopifyStoreDomain(shopDomain);
        when(shopifyConnectionRepository.findByShopifyStoreDomain(shopDomain)).thenReturn(conn);

        Product prod = new Product();
        prod.setId("prod_overflow");
        prod.setProductCode("PROD-OVERFLOW");
        prod.setQuantity(10);
        when(productRepository.findById("PROD-OVERFLOW")).thenReturn(prod);

        QueryDocumentSnapshot mockDoc = mock(QueryDocumentSnapshot.class);
        DocumentReference mockDocRef = mock(DocumentReference.class);
        when(mockDoc.getId()).thenReturn("doc_overflow");
        when(mockDoc.getReference()).thenReturn(mockDocRef);

        CollectionGroup mockColGroup = mock(CollectionGroup.class);
        Query mockQuery = mock(Query.class);
        QuerySnapshot mockSnapshot = mock(QuerySnapshot.class);
        when(firestore.collectionGroup("products")).thenReturn(mockColGroup);
        when(mockColGroup.whereEqualTo("productCode", "PROD-OVERFLOW")).thenReturn(mockQuery);
        when(mockQuery.get()).thenReturn(ApiFutures.immediateFuture(mockSnapshot));
        when(mockSnapshot.getDocuments()).thenReturn(List.of(mockDoc));

        // Overflow quantity: 4294967297L (2^32 + 1)
        Map<String, Object> payload = new HashMap<>();
        payload.put("id", 4006L);
        payload.put("order_number", 4006);
        payload.put("financial_status", "paid");
        payload.put("line_items", List.of(
                Map.of("sku", "PROD-OVERFLOW", "title", "Overflow Item", "quantity", 4294967297L, "price", "50.00")
        ));

        orderWebhookService.processOrderWebhook(tenantId, shopDomain, payload);

        // Overflow quantity must be safely rejected without stock update or order save
        verify(mockDocRef, never()).update(anyMap());
        assertEquals(10, prod.getQuantity());
        verify(tenantOrderRepository, never()).save(any());
    }

    @Test
    void testOrder_InventoryPersistenceFollowedByOrderSaveFailureAndRetry_DoesNotDoubleDeduct() throws Exception {
        String tenantId = "tenant_test_123";
        String shopDomain = "kiyuziyu-test-store.myshopify.com";

        ShopifyConnection conn = new ShopifyConnection();
        conn.setTenantId(tenantId);
        conn.setStoreId("store_abc");
        conn.setShopifyStoreDomain(shopDomain);
        when(shopifyConnectionRepository.findByShopifyStoreDomain(shopDomain)).thenReturn(conn);

        Product prod = new Product();
        prod.setId("prod_retry");
        prod.setProductCode("PROD-RETRY");
        prod.setBasePrice(100.0);
        prod.setPurchaseRate(60.0);
        prod.setQuantity(10);
        when(productRepository.findById("PROD-RETRY")).thenReturn(prod);

        QueryDocumentSnapshot mockDoc = mock(QueryDocumentSnapshot.class);
        DocumentReference mockDocRef = mock(DocumentReference.class);
        when(mockDoc.getId()).thenReturn("doc_retry");
        when(mockDoc.getReference()).thenReturn(mockDocRef);
        when(mockDocRef.update(anyMap())).thenReturn(ApiFutures.immediateFuture(mock(WriteResult.class)));

        CollectionGroup mockColGroup = mock(CollectionGroup.class);
        Query mockQuery = mock(Query.class);
        QuerySnapshot mockSnapshot = mock(QuerySnapshot.class);
        when(firestore.collectionGroup("products")).thenReturn(mockColGroup);
        when(mockColGroup.whereEqualTo("productCode", "PROD-RETRY")).thenReturn(mockQuery);
        when(mockQuery.get()).thenReturn(ApiFutures.immediateFuture(mockSnapshot));
        when(mockSnapshot.getDocuments()).thenReturn(List.of(mockDoc));

        // When order-save is attempted, it throws an exception (simulating Firestore outage/network failure)
        doThrow(new RuntimeException("Firestore connection failed during order save"))
                .when(tenantOrderRepository).save(any());

        // First execution: lock is acquired successfully (returns true)
        // Second execution (webhook retry): lock is already held in apiOrderLocks (returns false)
        when(tenantOrderRepository.acquireLock(eq(tenantId), eq("5005")))
                .thenReturn(true)   // Attempt 1: lock acquired
                .thenReturn(false); // Attempt 2: lock already held / processed

        Map<String, Object> payload = new HashMap<>();
        payload.put("id", 5005L);
        payload.put("order_number", 5005);
        payload.put("financial_status", "paid");
        payload.put("line_items", List.of(
                Map.of("sku", "PROD-RETRY", "title", "Retry Product", "quantity", 2, "price", "120.00")
        ));

        // Attempt 1: Inventory is persisted, but order save fails
        orderWebhookService.processOrderWebhook(tenantId, shopDomain, payload);

        // Verify inventory update was called once in Attempt 1
        verify(mockDocRef, times(1)).update(anyMap());
        assertEquals(8, prod.getQuantity());

        // Attempt 2: Shopify webhook retry arrives with the exact same payload
        orderWebhookService.processOrderWebhook(tenantId, shopDomain, payload);

        // CRITICAL CHECK: Inventory update must NOT have been called a second time (still exactly 1 invocation)
        verify(mockDocRef, times(1)).update(anyMap());
        assertEquals(8, prod.getQuantity());
    }
}
