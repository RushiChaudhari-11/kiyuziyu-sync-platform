
package com.kiyuziyu.api.integration.shopify;

import com.kiyuziyu.api.config.ShopifyConfiguration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.http.HttpEntity;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class ShopifyGraphQLClientTest {

    @Mock
    private ShopifyConfiguration config;

    @Mock
    private RestTemplate restTemplate;

    @InjectMocks
    private ShopifyGraphQLClient client;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        ReflectionTestUtils.setField(client, "restTemplate", restTemplate);
        when(config.getStoreDomain()).thenReturn("test.myshopify.com");
        when(config.getAccessToken()).thenReturn("token");
        when(config.getApiVersion()).thenReturn("2026-07");
    }

    // -----------------------------------------------------------------------
    // Helper: build a Shopify-style response with product edges.
    // Each entry in nodeList is a map with keys: "id" and optional "metafieldValue".
    // If "metafieldValue" is null the metafield object is omitted (absent from Shopify).
    // -----------------------------------------------------------------------
    private Map<String, Object> buildSearchResponse(List<Map<String, Object>> nodeList) {
        List<Map<String, Object>> edges = nodeList.stream().map(node -> {
            Map<String, Object> n = new HashMap<>();
            n.put("id", node.get("id"));
            if (node.containsKey("metafieldValue") && node.get("metafieldValue") != null) {
                Map<String, Object> mf = new HashMap<>();
                mf.put("value", node.get("metafieldValue"));
                n.put("metafield", mf);
            } else {
                n.put("metafield", null);
            }
            Map<String, Object> edge = new HashMap<>();
            edge.put("node", n);
            return edge;
        }).toList();

        Map<String, Object> products = new HashMap<>();
        products.put("edges", edges);
        Map<String, Object> data = new HashMap<>();
        data.put("products", products);
        Map<String, Object> response = new HashMap<>();
        response.put("data", data);
        return response;
    }

    private Map<String, Object> node(String id, String metafieldValue) {
        Map<String, Object> n = new HashMap<>();
        n.put("id", id);
        n.put("metafieldValue", metafieldValue);
        return n;
    }

    private Map<String, Object> nodeNoMetafield(String id) {
        Map<String, Object> n = new HashMap<>();
        n.put("id", id);
        // no "metafieldValue" key → metafield absent
        return n;
    }

    // -----------------------------------------------------------------------
    // TEST 1: Exact metafield match → ALREADY_EXISTS (returns the product ID)
    // -----------------------------------------------------------------------
    @Test
    void testFindProductId_ExactMetafieldMatch() {
        when(restTemplate.postForEntity(anyString(), any(HttpEntity.class), eq(Map.class)))
                .thenReturn(ResponseEntity.ok(buildSearchResponse(List.of(
                        node("gid://shopify/Product/111", "523")
                ))));

        String result = client.findProductIdByProductCode("523", "any name");

        assertEquals("gid://shopify/Product/111", result);
        verify(restTemplate, times(1)).postForEntity(anyString(), any(HttpEntity.class), eq(Map.class));
    }

    // -----------------------------------------------------------------------
    // TEST 2: Shopify returns a product BUT the metafield is absent → NOT a duplicate
    // -----------------------------------------------------------------------
    @Test
    void testFindProductId_MissingMetafield_NotADuplicate() {
        when(restTemplate.postForEntity(anyString(), any(HttpEntity.class), eq(Map.class)))
                .thenReturn(ResponseEntity.ok(buildSearchResponse(List.of(
                        nodeNoMetafield("gid://shopify/Product/999")
                ))));

        String result = client.findProductIdByProductCode("523", "any name");

        assertNull(result, "Product without metafield must NOT be treated as duplicate");
        verify(restTemplate, times(1)).postForEntity(anyString(), any(HttpEntity.class), eq(Map.class));
    }

    // -----------------------------------------------------------------------
    // TEST 3: Shopify returns a product whose metafield value does NOT match → NOT a duplicate
    // -----------------------------------------------------------------------
    @Test
    void testFindProductId_MetafieldValueMismatch_NotADuplicate() {
        // A different productCode's product was returned by the search
        when(restTemplate.postForEntity(anyString(), any(HttpEntity.class), eq(Map.class)))
                .thenReturn(ResponseEntity.ok(buildSearchResponse(List.of(
                        node("gid://shopify/Product/10615591764255", "522") // productCode 522, not 523
                ))));

        String result = client.findProductIdByProductCode("523", "any name");

        assertNull(result, "Mismatched metafield value must NOT be treated as duplicate for a different productCode");
    }

    // -----------------------------------------------------------------------
    // TEST 4: Two different productCodes cannot resolve to the same Shopify ID
    // -----------------------------------------------------------------------
    @Test
    void testFindProductId_DifferentProductCodes_MustNotResolveSameShopifyId() {
        // Both searches return the same Shopify product, but with different metafield values.
        // Searching for "522" should only match a product whose metafield = "522".
        // Searching for "523" should only match a product whose metafield = "523".
        String shopifyId = "gid://shopify/Product/10615591764255";

        // Search for "522" → product with metafield "522" → match
        when(restTemplate.postForEntity(anyString(), any(HttpEntity.class), eq(Map.class)))
                .thenReturn(ResponseEntity.ok(buildSearchResponse(List.of(node(shopifyId, "522")))));
        String result522 = client.findProductIdByProductCode("522", "any name");
        assertEquals(shopifyId, result522);

        // Reset
        reset(restTemplate);
        when(config.getStoreDomain()).thenReturn("test.myshopify.com");
        when(config.getAccessToken()).thenReturn("token");
        when(config.getApiVersion()).thenReturn("2026-07");

        // Search for "523" → same Shopify product but its metafield is "522" → must NOT match
        when(restTemplate.postForEntity(anyString(), any(HttpEntity.class), eq(Map.class)))
                .thenReturn(ResponseEntity.ok(buildSearchResponse(List.of(node(shopifyId, "522")))));
        String result523 = client.findProductIdByProductCode("523", "any name");

        assertNull(result523, "productCode 523 must NOT resolve to a Shopify product whose metafield is 522");
    }

    // -----------------------------------------------------------------------
    // TEST 5: Same productCode consistently resolves to the same Shopify ID
    // -----------------------------------------------------------------------
    @Test
    void testFindProductId_SameProductCodeResolvesSameId() {
        String shopifyId = "gid://shopify/Product/555";

        when(restTemplate.postForEntity(anyString(), any(HttpEntity.class), eq(Map.class)))
                .thenReturn(ResponseEntity.ok(buildSearchResponse(List.of(node(shopifyId, "523")))));
        String first = client.findProductIdByProductCode("523", "any name");

        reset(restTemplate);
        when(config.getStoreDomain()).thenReturn("test.myshopify.com");
        when(config.getAccessToken()).thenReturn("token");
        when(config.getApiVersion()).thenReturn("2026-07");

        when(restTemplate.postForEntity(anyString(), any(HttpEntity.class), eq(Map.class)))
                .thenReturn(ResponseEntity.ok(buildSearchResponse(List.of(node(shopifyId, "523")))));
        String second = client.findProductIdByProductCode("523", "any name");

        assertEquals(first, second, "Same productCode must always resolve to the same Shopify ID");
    }

    // -----------------------------------------------------------------------
    // TEST 6: Multiple Shopify candidates returned, exactly one metafield matches
    // -----------------------------------------------------------------------
    @Test
    void testFindProductId_MultipleResults_OnlyOneMatches() {
        when(restTemplate.postForEntity(anyString(), any(HttpEntity.class), eq(Map.class)))
                .thenReturn(ResponseEntity.ok(buildSearchResponse(List.of(
                        node("gid://shopify/Product/001", "522"),      // wrong productCode
                        node("gid://shopify/Product/002", "523"),      // correct match
                        nodeNoMetafield("gid://shopify/Product/003"),  // no metafield
                        node("gid://shopify/Product/004", "524")       // wrong productCode
                ))));

        String result = client.findProductIdByProductCode("523", "any name");

        assertEquals("gid://shopify/Product/002", result,
                "Should return only the product whose metafield exactly matches productCode 523");
    }

    // -----------------------------------------------------------------------
    // TEST 7: No Shopify products returned at all → null (not found)
    // -----------------------------------------------------------------------
    @Test
    void testFindProductId_NoResultsFromShopify() {
        when(restTemplate.postForEntity(anyString(), any(HttpEntity.class), eq(Map.class)))
                .thenReturn(ResponseEntity.ok(buildSearchResponse(Collections.emptyList())));

        String result = client.findProductIdByProductCode("523", "any name");

        assertNull(result, "When Shopify returns no products, result must be null");
        // Only one HTTP call is made (no fallbacks)
        verify(restTemplate, times(1)).postForEntity(anyString(), any(HttpEntity.class), eq(Map.class));
    }

    // -----------------------------------------------------------------------
    // TEST 8: Multiple candidates all have the SAME exact metafield value
    //         → CONFLICT: ShopifyDuplicateConflictException is thrown, NO product selected
    // -----------------------------------------------------------------------
    @Test
    void testFindProductId_MultipleExactMatches_ConflictException() {
        // Both products have metafield value "523" — a data-integrity problem in Shopify.
        when(restTemplate.postForEntity(anyString(), any(HttpEntity.class), eq(Map.class)))
                .thenReturn(ResponseEntity.ok(buildSearchResponse(List.of(
                        node("gid://shopify/Product/AAA", "523"),
                        node("gid://shopify/Product/BBB", "523")
                ))));

        ShopifyDuplicateConflictException ex = assertThrows(
                ShopifyDuplicateConflictException.class,
                () -> client.findProductIdByProductCode("523", "any name"),
                "Multiple exact matches must throw ShopifyDuplicateConflictException — never select one arbitrarily"
        );

        // The exception must carry both conflicting IDs
        assertNotNull(ex.getConflictingShopifyIds());
        assertEquals(2, ex.getConflictingShopifyIds().size());
        assertTrue(ex.getConflictingShopifyIds().contains("gid://shopify/Product/AAA"));
        assertTrue(ex.getConflictingShopifyIds().contains("gid://shopify/Product/BBB"));
        assertEquals("523", ex.getProductCode());
    }

    // -----------------------------------------------------------------------
    // TEST 9: null / empty productCode → returns null immediately without querying Shopify
    // -----------------------------------------------------------------------
    @Test
    void testFindProductId_NullProductCode_ReturnsNull() {
        String result = client.findProductIdByProductCode(null, "any name");
        assertNull(result);
        verifyNoInteractions(restTemplate);
    }

    @Test
    void testFindProductId_EmptyProductCode_ReturnsNull() {
        String result = client.findProductIdByProductCode("", "any name");
        assertNull(result);
        verifyNoInteractions(restTemplate);
    }

    // -----------------------------------------------------------------------
    // TEST 10: findProductIdByFirebaseId - Exact match on kiyuziyu.product_id
    // -----------------------------------------------------------------------
    @Test
    void testFindProductIdByFirebaseId_ExactMatch() {
        when(restTemplate.postForEntity(anyString(), any(HttpEntity.class), eq(Map.class)))
                .thenReturn(ResponseEntity.ok(buildSearchResponse(List.of(
                        node("gid://shopify/Product/777", "nvVLkJ9cxcrdXp3UfSMP")
                ))));

        String result = client.findProductIdByFirebaseId("nvVLkJ9cxcrdXp3UfSMP");

        assertEquals("gid://shopify/Product/777", result);
        verify(restTemplate, times(1)).postForEntity(anyString(), any(HttpEntity.class), eq(Map.class));
    }

    // -----------------------------------------------------------------------
    // TEST 11: findProductIdByFirebaseId - Missing metafield is not a match
    // -----------------------------------------------------------------------
    @Test
    void testFindProductIdByFirebaseId_MissingMetafield_NotADuplicate() {
        when(restTemplate.postForEntity(anyString(), any(HttpEntity.class), eq(Map.class)))
                .thenReturn(ResponseEntity.ok(buildSearchResponse(List.of(
                        nodeNoMetafield("gid://shopify/Product/888")
                ))));

        String result = client.findProductIdByFirebaseId("nvVLkJ9cxcrdXp3UfSMP");

        assertNull(result, "Product without kiyuziyu.product_id must not match");
    }

    // -----------------------------------------------------------------------
    // TEST 12: findProductIdByFirebaseId - Metafield value mismatch
    // -----------------------------------------------------------------------
    @Test
    void testFindProductIdByFirebaseId_MetafieldMismatch() {
        when(restTemplate.postForEntity(anyString(), any(HttpEntity.class), eq(Map.class)))
                .thenReturn(ResponseEntity.ok(buildSearchResponse(List.of(
                        node("gid://shopify/Product/888", "otherDocId")
                ))));

        String result = client.findProductIdByFirebaseId("nvVLkJ9cxcrdXp3UfSMP");

        assertNull(result, "Product with different kiyuziyu.product_id must not match");
    }

    // -----------------------------------------------------------------------
    // TEST 13: findProductIdByFirebaseId - Multiple exact matches -> CONFLICT
    // -----------------------------------------------------------------------
    @Test
    void testFindProductIdByFirebaseId_MultipleExactMatches_ConflictException() {
        when(restTemplate.postForEntity(anyString(), any(HttpEntity.class), eq(Map.class)))
                .thenReturn(ResponseEntity.ok(buildSearchResponse(List.of(
                        node("gid://shopify/Product/AAA", "doc_duplicate"),
                        node("gid://shopify/Product/BBB", "doc_duplicate")
                ))));

        ShopifyDuplicateConflictException ex = assertThrows(
                ShopifyDuplicateConflictException.class,
                () -> client.findProductIdByFirebaseId("doc_duplicate"),
                "Multiple exact matches on product_id must throw ShopifyDuplicateConflictException"
        );

        assertNotNull(ex.getConflictingShopifyIds());
        assertEquals(2, ex.getConflictingShopifyIds().size());
        assertTrue(ex.getConflictingShopifyIds().contains("gid://shopify/Product/AAA"));
        assertTrue(ex.getConflictingShopifyIds().contains("gid://shopify/Product/BBB"));
        assertEquals("doc_duplicate", ex.getProductId());
    }

    // -----------------------------------------------------------------------
    // TEST 14: findProductIdByFirebaseId - null or empty productId returns null
    // -----------------------------------------------------------------------
    @Test
    void testFindProductIdByFirebaseId_NullOrEmpty_ReturnsNull() {
        assertNull(client.findProductIdByFirebaseId(null));
        assertNull(client.findProductIdByFirebaseId(""));
        assertNull(client.findProductIdByFirebaseId("   "));
        verifyNoInteractions(restTemplate);
    }

    // -----------------------------------------------------------------------
    private void mockStandardProductFlow(Map<String, Object> productCreateData) {
        when(restTemplate.postForEntity(anyString(), any(HttpEntity.class), eq(Map.class)))
                .thenAnswer(invocation -> {
                    HttpEntity<Map<String, Object>> entity = invocation.getArgument(1);
                    Map<String, Object> body = entity.getBody();
                    String query = body != null ? (String) body.get("query") : "";

                    if (query.contains("verifyProduct")) {
                        Map<String, Object> vars = body != null ? (Map<String, Object>) body.get("variables") : Collections.emptyMap();
                        String prodId = vars != null && vars.get("id") != null ? vars.get("id").toString() : "gid://shopify/Product/999";
                        return ResponseEntity.ok(Map.of("data", Map.of("product", Map.of(
                                "id", prodId,
                                "title", "Watch",
                                "productType", "Watch Accessories",
                                "collections", Map.of("edges", List.of(Map.of("node", Map.of("id", "gid://shopify/Collection/1", "title", "Watch Accessories")))),
                                "variants", Map.of("edges", List.of(Map.of("node", Map.of(
                                        "id", "gid://shopify/ProductVariant/888",
                                        "title", "Default Title",
                                        "inventoryItem", Map.of("id", "inv-1", "tracked", true)
                                )))),
                                "metafields", Map.of("edges", List.of(
                                        Map.of("node", Map.of("key", "product_code", "value", "837")),
                                        Map.of("node", Map.of("key", "product_id", "value", "nvVLkJ9cxcrdXp3UfSMP")),
                                        Map.of("node", Map.of("key", "base_price", "value", "150.00"))
                                ))
                        ))));
                    }
                    if (query.contains("productCreate")) {
                        return ResponseEntity.ok(Map.of("data", Map.of("productCreate", productCreateData)));
                    }
                    if (query.contains("metafieldsSet")) {
                        return ResponseEntity.ok(Map.of("data", Map.of("metafieldsSet", Map.of(
                                "metafields", List.of(Map.of("id", "gid://shopify/Metafield/1")),
                                "userErrors", Collections.emptyList()
                        ))));
                    }
                    if (query.contains("productOptionsCreate")) {
                        return ResponseEntity.ok(Map.of("data", Map.of("productOptionsCreate", Map.of(
                                "product", Map.of("id", "gid://shopify/Product/1000"),
                                "userErrors", Collections.emptyList()
                        ))));
                    }
                    if (query.contains("productVariantsBulkCreate")) {
                        return ResponseEntity.ok(Map.of("data", Map.of("productVariantsBulkCreate", Map.of(
                                "product", Map.of("id", "gid://shopify/Product/1000"),
                                "productVariants", List.of(Map.of(
                                        "id", "gid://shopify/ProductVariant/2001",
                                        "title", "Silver / Standard",
                                        "inventoryItem", Map.of("id", "gid://shopify/InventoryItem/2001", "tracked", true)
                                )),
                                "userErrors", Collections.emptyList()
                        ))));
                    }
                    if (query.contains("inventoryItemUpdate")) {
                        return ResponseEntity.ok(Map.of("data", Map.of("inventoryItemUpdate", Map.of(
                                "inventoryItem", Map.of("id", "gid://shopify/InventoryItem/2001", "tracked", true),
                                "userErrors", Collections.emptyList()
                        ))));
                    }
                    if (query.contains("inventorySetQuantities")) {
                        return ResponseEntity.ok(Map.of("data", Map.of("inventorySetQuantities", Map.of(
                                "inventoryAdjustmentGroup", Map.of("reason", "correction"),
                                "userErrors", Collections.emptyList()
                        ))));
                    }
                    if (query.contains("collectionAddProducts")) {
                        return ResponseEntity.ok(Map.of("data", Map.of("collectionAddProducts", Map.of(
                                "collection", Map.of("id", "gid://shopify/Collection/1", "title", "Watch"),
                                "userErrors", Collections.emptyList()
                        ))));
                    }
                    if (query.contains("findCollection") || query.contains("collections(first:")) {
                        return ResponseEntity.ok(Map.of("data", Map.of("collections", Map.of("edges", Collections.emptyList()))));
                    }
                    if (query.contains("collectionCreate")) {
                        return ResponseEntity.ok(Map.of("data", Map.of("collectionCreate", Map.of(
                                "collection", Map.of("id", "gid://shopify/Collection/1", "title", "Watch Accessories"),
                                "userErrors", Collections.emptyList()
                        ))));
                    }
                    if (query.contains("locations(")) {
                        return ResponseEntity.ok(Map.of("data", Map.of("locations", Map.of("edges", List.of(Map.of("node", Map.of(
                                "id", "gid://shopify/Location/1",
                                "name", "Main",
                                "isActive", true,
                                "isPrimary", true
                        )))))));
                    }
                    return ResponseEntity.ok(Map.of("data", Collections.emptyMap()));
                });
    }

    // -----------------------------------------------------------------------
    // TEST 15: createProduct sends both product_code and product_id metafields via metafieldsSet
    // -----------------------------------------------------------------------
    @Test
    @SuppressWarnings("unchecked")
    void testCreateProduct_IncludesBothMetafields() {
        Map<String, Object> productNode = new HashMap<>();
        productNode.put("id", "gid://shopify/Product/999");
        Map<String, Object> variantEdge = new HashMap<>();
        Map<String, Object> variantNode = new HashMap<>();
        variantNode.put("id", "gid://shopify/ProductVariant/888");
        variantEdge.put("node", variantNode);
        Map<String, Object> variantsMap = new HashMap<>();
        variantsMap.put("edges", List.of(variantEdge));
        productNode.put("variants", variantsMap);

        Map<String, Object> productCreateData = new HashMap<>();
        productCreateData.put("product", productNode);
        productCreateData.put("userErrors", Collections.emptyList());

        mockStandardProductFlow(productCreateData);

        Map<String, String> result = client.createProduct(
                "Silver Ring", "<p>A fine ring</p>", "837", "nvVLkJ9cxcrdXp3UfSMP",
                150.0, 199.0, "https://example.com/img.jpg", Collections.emptyList(),
                Collections.emptyList(), "Watch Accessories", Collections.emptyList(), null, 10
        );

        assertNotNull(result);
        assertEquals("gid://shopify/Product/999", result.get("productId"));

        org.mockito.ArgumentCaptor<HttpEntity> captor = org.mockito.ArgumentCaptor.forClass(HttpEntity.class);
        verify(restTemplate, atLeastOnce()).postForEntity(anyString(), captor.capture(), eq(Map.class));

        // Locate metafieldsSet call among captured requests
        HttpEntity mfEntity = captor.getAllValues().stream()
                .filter(e -> e.getBody() != null && ((Map<String, Object>) e.getBody()).get("query").toString().contains("metafieldsSet"))
                .findFirst().orElse(null);
        assertNotNull(mfEntity, "metafieldsSet mutation must be executed");

        Map<String, Object> mfBody = (Map<String, Object>) mfEntity.getBody();
        Map<String, Object> vars = (Map<String, Object>) mfBody.get("variables");
        List<Map<String, Object>> metafields = (List<Map<String, Object>>) vars.get("metafields");

        assertTrue(metafields.size() >= 2, "Must contain at least product_code and product_id metafields");

        boolean hasProductCode = metafields.stream().anyMatch(m ->
                "kiyuziyu".equals(m.get("namespace")) &&
                "product_code".equals(m.get("key")) &&
                "837".equals(m.get("value")) &&
                "single_line_text_field".equals(m.get("type"))
        );
        boolean hasProductId = metafields.stream().anyMatch(m ->
                "kiyuziyu".equals(m.get("namespace")) &&
                "product_id".equals(m.get("key")) &&
                "nvVLkJ9cxcrdXp3UfSMP".equals(m.get("value")) &&
                "single_line_text_field".equals(m.get("type"))
        );

        assertTrue(hasProductCode, "Metafield kiyuziyu.product_code must be present");
        assertTrue(hasProductId, "Metafield kiyuziyu.product_id must be present");
    }

    // -----------------------------------------------------------------------
    // TEST 16: createProduct with basePrice sends product_code, product_id, and base_price metafields via metafieldsSet
    // -----------------------------------------------------------------------
    @Test
    @SuppressWarnings("unchecked")
    void testCreateProduct_IncludesBasePriceMetafield() {
        Map<String, Object> productNode = new HashMap<>();
        productNode.put("id", "gid://shopify/Product/999");
        Map<String, Object> variantEdge = new HashMap<>();
        Map<String, Object> variantNode = new HashMap<>();
        variantNode.put("id", "gid://shopify/ProductVariant/888");
        variantEdge.put("node", variantNode);
        Map<String, Object> variantsMap = new HashMap<>();
        variantsMap.put("edges", List.of(variantEdge));
        productNode.put("variants", variantsMap);

        Map<String, Object> productCreateData = new HashMap<>();
        productCreateData.put("product", productNode);
        productCreateData.put("userErrors", Collections.emptyList());

        mockStandardProductFlow(productCreateData);

        Map<String, String> result = client.createProduct(
                "Silver Ring", "<p>A fine ring</p>", "837", "nvVLkJ9cxcrdXp3UfSMP",
                150.0, 199.0, "https://example.com/img.jpg", Collections.emptyList(),
                Collections.emptyList(), "Watch Accessories", Collections.emptyList(), null, 10
        );

        assertNotNull(result);
        assertEquals("gid://shopify/Product/999", result.get("productId"));

        org.mockito.ArgumentCaptor<HttpEntity> captor = org.mockito.ArgumentCaptor.forClass(HttpEntity.class);
        verify(restTemplate, atLeastOnce()).postForEntity(anyString(), captor.capture(), eq(Map.class));

        HttpEntity mfEntity = captor.getAllValues().stream()
                .filter(e -> e.getBody() != null && ((Map<String, Object>) e.getBody()).get("query").toString().contains("metafieldsSet"))
                .findFirst().orElse(null);
        assertNotNull(mfEntity, "metafieldsSet mutation must be executed");

        Map<String, Object> mfBody = (Map<String, Object>) mfEntity.getBody();
        Map<String, Object> vars = (Map<String, Object>) mfBody.get("variables");
        List<Map<String, Object>> metafields = (List<Map<String, Object>>) vars.get("metafields");

        assertTrue(metafields.size() >= 3, "Must contain product_code, product_id, and base_price metafields");

        boolean hasBasePrice = metafields.stream().anyMatch(m ->
                "kiyuziyu".equals(m.get("namespace")) &&
                "base_price".equals(m.get("key")) &&
                "150.00".equals(m.get("value")) &&
                "number_decimal".equals(m.get("type"))
        );

        assertTrue(hasBasePrice, "Metafield kiyuziyu.base_price must be present with type number_decimal and value 150.00");
    }

    // -----------------------------------------------------------------------
    // TEST 17: 10-arg createProduct sends productType, tags, media list, and variations metafield
    // -----------------------------------------------------------------------
    @Test
    @SuppressWarnings("unchecked")
    void testCreateProduct_FullProductImportAttributes() {
        Map<String, Object> productNode = new HashMap<>();
        productNode.put("id", "gid://shopify/Product/1000");
        Map<String, Object> variantEdge = new HashMap<>();
        Map<String, Object> variantNode = new HashMap<>();
        variantNode.put("id", "gid://shopify/ProductVariant/2000");
        variantEdge.put("node", variantNode);
        Map<String, Object> variantsMap = new HashMap<>();
        variantsMap.put("edges", List.of(variantEdge));
        productNode.put("variants", variantsMap);

        Map<String, Object> productCreateData = new HashMap<>();
        productCreateData.put("product", productNode);
        productCreateData.put("userErrors", Collections.emptyList());

        mockStandardProductFlow(productCreateData);

        Map<String, Object> variation1 = Map.of("color", "Silver", "size", "Standard", "quantity", 5);

        Map<String, String> result = client.createProduct(
                "Watch Strap", "Leather strap", "837", "nvVLkJ9cxcrdXp3UfSMP",
                150.0, 199.0, "https://cdn.example.com/main.png", List.of("https://cdn.example.com/extra1.png"),
                List.of("watch", "luxury"), "Watch Accessories", List.of(variation1), null, 10
        );

        assertNotNull(result);
        assertEquals("gid://shopify/Product/1000", result.get("productId"));

        org.mockito.ArgumentCaptor<HttpEntity> captor = org.mockito.ArgumentCaptor.forClass(HttpEntity.class);
        verify(restTemplate, atLeastOnce()).postForEntity(anyString(), captor.capture(), eq(Map.class));

        // Find the productCreate call among captured requests
        HttpEntity productCreateEntity = captor.getAllValues().stream()
                .filter(e -> e.getBody() != null && ((Map<String, Object>) e.getBody()).get("query").toString().contains("productCreate"))
                .findFirst().orElse(null);
        assertNotNull(productCreateEntity);

        Map<String, Object> sentBody = (Map<String, Object>) productCreateEntity.getBody();
        assertNotNull(sentBody);
        Map<String, Object> variables = (Map<String, Object>) sentBody.get("variables");
        Map<String, Object> input = (Map<String, Object>) variables.get("input");

        assertEquals("Watch Accessories", input.get("productType"));
        List<String> resultTags = (List<String>) input.get("tags");
        assertTrue(resultTags.contains("watch") && resultTags.contains("luxury"));

        List<Map<String, Object>> media = (List<Map<String, Object>>) variables.get("media");
        assertNotNull(media);
        assertEquals(2, media.size());
        assertEquals("https://cdn.example.com/main.png", media.get(0).get("originalSource"));
        assertEquals("https://cdn.example.com/extra1.png", media.get(1).get("originalSource"));

        HttpEntity mfEntity = captor.getAllValues().stream()
                .filter(e -> e.getBody() != null && ((Map<String, Object>) e.getBody()).get("query").toString().contains("metafieldsSet"))
                .findFirst().orElse(null);
        assertNotNull(mfEntity, "metafieldsSet mutation must be executed");

        Map<String, Object> mfBody = (Map<String, Object>) mfEntity.getBody();
        Map<String, Object> vars = (Map<String, Object>) mfBody.get("variables");
        List<Map<String, Object>> metafields = (List<Map<String, Object>>) vars.get("metafields");

        boolean hasVariationsMetafield = metafields.stream().anyMatch(m ->
                "kiyuziyu".equals(m.get("namespace")) &&
                "variations".equals(m.get("key")) &&
                "json".equals(m.get("type"))
        );
        assertTrue(hasVariationsMetafield, "Metafield kiyuziyu.variations must be present with type json");
    }

    // -----------------------------------------------------------------------
    // TEST 18: getActiveLocationId discovers primary active location
    // -----------------------------------------------------------------------
    @Test
    void testActiveLocationDiscovery() {
        client.clearCaches();
        Map<String, Object> locNode1 = Map.of("id", "gid://shopify/Location/1", "name", "Secondary", "isActive", true, "isPrimary", false);
        Map<String, Object> locNode2 = Map.of("id", "gid://shopify/Location/2", "name", "Main Warehouse", "isActive", true, "isPrimary", true);

        Map<String, Object> edge1 = Map.of("node", locNode1);
        Map<String, Object> edge2 = Map.of("node", locNode2);

        Map<String, Object> locationsData = Map.of("locations", Map.of("edges", List.of(edge1, edge2)));
        Map<String, Object> responseBody = Map.of("data", locationsData);

        when(restTemplate.postForEntity(anyString(), any(HttpEntity.class), eq(Map.class)))
                .thenReturn(ResponseEntity.ok(responseBody));

        String locId = client.getActiveLocationId();
        assertEquals("gid://shopify/Location/2", locId, "Must return active primary location");
    }

    // -----------------------------------------------------------------------
    // TEST 19: enableInventoryTracking executes inventoryItemUpdate mutation
    // -----------------------------------------------------------------------
    @Test
    @SuppressWarnings("unchecked")
    void testEnableInventoryTracking() {
        Map<String, Object> itemData = Map.of("inventoryItemUpdate", Map.of(
                "inventoryItem", Map.of("id", "gid://shopify/InventoryItem/555", "tracked", true),
                "userErrors", Collections.emptyList()
        ));
        when(restTemplate.postForEntity(anyString(), any(HttpEntity.class), eq(Map.class)))
                .thenReturn(ResponseEntity.ok(Map.of("data", itemData)));

        client.enableInventoryTracking("gid://shopify/InventoryItem/555");

        org.mockito.ArgumentCaptor<HttpEntity> captor = org.mockito.ArgumentCaptor.forClass(HttpEntity.class);
        verify(restTemplate).postForEntity(anyString(), captor.capture(), eq(Map.class));

        Map<String, Object> body = (Map<String, Object>) captor.getValue().getBody();
        assertTrue(((String) body.get("query")).contains("inventoryItemUpdate"));
        Map<String, Object> vars = (Map<String, Object>) body.get("variables");
        assertEquals("gid://shopify/InventoryItem/555", vars.get("id"));
    }

    // -----------------------------------------------------------------------
    // TEST 20: setInventoryQuantity executes inventorySetQuantities mutation
    // -----------------------------------------------------------------------
    @Test
    @SuppressWarnings("unchecked")
    void testSetInventoryQuantity() {
        Map<String, Object> qtyData = Map.of("inventorySetQuantities", Map.of(
                "inventoryAdjustmentGroup", Map.of("reason", "correction"),
                "userErrors", Collections.emptyList()
        ));
        when(restTemplate.postForEntity(anyString(), any(HttpEntity.class), eq(Map.class)))
                .thenReturn(ResponseEntity.ok(Map.of("data", qtyData)));

        client.setInventoryQuantity("gid://shopify/InventoryItem/555", "gid://shopify/Location/2", 15);

        org.mockito.ArgumentCaptor<HttpEntity> captor = org.mockito.ArgumentCaptor.forClass(HttpEntity.class);
        verify(restTemplate).postForEntity(anyString(), captor.capture(), eq(Map.class));

        Map<String, Object> body = (Map<String, Object>) captor.getValue().getBody();
        assertTrue(((String) body.get("query")).contains("inventorySetQuantities"));
        Map<String, Object> vars = (Map<String, Object>) body.get("variables");
        Map<String, Object> input = (Map<String, Object>) vars.get("input");
        List<Map<String, Object>> quantities = (List<Map<String, Object>>) input.get("quantities");
        assertEquals(1, quantities.size());
        assertEquals(15, quantities.get(0).get("quantity"));
        assertEquals("gid://shopify/InventoryItem/555", quantities.get(0).get("inventoryItemId"));
        assertEquals("gid://shopify/Location/2", quantities.get(0).get("locationId"));
    }

    // -----------------------------------------------------------------------
    // TEST 21: findOrCreateCollection reuses existing collection when found
    // -----------------------------------------------------------------------
    @Test
    void testCollectionReuse_ExistingMatch() {
        client.clearCaches();
        Map<String, Object> colNode = Map.of("id", "gid://shopify/Collection/777", "title", "Watch Bracelet");
        Map<String, Object> edge = Map.of("node", colNode);
        Map<String, Object> collectionsData = Map.of("collections", Map.of("edges", List.of(edge)));

        when(restTemplate.postForEntity(anyString(), any(HttpEntity.class), eq(Map.class)))
                .thenReturn(ResponseEntity.ok(Map.of("data", collectionsData)));

        String colId = client.findOrCreateCollection("Watch Bracelet");
        assertEquals("gid://shopify/Collection/777", colId);

        // Second call should hit the cache without calling restTemplate again
        String colIdCached = client.findOrCreateCollection("Watch Bracelet");
        assertEquals("gid://shopify/Collection/777", colIdCached);
        verify(restTemplate, times(1)).postForEntity(anyString(), any(HttpEntity.class), eq(Map.class));
    }

    // -----------------------------------------------------------------------
    // TEST 22: findOrCreateCollection creates collection when not found
    // -----------------------------------------------------------------------
    @Test
    void testCollectionCreate_WhenNotFound() {
        client.clearCaches();
        // 1. Search returns empty
        Map<String, Object> emptySearch = Map.of("collections", Map.of("edges", Collections.emptyList()));
        // 2. collectionCreate returns new collection
        Map<String, Object> createData = Map.of("collectionCreate", Map.of(
                "collection", Map.of("id", "gid://shopify/Collection/888", "title", "Rings"),
                "userErrors", Collections.emptyList()
        ));

        when(restTemplate.postForEntity(anyString(), any(HttpEntity.class), eq(Map.class)))
                .thenReturn(ResponseEntity.ok(Map.of("data", emptySearch)))
                .thenReturn(ResponseEntity.ok(Map.of("data", createData)));

        String colId = client.findOrCreateCollection("Rings");
        assertEquals("gid://shopify/Collection/888", colId);
    }

    // -----------------------------------------------------------------------
    // TEST 23: buildOptionValues with name only maps to Option name 'Color'
    // -----------------------------------------------------------------------
    @Test
    void testBuildOptionValues_WithNameOnly() {
        Map<String, Object> v = Map.of("name", "Green", "quantity", 10);
        List<Map<String, String>> optionValues = ShopifyGraphQLClient.buildOptionValues(v, 1);

        assertEquals(1, optionValues.size());
        assertEquals("Color", optionValues.get(0).get("optionName"));
        assertEquals("Green", optionValues.get(0).get("name"));
    }

    // -----------------------------------------------------------------------
    // TEST 24: Trial plan media upload error is handled and tagged as ShopifyGraphQLException
    // -----------------------------------------------------------------------
    @Test
    void testTrialAccountMediaUploadError() {
        Map<String, Object> userError = Map.of(
                "field", List.of("media", "0", "originalSource"),
                "message", "The file is not supported on trial accounts. Select a plan to upload this file."
        );
        Map<String, Object> productCreateData = Map.of(
                "product", Collections.emptyMap(),
                "userErrors", List.of(userError)
        );

        when(restTemplate.postForEntity(anyString(), any(HttpEntity.class), eq(Map.class)))
                .thenReturn(ResponseEntity.ok(Map.of("data", Map.of("productCreate", productCreateData))));

        ShopifyGraphQLException ex = assertThrows(ShopifyGraphQLException.class, () -> {
            client.createProduct("Title", null, "837", "nvVLkJ9cxcrdXp3UfSMP", 150.0, 199.0, "https://example.com/bad.png", null, null, null, null, null, 10);
        });

        assertTrue(ex.getMessage().contains("The file is not supported on trial accounts"));
    }

    // -----------------------------------------------------------------------
    // TEST 25: metafieldsSet success
    // -----------------------------------------------------------------------
    @Test
    @SuppressWarnings("unchecked")
    void testSetProductMetafields_Success() {
        Map<String, Object> mfData = Map.of("metafieldsSet", Map.of(
                "metafields", List.of(Map.of("id", "gid://shopify/Metafield/1")),
                "userErrors", Collections.emptyList()
        ));
        when(restTemplate.postForEntity(anyString(), any(HttpEntity.class), eq(Map.class)))
                .thenReturn(ResponseEntity.ok(Map.of("data", mfData)));

        client.setProductMetafields("gid://shopify/Product/1", "doc_123", "CODE_123", 199.99, List.of(Map.of("name", "Blue")), "SubColName");

        org.mockito.ArgumentCaptor<HttpEntity> captor = org.mockito.ArgumentCaptor.forClass(HttpEntity.class);
        verify(restTemplate).postForEntity(anyString(), captor.capture(), eq(Map.class));

        Map<String, Object> body = (Map<String, Object>) captor.getValue().getBody();
        assertTrue(((String) body.get("query")).contains("metafieldsSet"));
        Map<String, Object> vars = (Map<String, Object>) body.get("variables");
        List<Map<String, Object>> metafields = (List<Map<String, Object>>) vars.get("metafields");
        assertEquals(5, metafields.size());
    }

    // -----------------------------------------------------------------------
    // TEST 26: metafieldsSet userErrors throws ShopifyGraphQLException
    // -----------------------------------------------------------------------
    @Test
    void testSetProductMetafields_UserErrors() {
        Map<String, Object> error = Map.of("field", List.of("metafields", "0", "value"), "message", "Invalid decimal", "code", "INVALID");
        Map<String, Object> mfData = Map.of("metafieldsSet", Map.of(
                "metafields", Collections.emptyList(),
                "userErrors", List.of(error)
        ));
        when(restTemplate.postForEntity(anyString(), any(HttpEntity.class), eq(Map.class)))
                .thenReturn(ResponseEntity.ok(Map.of("data", mfData)));

        ShopifyGraphQLException ex = assertThrows(ShopifyGraphQLException.class, () -> {
            client.setProductMetafields("gid://shopify/Product/1", "doc_123", "CODE_123", 199.99, null, null);
        });

        assertTrue(ex.getMessage().contains("Invalid decimal"));
    }

    // -----------------------------------------------------------------------
    // TEST 27: productId metafield verification
    // -----------------------------------------------------------------------
    @Test
    @SuppressWarnings("unchecked")
    void testSetProductMetafields_ProductIdMetafield() {
        Map<String, Object> mfData = Map.of("metafieldsSet", Map.of(
                "metafields", List.of(Map.of("id", "gid://shopify/Metafield/1")),
                "userErrors", Collections.emptyList()
        ));
        when(restTemplate.postForEntity(anyString(), any(HttpEntity.class), eq(Map.class)))
                .thenReturn(ResponseEntity.ok(Map.of("data", mfData)));

        client.setProductMetafields("gid://shopify/Product/1", "doc_exact_id", "CODE_123", null, null, null);

        org.mockito.ArgumentCaptor<HttpEntity> captor = org.mockito.ArgumentCaptor.forClass(HttpEntity.class);
        verify(restTemplate).postForEntity(anyString(), captor.capture(), eq(Map.class));

        Map<String, Object> body = (Map<String, Object>) captor.getValue().getBody();
        Map<String, Object> vars = (Map<String, Object>) body.get("variables");
        List<Map<String, Object>> metafields = (List<Map<String, Object>>) vars.get("metafields");

        Map<String, Object> idMf = metafields.stream()
                .filter(m -> "product_id".equals(m.get("key")))
                .findFirst().orElse(null);

        assertNotNull(idMf);
        assertEquals("doc_exact_id", idMf.get("value"));
        assertEquals("single_line_text_field", idMf.get("type"));
        assertEquals("kiyuziyu", idMf.get("namespace"));
    }

    // -----------------------------------------------------------------------
    // TEST 28: basePrice metafield verification
    // -----------------------------------------------------------------------
    @Test
    @SuppressWarnings("unchecked")
    void testSetProductMetafields_BasePriceMetafield() {
        Map<String, Object> mfData = Map.of("metafieldsSet", Map.of(
                "metafields", List.of(Map.of("id", "gid://shopify/Metafield/1")),
                "userErrors", Collections.emptyList()
        ));
        when(restTemplate.postForEntity(anyString(), any(HttpEntity.class), eq(Map.class)))
                .thenReturn(ResponseEntity.ok(Map.of("data", mfData)));

        client.setProductMetafields("gid://shopify/Product/1", null, null, 250.50, null, null);

        org.mockito.ArgumentCaptor<HttpEntity> captor = org.mockito.ArgumentCaptor.forClass(HttpEntity.class);
        verify(restTemplate).postForEntity(anyString(), captor.capture(), eq(Map.class));

        Map<String, Object> body = (Map<String, Object>) captor.getValue().getBody();
        Map<String, Object> vars = (Map<String, Object>) body.get("variables");
        List<Map<String, Object>> metafields = (List<Map<String, Object>>) vars.get("metafields");

        Map<String, Object> priceMf = metafields.stream()
                .filter(m -> "base_price".equals(m.get("key")))
                .findFirst().orElse(null);

        assertNotNull(priceMf);
        assertEquals("250.50", priceMf.get("value"));
        assertEquals("number_decimal", priceMf.get("type"));
        assertEquals("kiyuziyu", priceMf.get("namespace"));
    }

    // -----------------------------------------------------------------------
    // TEST 29: inventoryItemUpdate userErrors throws ShopifyGraphQLException
    // -----------------------------------------------------------------------
    @Test
    void testInventoryItemUpdate_UserErrors() {
        Map<String, Object> error = Map.of("field", List.of("id"), "message", "Inventory item not found", "code", "NOT_FOUND");
        Map<String, Object> itemData = Map.of("inventoryItemUpdate", Map.of(
                "inventoryItem", Collections.emptyMap(),
                "userErrors", List.of(error)
        ));
        when(restTemplate.postForEntity(anyString(), any(HttpEntity.class), eq(Map.class)))
                .thenReturn(ResponseEntity.ok(Map.of("data", itemData)));

        ShopifyGraphQLException ex = assertThrows(ShopifyGraphQLException.class, () -> {
            client.enableInventoryTracking("gid://shopify/InventoryItem/bad");
        });

        assertTrue(ex.getMessage().contains("Inventory item not found"));
    }

    // -----------------------------------------------------------------------
    // TEST 30: inventorySetQuantities userErrors throws ShopifyGraphQLException
    // -----------------------------------------------------------------------
    @Test
    void testInventorySetQuantities_UserErrors() {
        Map<String, Object> error = Map.of("field", List.of("input", "quantities"), "message", "Invalid location", "code", "LOCATION_NOT_FOUND");
        Map<String, Object> qtyData = Map.of("inventorySetQuantities", Map.of(
                "inventoryAdjustmentGroup", Collections.emptyMap(),
                "userErrors", List.of(error)
        ));
        when(restTemplate.postForEntity(anyString(), any(HttpEntity.class), eq(Map.class)))
                .thenReturn(ResponseEntity.ok(Map.of("data", qtyData)));

        ShopifyGraphQLException ex = assertThrows(ShopifyGraphQLException.class, () -> {
            client.setInventoryQuantity("gid://shopify/InventoryItem/1", "gid://shopify/Location/bad", 10);
        });

        assertTrue(ex.getMessage().contains("Invalid location"));
    }

    // -----------------------------------------------------------------------
    // TEST 31: Native variant creation via productVariantsBulkCreate
    // -----------------------------------------------------------------------
    @Test
    @SuppressWarnings("unchecked")
    void testNativeVariantCreation_BulkCreate() {
        when(restTemplate.postForEntity(anyString(), any(HttpEntity.class), eq(Map.class)))
                .thenAnswer(inv -> {
                    HttpEntity<Map<String, Object>> e = inv.getArgument(1);
                    String q = (String) e.getBody().get("query");
                    if (q.contains("options { id name values }")) {
                        return ResponseEntity.ok(Map.of("data", Map.of("product", Map.of("options", Collections.emptyList()))));
                    }
                    if (q.contains("productOptionsCreate")) {
                        return ResponseEntity.ok(Map.of("data", Map.of("productOptionsCreate", Map.of(
                                "product", Map.of("id", "gid://shopify/Product/1"),
                                "userErrors", Collections.emptyList()
                        ))));
                    }
                    if (q.contains("variants(first: 50)")) {
                        return ResponseEntity.ok(Map.of("data", Map.of("product", Map.of("variants", Map.of("edges", Collections.emptyList())))));
                    }
                    if (q.contains("locations(")) {
                        return ResponseEntity.ok(Map.of("data", Map.of("locations", Map.of("edges", List.of(Map.of("node", Map.of("id", "gid://shopify/Location/1", "isActive", true, "isPrimary", true)))))));
                    }
                    if (q.contains("productVariantsBulkCreate")) {
                        return ResponseEntity.ok(Map.of("data", Map.of("productVariantsBulkCreate", Map.of(
                                "product", Map.of("id", "gid://shopify/Product/1"),
                                "productVariants", List.of(Map.of(
                                        "id", "gid://shopify/ProductVariant/101",
                                        "title", "Green",
                                        "inventoryItem", Map.of("id", "gid://shopify/InventoryItem/101", "tracked", true)
                                )),
                                "userErrors", Collections.emptyList()
                        ))));
                    }
                    if (q.contains("inventoryItemUpdate") || q.contains("inventorySetQuantities") || q.contains("inventoryActivate")) {
                        return ResponseEntity.ok(Map.of("data", Map.of(
                                "inventoryItemUpdate", Map.of("inventoryItem", Map.of("id", "gid://shopify/InventoryItem/101", "tracked", true), "userErrors", Collections.emptyList()),
                                "inventoryActivate", Map.of("inventoryLevel", Map.of("id", "gid://shopify/InventoryLevel/101"), "userErrors", Collections.emptyList()),
                                "inventorySetQuantities", Map.of("inventoryAdjustmentGroup", Map.of("reason", "correction"), "userErrors", Collections.emptyList())
                        )));
                    }
                    return ResponseEntity.ok(Map.of("data", Collections.emptyMap()));
                });

        List<Map<String, Object>> variations = List.of(Map.of("name", "Green", "quantity", 12));
        assertDoesNotThrow(() -> client.createProductVariants("gid://shopify/Product/1", variations, 45.0));

        org.mockito.ArgumentCaptor<HttpEntity> captor = org.mockito.ArgumentCaptor.forClass(HttpEntity.class);
        verify(restTemplate, atLeastOnce()).postForEntity(anyString(), captor.capture(), eq(Map.class));

        boolean bulkCreateCalled = captor.getAllValues().stream()
                .anyMatch(e -> e.getBody() != null && ((Map<String, Object>) e.getBody()).get("query").toString().contains("productVariantsBulkCreate"));
        assertTrue(bulkCreateCalled, "productVariantsBulkCreate must be called");
    }

    // -----------------------------------------------------------------------
    // TEST 32: Native variant update matches existing variant and updates price
    // -----------------------------------------------------------------------
    @Test
    @SuppressWarnings("unchecked")
    void testNativeVariantUpdate_ExistingVariantPrice() {
        when(restTemplate.postForEntity(anyString(), any(HttpEntity.class), eq(Map.class)))
                .thenAnswer(inv -> {
                    HttpEntity<Map<String, Object>> e = inv.getArgument(1);
                    String q = (String) e.getBody().get("query");
                    if (q.contains("options { id name values }")) {
                        return ResponseEntity.ok(Map.of("data", Map.of("product", Map.of("options", List.of(Map.of("name", "Color"))))));
                    }
                    if (q.contains("variants(first: 50)")) {
                        Map<String, Object> node = Map.of(
                                "id", "gid://shopify/ProductVariant/202",
                                "title", "Green",
                                "selectedOptions", List.of(Map.of("name", "Color", "value", "Green")),
                                "inventoryItem", Map.of("id", "gid://shopify/InventoryItem/202", "tracked", true)
                        );
                        return ResponseEntity.ok(Map.of("data", Map.of("product", Map.of("variants", Map.of("edges", List.of(Map.of("node", node)))))));
                    }
                    if (q.contains("locations(")) {
                        return ResponseEntity.ok(Map.of("data", Map.of("locations", Map.of("edges", List.of(Map.of("node", Map.of("id", "gid://shopify/Location/1", "isActive", true, "isPrimary", true)))))));
                    }
                    if (q.contains("productVariantsBulkUpdate")) {
                        return ResponseEntity.ok(Map.of("data", Map.of("productVariantsBulkUpdate", Map.of("userErrors", Collections.emptyList()))));
                    }
                    if (q.contains("inventoryItemUpdate") || q.contains("inventorySetQuantities") || q.contains("inventoryActivate")) {
                        return ResponseEntity.ok(Map.of("data", Map.of(
                                "inventoryItemUpdate", Map.of("inventoryItem", Map.of("id", "gid://shopify/InventoryItem/202", "tracked", true), "userErrors", Collections.emptyList()),
                                "inventoryActivate", Map.of("inventoryLevel", Map.of("id", "gid://shopify/InventoryLevel/202"), "userErrors", Collections.emptyList()),
                                "inventorySetQuantities", Map.of("inventoryAdjustmentGroup", Map.of("reason", "correction"), "userErrors", Collections.emptyList())
                        )));
                    }
                    return ResponseEntity.ok(Map.of("data", Collections.emptyMap()));
                });

        List<Map<String, Object>> variations = List.of(Map.of("name", "Green", "quantity", 8));
        assertDoesNotThrow(() -> client.createProductVariants("gid://shopify/Product/1", variations, 75.0));

        org.mockito.ArgumentCaptor<HttpEntity> captor = org.mockito.ArgumentCaptor.forClass(HttpEntity.class);
        verify(restTemplate, atLeastOnce()).postForEntity(anyString(), captor.capture(), eq(Map.class));

        boolean bulkUpdateCalled = captor.getAllValues().stream()
                .anyMatch(e -> e.getBody() != null && ((Map<String, Object>) e.getBody()).get("query").toString().contains("productVariantsBulkUpdate"));
        assertTrue(bulkUpdateCalled, "productVariantsBulkUpdate must be called for matching existing variant");
    }

    // -----------------------------------------------------------------------
    // TEST 33: collectionAddProducts success
    // -----------------------------------------------------------------------
    @Test
    @SuppressWarnings("unchecked")
    void testCollectionAddProducts_Success() {
        Map<String, Object> addData = Map.of("collectionAddProducts", Map.of(
                "collection", Map.of("id", "gid://shopify/Collection/100", "title", "Watches"),
                "userErrors", Collections.emptyList()
        ));
        when(restTemplate.postForEntity(anyString(), any(HttpEntity.class), eq(Map.class)))
                .thenReturn(ResponseEntity.ok(Map.of("data", addData)));

        client.addProductToCollection("gid://shopify/Collection/100", "gid://shopify/Product/500");

        org.mockito.ArgumentCaptor<HttpEntity> captor = org.mockito.ArgumentCaptor.forClass(HttpEntity.class);
        verify(restTemplate).postForEntity(anyString(), captor.capture(), eq(Map.class));

        Map<String, Object> body = (Map<String, Object>) captor.getValue().getBody();
        assertTrue(((String) body.get("query")).contains("collectionAddProducts"));
        Map<String, Object> vars = (Map<String, Object>) body.get("variables");
        assertEquals("gid://shopify/Collection/100", vars.get("id"));
        assertEquals(List.of("gid://shopify/Product/500"), vars.get("productIds"));
    }

    // -----------------------------------------------------------------------
    // TEST 34: collectionAddProducts userErrors throws ShopifyGraphQLException
    // -----------------------------------------------------------------------
    @Test
    void testCollectionAddProducts_UserErrors() {
        Map<String, Object> error = Map.of("field", List.of("id"), "message", "Collection not found", "code", "NOT_FOUND");
        Map<String, Object> addData = Map.of("collectionAddProducts", Map.of(
                "collection", Collections.emptyMap(),
                "userErrors", List.of(error)
        ));
        when(restTemplate.postForEntity(anyString(), any(HttpEntity.class), eq(Map.class)))
                .thenReturn(ResponseEntity.ok(Map.of("data", addData)));

        ShopifyGraphQLException ex = assertThrows(ShopifyGraphQLException.class, () -> {
            client.addProductToCollection("gid://shopify/Collection/bad", "gid://shopify/Product/1");
        });

        assertTrue(ex.getMessage().contains("Collection not found"));
    }

    // -----------------------------------------------------------------------
    // TEST 35: productType update via updateProduct
    // -----------------------------------------------------------------------
    @Test
    @SuppressWarnings("unchecked")
    void testProductType_Update() {
        when(restTemplate.postForEntity(anyString(), any(HttpEntity.class), eq(Map.class)))
                .thenAnswer(inv -> {
                    HttpEntity<Map<String, Object>> e = inv.getArgument(1);
                    String q = (String) e.getBody().get("query");
                    if (q.contains("verifyProduct")) {
                        return ResponseEntity.ok(Map.of("data", Map.of("product", Map.of(
                                "id", "gid://shopify/Product/1",
                                "title", "Watch",
                                "productType", "Watch Bracelet",
                                "collections", Map.of("edges", List.of(Map.of("node", Map.of("id", "gid://shopify/Collection/1", "title", "Watch Bracelet")))),
                                "variants", Map.of("edges", List.of(Map.of("node", Map.of("id", "v1", "inventoryItem", Map.of("id", "i1", "tracked", true))))),
                                "metafields", Map.of("edges", Collections.emptyList())
                        ))));
                    }
                    if (q.contains("productUpdate")) {
                        return ResponseEntity.ok(Map.of("data", Map.of("productUpdate", Map.of("product", Map.of("id", "gid://shopify/Product/1"), "userErrors", Collections.emptyList()))));
                    }
                    if (q.contains("metafieldsSet")) {
                        return ResponseEntity.ok(Map.of("data", Map.of("metafieldsSet", Map.of("metafields", List.of(Map.of("id", "m1")), "userErrors", Collections.emptyList()))));
                    }
                    if (q.contains("variants(first: 50)")) {
                        return ResponseEntity.ok(Map.of("data", Map.of("product", Map.of("variants", Map.of("edges", List.of(Map.of("node", Map.of("id", "v1", "inventoryItem", Map.of("id", "i1", "tracked", true)))))))));
                    }
                    if (q.contains("locations(")) {
                        return ResponseEntity.ok(Map.of("data", Map.of("locations", Map.of("edges", List.of(Map.of("node", Map.of("id", "gid://shopify/Location/loc1", "isActive", true)))))));
                    }
                    if (q.contains("inventoryItemUpdate")) {
                        return ResponseEntity.ok(Map.of("data", Map.of("inventoryItemUpdate", Map.of("inventoryItem", Map.of("id", "i1", "tracked", true), "userErrors", Collections.emptyList()))));
                    }
                    if (q.contains("inventorySetQuantities")) {
                        return ResponseEntity.ok(Map.of("data", Map.of("inventorySetQuantities", Map.of("inventoryAdjustmentGroup", Map.of("reason", "correction"), "userErrors", Collections.emptyList()))));
                    }
                    if (q.contains("productVariantsBulkUpdate")) {
                        return ResponseEntity.ok(Map.of("data", Map.of("productVariantsBulkUpdate", Map.of("productVariants", List.of(Map.of("id", "v1")), "userErrors", Collections.emptyList()))));
                    }
                    if (q.contains("findCollection") || q.contains("collections(first: 5")) {
                        return ResponseEntity.ok(Map.of("data", Map.of("collections", Map.of("edges", List.of(Map.of("node", Map.of("id", "gid://shopify/Collection/1", "title", "Watch Bracelet")))))));
                    }
                    if (q.contains("collectionAddProducts")) {
                        return ResponseEntity.ok(Map.of("data", Map.of("collectionAddProducts", Map.of("collection", Map.of("id", "col-1"), "userErrors", Collections.emptyList()))));
                    }
                    return ResponseEntity.ok(Map.of("data", Collections.emptyMap()));
                });

        client.updateProduct("gid://shopify/Product/1", "Watch", "<p>desc</p>", "837", "doc_1", 100.0, 120.0, null, null, null, "Watch Bracelet", null, null, 5);

        org.mockito.ArgumentCaptor<HttpEntity> captor = org.mockito.ArgumentCaptor.forClass(HttpEntity.class);
        verify(restTemplate, atLeastOnce()).postForEntity(anyString(), captor.capture(), eq(Map.class));

        HttpEntity updateEntity = captor.getAllValues().stream()
                .filter(e -> e.getBody() != null && ((Map<String, Object>) e.getBody()).get("query").toString().contains("productUpdate"))
                .findFirst().orElse(null);
        assertNotNull(updateEntity);

        Map<String, Object> updateBody = (Map<String, Object>) updateEntity.getBody();
        Map<String, Object> vars = (Map<String, Object>) updateBody.get("variables");
        Map<String, Object> input = (Map<String, Object>) vars.get("input");
        assertEquals("Watch Bracelet", input.get("productType"));
    }

    // -----------------------------------------------------------------------
    // TEST 36: verifyProductSync with expected collection present passes
    // -----------------------------------------------------------------------
    @Test
    void testVerifyProductSync_CollectionPresent_Succeeds() {
        when(restTemplate.postForEntity(anyString(), any(HttpEntity.class), eq(Map.class)))
                .thenReturn(ResponseEntity.ok(Map.of("data", Map.of("product", Map.of(
                        "id", "gid://shopify/Product/1",
                        "title", "Watch",
                        "productType", "Watch Bracelet",
                        "collections", Map.of("edges", List.of(Map.of("node", Map.of("id", "gid://shopify/Collection/1", "title", "Watch Bracelet")))),
                        "variants", Map.of("edges", List.of(Map.of("node", Map.of("id", "v1", "inventoryItem", Map.of("id", "i1", "tracked", true))))),
                        "metafields", Map.of("edges", Collections.emptyList())
                )))));

        assertDoesNotThrow(() -> client.verifyProductSync("gid://shopify/Product/1", "Watch Bracelet", "Watch Bracelet", false));
    }

    // -----------------------------------------------------------------------
    // TEST 37: verifyProductSync with expected collection missing throws exception
    // -----------------------------------------------------------------------
    @Test
    void testVerifyProductSync_CollectionMissing_ThrowsShopifyGraphQLException() {
        when(restTemplate.postForEntity(anyString(), any(HttpEntity.class), eq(Map.class)))
                .thenReturn(ResponseEntity.ok(Map.of("data", Map.of("product", Map.of(
                        "id", "gid://shopify/Product/1",
                        "title", "Watch",
                        "productType", "Watch Bracelet",
                        "collections", Map.of("edges", List.of(Map.of("node", Map.of("id", "gid://shopify/Collection/2", "title", "Other Collection")))),
                        "variants", Map.of("edges", List.of(Map.of("node", Map.of("id", "v1", "inventoryItem", Map.of("id", "i1", "tracked", true))))),
                        "metafields", Map.of("edges", Collections.emptyList())
                )))));

        ShopifyGraphQLException ex = assertThrows(ShopifyGraphQLException.class, () ->
                client.verifyProductSync("gid://shopify/Product/1", "Watch Bracelet", "Watch Bracelet", false)
        );

        assertTrue(ex.getMessage().contains("is not in expected Shopify collection 'Watch Bracelet'"));
    }
}

