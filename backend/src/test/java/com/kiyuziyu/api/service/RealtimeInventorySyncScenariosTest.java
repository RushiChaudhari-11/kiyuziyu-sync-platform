package com.kiyuziyu.api.service;

import com.google.cloud.firestore.DocumentReference;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.QueryDocumentSnapshot;
import com.google.cloud.firestore.QuerySnapshot;
import com.kiyuziyu.api.controller.ShopifyWebhookController;
import com.kiyuziyu.api.controller.TenantOrderController;
import com.kiyuziyu.api.integration.shopify.ShopifyGraphQLClient;
import com.kiyuziyu.api.model.Product;
import com.kiyuziyu.api.model.ShopifyConnection;
import com.kiyuziyu.api.model.ShopifyProductMapping;
import com.kiyuziyu.api.repository.ProductRepository;
import com.kiyuziyu.api.repository.ShopifyConnectionRepository;
import com.kiyuziyu.api.repository.ShopifyProductMappingRepository;
import com.kiyuziyu.api.repository.TenantOrderRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit & Integration tests for Real-Time Firebase <-> Shopify Inventory Synchronization
 * Covering all 12 validation scenarios requested in the specification.
 */
public class RealtimeInventorySyncScenariosTest {

    @Mock
    private Firestore firestore;

    @Mock
    private ProductRepository productRepository;

    @Mock
    private ShopifyProductMappingRepository shopifyProductMappingRepository;

    @Mock
    private ShopifyConnectionRepository shopifyConnectionRepository;

    @Mock
    private ShopifyGraphQLClient shopifyGraphQLClient;

    @Mock
    private TenantOrderRepository tenantOrderRepository;

    @InjectMocks
    private ShopifyProductService shopifyProductService;

    @InjectMocks
    private RealtimeStockListener realtimeStockListener;

    @InjectMocks
    private ShopifyWebhookController shopifyWebhookController;

    @InjectMocks
    private TenantOrderController tenantOrderController;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        ReflectionTestUtils.setField(realtimeStockListener, "shopifyProductService", shopifyProductService);
        ReflectionTestUtils.setField(realtimeStockListener, "shopifyConnectionRepository", shopifyConnectionRepository);
        ReflectionTestUtils.setField(realtimeStockListener, "mappingRepository", shopifyProductMappingRepository);
        ReflectionTestUtils.setField(realtimeStockListener, "firestore", firestore);

        ReflectionTestUtils.setField(tenantOrderController, "firestore", firestore);
        ReflectionTestUtils.setField(tenantOrderController, "productRepository", productRepository);
        ReflectionTestUtils.setField(tenantOrderController, "shopifyProductMappingRepository", shopifyProductMappingRepository);
        ReflectionTestUtils.setField(tenantOrderController, "shopifyConnectionRepository", shopifyConnectionRepository);
        ReflectionTestUtils.setField(tenantOrderController, "shopifyProductService", shopifyProductService);
    }

    // SCENARIO 1: Real-time stock sync with variant products (Firebase -> Shopify)
    @Test
    void testScenario1_RealtimeStockSyncWithVariants() {
        Product product = new Product();
        product.setId("prod_101");
        product.setProductCode("PROD101");

        Map<String, Object> var1 = new HashMap<>();
        var1.put("color", "Red");
        var1.put("size", "M");
        var1.put("quantity", 15);

        Map<String, Object> var2 = new HashMap<>();
        var2.put("color", "Blue");
        var2.put("size", "L");
        var2.put("quantity", 25);

        product.setVariations(List.of(var1, var2));

        when(shopifyGraphQLClient.getActiveLocationId()).thenReturn("gid://shopify/Location/loc1");

        Map<String, Object> sVar1 = new HashMap<>();
        sVar1.put("id", "gid://shopify/ProductVariant/v1");
        sVar1.put("inventoryItem", Map.of("id", "gid://shopify/InventoryItem/ii1"));
        sVar1.put("selectedOptions", List.of(Map.of("name", "Color", "value", "Red"), Map.of("name", "Size", "value", "M")));

        Map<String, Object> sVar2 = new HashMap<>();
        sVar2.put("id", "gid://shopify/ProductVariant/v2");
        sVar2.put("inventoryItem", Map.of("id", "gid://shopify/InventoryItem/ii2"));
        sVar2.put("selectedOptions", List.of(Map.of("name", "Color", "value", "Blue"), Map.of("name", "Size", "value", "L")));

        when(shopifyGraphQLClient.getProductVariants("gid://shopify/Product/sp1")).thenReturn(List.of(sVar1, sVar2));
        when(shopifyGraphQLClient.findMatchingVariant(anyList(), argThat(opts -> opts != null && !opts.isEmpty() && "Red".equals(opts.get(0).get("name"))))).thenReturn(sVar1);
        when(shopifyGraphQLClient.findMatchingVariant(anyList(), argThat(opts -> opts != null && !opts.isEmpty() && "Blue".equals(opts.get(0).get("name"))))).thenReturn(sVar2);

        boolean result = shopifyProductService.syncInventoryOnly("tenant_1", "gid://shopify/Product/sp1", product);

        assertTrue(result);
        verify(shopifyGraphQLClient).setInventoryQuantity("gid://shopify/InventoryItem/ii1", "gid://shopify/Location/loc1", 15);
        verify(shopifyGraphQLClient).setInventoryQuantity("gid://shopify/InventoryItem/ii2", "gid://shopify/Location/loc1", 25);
    }

    // SCENARIO 2: Real-time stock sync with standalone products (no variants)
    @Test
    void testScenario2_RealtimeStockSyncStandaloneProduct() {
        Product product = new Product();
        product.setId("prod_single");
        product.setProductCode("SINGLE1");
        product.setQuantity(42);

        when(shopifyGraphQLClient.getActiveLocationId()).thenReturn("gid://shopify/Location/loc1");

        Map<String, Object> firstVariant = new HashMap<>();
        firstVariant.put("id", "gid://shopify/ProductVariant/vsingle");
        firstVariant.put("inventoryItem", Map.of("id", "gid://shopify/InventoryItem/ii_single"));

        when(shopifyGraphQLClient.getProductVariants("gid://shopify/Product/sp_single")).thenReturn(List.of(firstVariant));

        boolean result = shopifyProductService.syncInventoryOnly("tenant_1", "gid://shopify/Product/sp_single", product);

        assertTrue(result);
        verify(shopifyGraphQLClient).setInventoryQuantity("gid://shopify/InventoryItem/ii_single", "gid://shopify/Location/loc1", 42);
    }

    // SCENARIO 3: Zero stock and out-of-stock transitions
    @Test
    void testScenario3_ZeroStockTransitions() {
        Product product = new Product();
        product.setId("prod_zero");
        product.setProductCode("ZERO1");
        product.setQuantity(0);

        when(shopifyGraphQLClient.getActiveLocationId()).thenReturn("gid://shopify/Location/loc1");
        Map<String, Object> firstVariant = Map.of("id", "gid://shopify/ProductVariant/v0",
                "inventoryItem", Map.of("id", "gid://shopify/InventoryItem/ii0"));
        when(shopifyGraphQLClient.getProductVariants("gid://shopify/Product/sp_zero")).thenReturn(List.of(firstVariant));

        boolean result = shopifyProductService.syncInventoryOnly("tenant_1", "gid://shopify/Product/sp_zero", product);

        assertTrue(result);
        verify(shopifyGraphQLClient).setInventoryQuantity("gid://shopify/InventoryItem/ii0", "gid://shopify/Location/loc1", 0);
    }

    // SCENARIO 4: Infinite loop guard active and suppresses echo updates
    @Test
    void testScenario4_InfiniteLoopGuardSuppressesEcho() throws Exception {
        RealtimeStockListener.suppressLoop("prod_echo_123");
        assertTrue(RealtimeStockListener.isSuppressed("prod_echo_123"));

        QueryDocumentSnapshot mockDoc = mock(QueryDocumentSnapshot.class);
        when(mockDoc.getId()).thenReturn("prod_echo_123");
        when(mockDoc.getString("productCode")).thenReturn("ECHO123");

        realtimeStockListener.handleProductUpdate(mockDoc);

        // Verify that Shopify mapping repository and GraphQL client were never invoked
        verify(shopifyConnectionRepository, never()).findById(anyString());
        verify(shopifyGraphQLClient, never()).setInventoryQuantity(anyString(), anyString(), anyInt());
    }

    // SCENARIO 5: Webhook HMAC verification succeeds on valid signature
    @Test
    void testScenario5_WebhookHmacVerificationValid() {
        ReflectionTestUtils.setField(shopifyWebhookController, "clientSecret", "my_secret_key_123");
        String body = "{\"id\":12345,\"line_items\":[]}";

        // Calculate expected HMAC
        String validHmac = "";
        try {
            javax.crypto.Mac mac = javax.crypto.Mac.getInstance("HmacSHA256");
            mac.init(new javax.crypto.spec.SecretKeySpec("my_secret_key_123".getBytes(java.nio.charset.StandardCharsets.UTF_8), "HmacSHA256"));
            validHmac = java.util.Base64.getEncoder().encodeToString(mac.doFinal(body.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        } catch (Exception ignored) {}

        boolean verified = shopifyWebhookController.verifyHmac(body, validHmac);
        assertTrue(verified);
    }

    // SCENARIO 6: Webhook HMAC verification rejects invalid signature (HTTP 401)
    @Test
    void testScenario6_WebhookHmacVerificationInvalidRejects() {
        ReflectionTestUtils.setField(shopifyWebhookController, "clientSecret", "my_secret_key_123");
        String body = "{\"id\":12345,\"line_items\":[]}";

        ResponseEntity<String> response = shopifyWebhookController.handleOrderCreate("tenant_1", "bad_hmac_signature", body);
        assertEquals(401, response.getStatusCode().value());
        assertEquals("Invalid HMAC signature", response.getBody());
    }

    // SCENARIO 7: Webhook handles cancellation endpoint
    @Test
    void testScenario7_WebhookHandlesCancellationEndpoint() {
        ReflectionTestUtils.setField(shopifyWebhookController, "clientSecret", "my_secret_key_123");
        String body = "{\"id\":999,\"cancelled_at\":\"2026-10-20T00:00:00Z\"}";

        String validHmac = "";
        try {
            javax.crypto.Mac mac = javax.crypto.Mac.getInstance("HmacSHA256");
            mac.init(new javax.crypto.spec.SecretKeySpec("my_secret_key_123".getBytes(java.nio.charset.StandardCharsets.UTF_8), "HmacSHA256"));
            validHmac = java.util.Base64.getEncoder().encodeToString(mac.doFinal(body.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        } catch (Exception ignored) {}

        ResponseEntity<String> response = shopifyWebhookController.handleOrderCancelled("tenant_1", validHmac, body);
        assertEquals(200, response.getStatusCode().value());
        assertTrue(response.getBody().contains("Cancellation webhook received"));
    }

    // SCENARIO 8: Missing location fallback handling in syncInventoryOnly
    @Test
    void testScenario8_MissingLocationGracefulFallback() {
        Product product = new Product();
        product.setId("prod_noloc");
        product.setProductCode("NOLOC");
        product.setQuantity(10);

        when(shopifyGraphQLClient.getActiveLocationId()).thenReturn(null);

        boolean result = shopifyProductService.syncInventoryOnly("tenant_1", "gid://shopify/Product/sp_noloc", product);
        assertFalse(result);
        verify(shopifyGraphQLClient, never()).setInventoryQuantity(any(), any(), anyInt());
    }

    // SCENARIO 9: Tenant isolation - syncing only target store mapped to the product
    @Test
    void testScenario9_TenantIsolation() throws Exception {
        QueryDocumentSnapshot mockDoc = mock(QueryDocumentSnapshot.class);
        when(mockDoc.getId()).thenReturn("prod_isolated");
        when(mockDoc.getString("productCode")).thenReturn("ISO_CODE");

        Product p = new Product();
        p.setId("prod_isolated");
        p.setProductCode("ISO_CODE");
        p.setQuantity(5);
        when(mockDoc.toObject(Product.class)).thenReturn(p);

        // Mock Firestore mapping collection query
        var snapMock = mock(com.google.cloud.firestore.QuerySnapshot.class);
        var mappingDoc = mock(QueryDocumentSnapshot.class);
        ShopifyProductMapping mapping = new ShopifyProductMapping("map_1", "tenant_A", "store_A", "sc_conn_A",
                "prod_isolated", "ISO_CODE", "gid://shopify/Product/shopify_isolated", "handle", "MAPPED", "2026-10-20T00:00:00Z", "2026-10-20T00:00:00Z");
        when(mappingDoc.toObject(ShopifyProductMapping.class)).thenReturn(mapping);
        when(snapMock.getDocuments()).thenReturn(List.of(mappingDoc));

        var colRef = mock(com.google.cloud.firestore.CollectionReference.class);
        var queryMock = mock(com.google.cloud.firestore.Query.class);
        var apiFuture = mock(com.google.api.core.ApiFuture.class);
        when(firestore.collection(ShopifyProductMappingRepository.COLLECTION_NAME)).thenReturn(colRef);
        when(colRef.whereEqualTo("productId", "prod_isolated")).thenReturn(queryMock);
        when(queryMock.get()).thenReturn(apiFuture);
        when(apiFuture.get()).thenReturn(snapMock);

        // Store connection belongs only to tenant_A
        ShopifyConnection connection = new ShopifyConnection("sc_conn_A", "tenant_A", "store_A", "tenant-a.myshopify.com",
                null, "CONNECTED", "2026-10-20T00:00:00Z", "2026-10-20T00:00:00Z");
        when(shopifyConnectionRepository.findById("sc_conn_A")).thenReturn(connection);

        when(shopifyGraphQLClient.getActiveLocationId()).thenReturn("gid://shopify/Location/locA");
        when(shopifyGraphQLClient.getProductVariants("gid://shopify/Product/shopify_isolated"))
                .thenReturn(List.of(Map.of("id", "gid://shopify/ProductVariant/vIso", "inventoryItem", Map.of("id", "gid://shopify/InventoryItem/iiIso"))));

        realtimeStockListener.handleProductUpdate(mockDoc);

        // Verify only tenant_A store was updated
        verify(shopifyConnectionRepository).findById("sc_conn_A");
        verify(shopifyGraphQLClient).setInventoryQuantity("gid://shopify/InventoryItem/iiIso", "gid://shopify/Location/locA", 5);
    }

    // SCENARIO 10: Product pricing preservation (syncStockOnly changes only inventory, never price)
    @Test
    void testScenario10_PricingPreservationDuringStockSync() {
        Product product = new Product();
        product.setId("prod_price");
        product.setProductCode("PRICE_TEST");
        product.setBasePrice(120.0);
        product.setQuantity(30);

        when(shopifyGraphQLClient.getActiveLocationId()).thenReturn("gid://shopify/Location/loc1");
        Map<String, Object> firstVariant = Map.of("id", "gid://shopify/ProductVariant/vP",
                "price", "250.00",
                "inventoryItem", Map.of("id", "gid://shopify/InventoryItem/iiP"));
        when(shopifyGraphQLClient.getProductVariants("gid://shopify/Product/sp_price")).thenReturn(List.of(firstVariant));

        shopifyProductService.syncInventoryOnly("tenant_1", "gid://shopify/Product/sp_price", product);

        // Assert updateVariantDetails or updateVariantPrice was never called
        verify(shopifyGraphQLClient, never()).updateVariantPrice(anyString(), anyString(), anyDouble());
        verify(shopifyGraphQLClient, never()).updateVariantDetails(anyString(), anyString(), anyDouble(), anyString());
        // Assert inventory quantity was updated
        verify(shopifyGraphQLClient).setInventoryQuantity("gid://shopify/InventoryItem/iiP", "gid://shopify/Location/loc1", 30);
    }

    // SCENARIO 11: Idempotency check on repetitive calls
    @Test
    void testScenario11_IdempotencyCheck() {
        Product product = new Product();
        product.setId("prod_idem");
        product.setProductCode("IDEM1");
        product.setQuantity(10);

        when(shopifyGraphQLClient.getActiveLocationId()).thenReturn("gid://shopify/Location/loc1");
        Map<String, Object> firstVariant = Map.of("id", "gid://shopify/ProductVariant/vIdem",
                "inventoryItem", Map.of("id", "gid://shopify/InventoryItem/iiIdem"));
        when(shopifyGraphQLClient.getProductVariants("gid://shopify/Product/sp_idem")).thenReturn(List.of(firstVariant));

        // Call syncInventoryOnly twice with the same inventory
        boolean firstCall = shopifyProductService.syncInventoryOnly("tenant_1", "gid://shopify/Product/sp_idem", product);
        boolean secondCall = shopifyProductService.syncInventoryOnly("tenant_1", "gid://shopify/Product/sp_idem", product);

        assertTrue(firstCall);
        assertTrue(secondCall);
        verify(shopifyGraphQLClient, times(2)).setInventoryQuantity("gid://shopify/InventoryItem/iiIdem", "gid://shopify/Location/loc1", 10);
    }

    // SCENARIO 12: Order cancellation restores stock and initiates Shopify sync with loop suppression
    @Test
    void testScenario12_OrderCancellationRestoresStockAndSyncsToShopify() throws Exception {
        var docRef = mock(DocumentReference.class);
        var docSnap = mock(com.google.cloud.firestore.DocumentSnapshot.class);
        var apiFutureSnap = mock(com.google.api.core.ApiFuture.class);
        var apiFutureWrite = mock(com.google.api.core.ApiFuture.class);

        var colTenantOrders = mock(com.google.cloud.firestore.CollectionReference.class);
        when(firestore.collection("apiTenantOrders")).thenReturn(colTenantOrders);
        when(colTenantOrders.document("ord_cancel_123")).thenReturn(docRef);
        when(docRef.get()).thenReturn(apiFutureSnap);
        when(apiFutureSnap.get()).thenReturn(docSnap);
        when(docSnap.exists()).thenReturn(true);

        Map<String, Object> itemMap = new HashMap<>();
        itemMap.put("productId", "prod_cancel_1");
        itemMap.put("productCode", "CAN1");
        itemMap.put("collectionId", "col1");
        itemMap.put("subcollectionId", "sub1");
        itemMap.put("quantity", 2);

        Map<String, Object> orderData = new HashMap<>();
        orderData.put("tenantId", "tenant_order_1");
        orderData.put("inventoryRestored", false);
        orderData.put("items", List.of(itemMap));
        when(docSnap.getData()).thenReturn(orderData);

        // Product in Firestore
        var colColls = mock(com.google.cloud.firestore.CollectionReference.class);
        var docCol = mock(DocumentReference.class);
        var colSubs = mock(com.google.cloud.firestore.CollectionReference.class);
        var docSub = mock(DocumentReference.class);
        var colProds = mock(com.google.cloud.firestore.CollectionReference.class);
        var docProd = mock(DocumentReference.class);
        var prodSnap = mock(com.google.cloud.firestore.DocumentSnapshot.class);
        var apiFutureProdSnap = mock(com.google.api.core.ApiFuture.class);

        when(firestore.collection("collections")).thenReturn(colColls);
        when(colColls.document("col1")).thenReturn(docCol);
        when(docCol.collection("subcollections")).thenReturn(colSubs);
        when(colSubs.document("sub1")).thenReturn(docSub);
        when(docSub.collection("products")).thenReturn(colProds);
        when(colProds.document("prod_cancel_1")).thenReturn(docProd);
        when(docProd.get()).thenReturn(apiFutureProdSnap);
        when(apiFutureProdSnap.get()).thenReturn(prodSnap);
        when(prodSnap.exists()).thenReturn(true);

        Map<String, Object> pData = new HashMap<>();
        pData.put("quantity", 8); // current stock before restoration
        when(prodSnap.getData()).thenReturn(pData);
        when(docProd.update(anyMap())).thenReturn(apiFutureWrite);
        when(docRef.update(anyMap())).thenReturn(apiFutureWrite);

        Product restoredProduct = new Product();
        restoredProduct.setId("prod_cancel_1");
        restoredProduct.setProductCode("CAN1");
        restoredProduct.setQuantity(10); // 8 + 2
        when(productRepository.findByDocumentId("prod_cancel_1")).thenReturn(restoredProduct);

        ShopifyProductMapping mapping = new ShopifyProductMapping("map_can_1", "tenant_order_1", "store_1", "conn_1",
                "prod_cancel_1", "CAN1", "gid://shopify/Product/shopify_can_1", "handle", "MAPPED", "2026-10-20T00:00:00Z", "2026-10-20T00:00:00Z");
        when(shopifyProductMappingRepository.findAllByTenant("tenant_order_1")).thenReturn(List.of(mapping));

        ShopifyConnection connection = new ShopifyConnection("conn_1", "tenant_order_1", "store_1", "tenant.myshopify.com",
                null, "CONNECTED", "2026-10-20T00:00:00Z", "2026-10-20T00:00:00Z");
        when(shopifyConnectionRepository.findById("conn_1")).thenReturn(connection);

        when(shopifyGraphQLClient.getActiveLocationId()).thenReturn("gid://shopify/Location/locCancel");
        when(shopifyGraphQLClient.getProductVariants("gid://shopify/Product/shopify_can_1"))
                .thenReturn(List.of(Map.of("id", "gid://shopify/ProductVariant/vCan", "inventoryItem", Map.of("id", "gid://shopify/InventoryItem/iiCan"))));

        ResponseEntity<Map<String, Object>> response = tenantOrderController.cancelAndRestoreOrder("ord_cancel_123");

        assertEquals(200, response.getStatusCode().value());
        assertTrue((Boolean) response.getBody().get("success"));
        assertEquals(2, response.getBody().get("restoredUnits"));

        // Verify Firestore update happened
        verify(docProd).update(argThat(map -> map != null && Integer.valueOf(10).equals(map.get("quantity"))));

        // Verify loop suppression was engaged
        assertTrue(RealtimeStockListener.isSuppressed("prod_cancel_1"));
        assertTrue(RealtimeStockListener.isSuppressed("CAN1"));

        // Verify Shopify sync was invoked
        verify(shopifyGraphQLClient).setInventoryQuantity("gid://shopify/InventoryItem/iiCan", "gid://shopify/Location/locCancel", 10);
    }
}
