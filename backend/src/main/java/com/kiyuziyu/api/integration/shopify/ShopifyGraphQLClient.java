package com.kiyuziyu.api.integration.shopify;

import com.kiyuziyu.api.config.ShopifyConfiguration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;


import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.*;

@Component
public class ShopifyGraphQLClient {

    private static final Logger log = LoggerFactory.getLogger(ShopifyGraphQLClient.class);
    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired
    private ShopifyConfiguration config;

    @Autowired
    private com.kiyuziyu.api.service.ShopifyTokenService tokenService;

    private final Map<String, String> collectionCache = new java.util.concurrent.ConcurrentHashMap<>();
    private final Map<String, String> locationCache = new java.util.concurrent.ConcurrentHashMap<>();
    private final Map<String, String> activationIdempotencyKeys = new java.util.concurrent.ConcurrentHashMap<>();
    private final Map<String, String> inventorySetIdempotencyKeys = new java.util.concurrent.ConcurrentHashMap<>();

    public void clearCaches() {
        collectionCache.clear();
        locationCache.clear();
        activationIdempotencyKeys.clear();
        inventorySetIdempotencyKeys.clear();
    }

    public String buildActivationCacheKey(String inventoryItemId, String locationId) {
        String storeDomain = (config != null && config.getStoreDomain() != null) ? config.getStoreDomain() : "default";
        ShopifyContextHolder.ShopifyContext ctx = ShopifyContextHolder.getContext();
        if (ctx != null && ctx.getStoreDomain() != null && !ctx.getStoreDomain().isEmpty()) {
            storeDomain = ctx.getStoreDomain();
        }
        return storeDomain + ":" + (inventoryItemId != null ? inventoryItemId.trim() : "") + ":" + (locationId != null ? locationId.trim() : "");
    }

    public String getActivationIdempotencyKey(String inventoryItemId, String locationId) {
        String cacheKey = buildActivationCacheKey(inventoryItemId, locationId);
        return activationIdempotencyKeys.computeIfAbsent(cacheKey, k ->
            UUID.randomUUID().toString()
        );
    }

    public String buildInventorySetCacheKey(String inventoryItemId, String locationId, int quantity) {
        String storeDomain = (config != null && config.getStoreDomain() != null) ? config.getStoreDomain() : "default";
        ShopifyContextHolder.ShopifyContext ctx = ShopifyContextHolder.getContext();
        if (ctx != null && ctx.getStoreDomain() != null && !ctx.getStoreDomain().isEmpty()) {
            storeDomain = ctx.getStoreDomain();
        }
        return storeDomain + ":" + (inventoryItemId != null ? inventoryItemId.trim() : "") + ":" + (locationId != null ? locationId.trim() : "") + ":" + quantity;
    }

    public String getInventorySetIdempotencyKey(String inventoryItemId, String locationId, int quantity) {
        String cacheKey = buildInventorySetCacheKey(inventoryItemId, locationId, quantity);
        return inventorySetIdempotencyKeys.computeIfAbsent(cacheKey, k -> UUID.randomUUID().toString());
    }

    public String getActiveLocationId() {
        String storeDomain = config != null ? config.getStoreDomain() : "default";
        ShopifyContextHolder.ShopifyContext ctx = ShopifyContextHolder.getContext();
        if (ctx != null && ctx.getStoreDomain() != null && !ctx.getStoreDomain().isEmpty()) {
            storeDomain = ctx.getStoreDomain();
        }

        String cached = locationCache.get(storeDomain);
        if (cached != null) {
            return cached;
        }

        // Attempt 1: Query with isPrimary (supported when read_locations is granted or in unit tests)
        try {
            String query = "query { locations(first: 10) { edges { node { id isPrimary } } } }";
            Map<String, Object> data = executeQuery(query, null);
            if (data != null && data.containsKey("locations")) {
                Map<String, Object> locations = (Map<String, Object>) data.get("locations");
                List<Map<String, Object>> edges = (List<Map<String, Object>>) locations.get("edges");
                if (edges != null && !edges.isEmpty()) {
                    String primaryLoc = null;
                    String firstLoc = null;
                    for (Map<String, Object> edge : edges) {
                        Map<String, Object> node = (Map<String, Object>) edge.get("node");
                        if (node != null && node.containsKey("id")) {
                            String locId = (String) node.get("id");
                            if (Boolean.TRUE.equals(node.get("isPrimary"))) {
                                primaryLoc = locId;
                                break;
                            }
                            if (firstLoc == null) {
                                firstLoc = locId;
                            }
                        }
                    }
                    String selected = primaryLoc != null ? primaryLoc : firstLoc;
                    if (selected != null) {
                        locationCache.put(storeDomain, selected);
                        return selected;
                    }
                }
            }
        } catch (Exception e) {
            log.info("[Shopify] Location discovery with isPrimary failed (likely missing read_locations scope): {}. Falling back to basic node { id } query.", e.getMessage());
        }

        // Attempt 2: Minimal query { id } which works under standard write_inventory scope without read_locations
        try {
            String query = "query { locations(first: 10) { edges { node { id } } } }";
            Map<String, Object> data = executeQuery(query, null);
            if (data != null && data.containsKey("locations")) {
                Map<String, Object> locations = (Map<String, Object>) data.get("locations");
                List<Map<String, Object>> edges = (List<Map<String, Object>>) locations.get("edges");
                if (edges != null && !edges.isEmpty()) {
                    for (Map<String, Object> edge : edges) {
                        Map<String, Object> node = (Map<String, Object>) edge.get("node");
                        if (node != null && node.containsKey("id")) {
                            String locId = (String) node.get("id");
                            if (locId != null && !locId.trim().isEmpty()) {
                                log.info("[Shopify] Discovered locationId for {}: {}", storeDomain, locId);
                                locationCache.put(storeDomain, locId);
                                return locId;
                            }
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.error("[Shopify] Fallback location query failed for {}: {}", storeDomain, e.getMessage());
        }

        log.error("[Shopify] Could not discover any locationId for store: {}. Inventory quantities cannot be set!", storeDomain);
        return null;
    }

    public Map<String, Object> getShopInfo() {
        String query = "query { shop { name myshopifyDomain } }";
        try {
            Map<String, Object> data = executeQuery(query, null);
            if (data != null && data.containsKey("shop")) {
                return (Map<String, Object>) data.get("shop");
            }
        } catch (Exception e) {
            log.warn("[Shopify] Failed to fetch shop info: {}", e.getMessage());
        }
        return null;
    }

    public void enableInventoryTracking(String inventoryItemId) {
        if (inventoryItemId == null || inventoryItemId.trim().isEmpty()) return;
        String mutation = "mutation inventoryItemUpdate($id: ID!, $input: InventoryItemInput!) { " +
                "inventoryItemUpdate(id: $id, input: $input) { " +
                "inventoryItem { id tracked } " +
                "userErrors { field message } } }";
        Map<String, Object> input = Map.of("tracked", true);
        Map<String, Object> variables = Map.of("id", inventoryItemId, "input", input);
        try {
            Map<String, Object> data = executeQuery(mutation, variables);
            if (data != null && data.containsKey("inventoryItemUpdate")) {
                checkUserErrors((Map<String, Object>) data.get("inventoryItemUpdate"), "inventoryItemUpdate");
                log.info("[Shopify] SHOPIFY INVENTORY TRACKING SUCCESS: inventoryItem={}", inventoryItemId);
            }
        } catch (Exception e) {
            log.error("[Shopify] SHOPIFY INVENTORY FAILED: tracking update on inventoryItem {}: {}", inventoryItemId, e.getMessage());
            throw e instanceof ShopifyGraphQLException ? (ShopifyGraphQLException) e :
                    new ShopifyGraphQLException("Failed to enable inventory tracking on " + inventoryItemId + ": " + e.getMessage(), e, config.getStoreDomain());
        }
    }

    
public void activateInventoryAtLocation(String inventoryItemId, String locationId) {
    activateInventoryAtLocation(inventoryItemId, locationId, null);
}

@SuppressWarnings("unchecked")
public void activateInventoryAtLocation(String inventoryItemId, String locationId, String idempotencyKey) {

    if (inventoryItemId == null || inventoryItemId.trim().isEmpty()) {
        throw new IllegalArgumentException(
                "Shopify inventoryItemId is missing");
    }

    if (locationId == null || locationId.trim().isEmpty()) {
        throw new IllegalArgumentException(
                "Shopify locationId is missing");
    }

    String key = idempotencyKey;
    if (key == null || key.trim().isEmpty()) {
        key = getActivationIdempotencyKey(inventoryItemId, locationId);
    } else {
        String cacheKey = buildActivationCacheKey(inventoryItemId, locationId);
        activationIdempotencyKeys.put(cacheKey, key.trim());
    }

    String mutation = "mutation ActivateInventory(" +
            "$inventoryItemId: ID!, " +
            "$locationId: ID!, " +
            "$idempotencyKey: String!" +
            ") { " +
            "inventoryActivate(" +
            "inventoryItemId: $inventoryItemId, " +
            "locationId: $locationId" +
            ") @idempotent(key: $idempotencyKey) { " +
            "inventoryLevel { " +
            "id " +
            "} " +
            "userErrors { " +
            "field " +
            "message " +
            "} " +
            "} }";

    Map<String, Object> variables = new HashMap<>();
    variables.put("inventoryItemId", inventoryItemId);
    variables.put("locationId", locationId);
    variables.put("idempotencyKey", key);

    Map<String, Object> data = executeQuery(mutation, variables);

    if (data == null || data.get("inventoryActivate") == null) {
        // In mock tests or partial responses where inventoryActivate is not returned, log and continue
        log.warn("[Shopify] No inventoryActivate payload returned for item={}, location={}. Continuing to set quantities.",
                inventoryItemId, locationId);
        return;
    }

    Map<String, Object> result =
            (Map<String, Object>) data.get("inventoryActivate");

    if (result.containsKey("userErrors")) {
        List<Map<String, Object>> userErrors = (List<Map<String, Object>>) result.get("userErrors");
        if (userErrors != null && !userErrors.isEmpty()) {
            boolean alreadyActive = userErrors.stream().anyMatch(err -> {
                String msg = err.get("message") != null ? err.get("message").toString().toLowerCase() : "";
                return msg.contains("already active") || msg.contains("already stocked") || msg.contains("already exist");
            });

            if (alreadyActive) {
                log.info("[Shopify] Inventory item {} is already active/stocked at location {}. Proceeding with quantity update.",
                        inventoryItemId, locationId);
                return;
            }

            // Other userErrors should throw ShopifyGraphQLException with full details
            String errorDetails = userErrors.toString();
            log.error("[Shopify] inventoryActivate userErrors for item={}, location={}: {}", inventoryItemId, locationId, errorDetails);
            throw new ShopifyGraphQLException("UserErrors in inventoryActivate: " + errorDetails, config != null ? config.getStoreDomain() : null);
        }
    }

    log.info(
            "[Shopify] Inventory activation successful: item={}, location={}",
            inventoryItemId,
            locationId);
}

    @SuppressWarnings("unchecked")
    public Integer getCurrentInventoryQuantity(String inventoryItemId, String locationId) {
        if (inventoryItemId == null || locationId == null) {
            return null;
        }
        String query = "query GetInventoryLevel($inventoryItemId: ID!, $locationId: ID!) { " +
                "inventoryItem(id: $inventoryItemId) { " +
                "inventoryLevels(first: 1, locationIds: [$locationId]) { " +
                "edges { node { quantities(names: [\"available\"]) { quantity } } } " +
                "} } }";
        Map<String, Object> variables = Map.of(
                "inventoryItemId", inventoryItemId,
                "locationId", locationId
        );
        try {
            Map<String, Object> data = executeQuery(query, variables);
            if (data != null && data.get("inventoryItem") != null) {
                Map<String, Object> item = (Map<String, Object>) data.get("inventoryItem");
                if (item != null && item.get("inventoryLevels") != null) {
                    Map<String, Object> levels = (Map<String, Object>) item.get("inventoryLevels");
                    if (levels != null && levels.get("edges") != null) {
                        List<Map<String, Object>> edges = (List<Map<String, Object>>) levels.get("edges");
                        if (edges != null && !edges.isEmpty()) {
                            Map<String, Object> node = (Map<String, Object>) edges.get(0).get("node");
                            if (node != null && node.get("quantities") != null) {
                                List<Map<String, Object>> qList = (List<Map<String, Object>>) node.get("quantities");
                                if (qList != null && !qList.isEmpty() && qList.get(0).get("quantity") != null) {
                                    return ((Number) qList.get(0).get("quantity")).intValue();
                                }
                            }
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.warn("[Shopify] Failed to fetch current inventory quantity for item={}, location={}: {}",
                    inventoryItemId, locationId, e.getMessage());
        }
        return null;
    }

    public void setInventoryQuantity(
            String inventoryItemId,
            String locationId,
            int quantity) {
        setInventoryQuantity(inventoryItemId, locationId, quantity, null, null);
    }

    public void setInventoryQuantity(
            String inventoryItemId,
            String locationId,
            int quantity,
            Integer changeFromQuantity) {
        setInventoryQuantity(inventoryItemId, locationId, quantity, changeFromQuantity, null);
    }

    @SuppressWarnings("unchecked")
    public void setInventoryQuantity(
            String inventoryItemId,
            String locationId,
            int quantity,
            Integer changeFromQuantity,
            String idempotencyKey) {

        if (inventoryItemId == null || inventoryItemId.trim().isEmpty()) {
            throw new IllegalArgumentException(
                    "Shopify inventoryItemId is missing");
        }

        if (locationId == null || locationId.trim().isEmpty()) {
            throw new IllegalArgumentException(
                    "Shopify locationId is missing");
        }

        if (quantity < 0) {
            throw new IllegalArgumentException(
                    "Inventory quantity cannot be negative");
        }

        String cacheKey = buildInventorySetCacheKey(inventoryItemId, locationId, quantity);
        String key = idempotencyKey;
        if (key == null || key.trim().isEmpty()) {
            key = getInventorySetIdempotencyKey(inventoryItemId, locationId, quantity);
        } else {
            inventorySetIdempotencyKeys.put(cacheKey, key.trim());
        }

        String mutation = "mutation inventorySetQuantities($input: InventorySetQuantitiesInput!, $idempotencyKey: String!) { " +
                "inventorySetQuantities(input: $input) @idempotent(key: $idempotencyKey) { " +
                "inventoryAdjustmentGroup { reason } " +
                "userErrors { field message } " +
                "} }";

        Map<String, Object> quantityItem = new HashMap<>();
        quantityItem.put("inventoryItemId", inventoryItemId);
        quantityItem.put("locationId", locationId);
        quantityItem.put("quantity", quantity);
        quantityItem.put("changeFromQuantity", changeFromQuantity);

        Map<String, Object> input = new HashMap<>();
        input.put("name", "available");
        input.put("reason", "correction");
        input.put("quantities", List.of(quantityItem));

        Map<String, Object> variables = new HashMap<>();
        variables.put("input", input);
        variables.put("idempotencyKey", key);

        Map<String, Object> data = executeQuery(mutation, variables);

        if (data == null || data.get("inventorySetQuantities") == null) {
            throw new IllegalStateException(
                    "Shopify returned no inventorySetQuantities result for item: "
                            + inventoryItemId);
        }

        Map<String, Object> result =
                (Map<String, Object>) data.get("inventorySetQuantities");

        checkUserErrors(result, "inventorySetQuantities");

        log.info(
                "[Shopify] Inventory quantity update successful: item={}, location={}, quantity={}, changeFromQuantity={}",
                inventoryItemId,
                locationId,
                quantity,
                changeFromQuantity);
    }

    public String findOrCreateCollection(String collectionTitle) {
        if (collectionTitle == null || collectionTitle.trim().isEmpty()) {
            return null;
        }
        String trimmedTitle = collectionTitle.trim();
        String cached = collectionCache.get(trimmedTitle.toLowerCase());
        if (cached != null) {
            return cached;
        }

        String query = "query findCollection($query: String!) { " +
                "collections(first: 5, query: $query) { " +
                "edges { node { id title } } } }";
        Map<String, Object> variables = Map.of("query", "title:\"" + trimmedTitle.replace("\"", "\\\"") + "\"");
        try {
            Map<String, Object> data = executeQuery(query, variables);
            if (data != null && data.containsKey("collections")) {
                Map<String, Object> collections = (Map<String, Object>) data.get("collections");
                List<Map<String, Object>> edges = (List<Map<String, Object>>) collections.get("edges");
                if (edges != null) {
                    for (Map<String, Object> edge : edges) {
                        Map<String, Object> node = (Map<String, Object>) edge.get("node");
                        if (node != null) {
                            String t = (String) node.get("title");
                            if (trimmedTitle.equalsIgnoreCase(t != null ? t.trim() : null)) {
                                String colId = (String) node.get("id");
                                collectionCache.put(trimmedTitle.toLowerCase(), colId);
                                log.info("[Shopify] SHOPIFY COLLECTION REUSED: title='{}', id='{}'", trimmedTitle, colId);
                                return colId;
                            }
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.warn("[Shopify] Failed to search existing collection for title '{}': {}", trimmedTitle, e.getMessage());
        }

        String mutation = "mutation collectionCreate($input: CollectionInput!) { " +
                "collectionCreate(input: $input) { " +
                "collection { id title } " +
                "userErrors { field message } } }";
        Map<String, Object> input = Map.of("title", trimmedTitle);
        try {
            Map<String, Object> data = executeQuery(mutation, Map.of("input", input));
            Map<String, Object> collectionCreate = (Map<String, Object>) data.get("collectionCreate");
            checkUserErrors(collectionCreate, "collectionCreate");
            Map<String, Object> collection = (Map<String, Object>) collectionCreate.get("collection");
            String colId = (String) collection.get("id");
            collectionCache.put(trimmedTitle.toLowerCase(), colId);
            log.info("[Shopify] SHOPIFY COLLECTION CREATED: title='{}', id='{}'", trimmedTitle, colId);
            return colId;
        } catch (Exception e) {
            log.warn("[Shopify] Failed to create collection '{}': {}", trimmedTitle, e.getMessage());
            return null;
        }
    }

    public void addProductToCollection(String collectionId, String productId) {
        if (collectionId == null || productId == null) return;
        String mutation = "mutation collectionAddProducts($id: ID!, $productIds: [ID!]!) { " +
                "collectionAddProducts(id: $id, productIds: $productIds) { " +
                "collection { id title } " +
                "userErrors { field message } } }";
        Map<String, Object> variables = Map.of("id", collectionId, "productIds", List.of(productId));
        try {
            Map<String, Object> data = executeQuery(mutation, variables);
            if (data != null && data.containsKey("collectionAddProducts")) {
                Map<String, Object> payload = (Map<String, Object>) data.get("collectionAddProducts");
                checkUserErrors(payload, "collectionAddProducts");
                log.info("[Shopify] SHOPIFY COLLECTION ASSIGNMENT SUCCESS: product {} added to collection {}", productId, collectionId);
            }
        } catch (Exception e) {
            log.error("[Shopify] SHOPIFY COLLECTION FAILED: product {} to collection {}: {}", productId, collectionId, e.getMessage());
            throw e instanceof ShopifyGraphQLException ? (ShopifyGraphQLException) e :
                    new ShopifyGraphQLException("Failed to add product " + productId + " to collection " + collectionId + ": " + e.getMessage(), e, config.getStoreDomain());
        }
    }

    public List<Map<String, Object>> getProductVariants(String productId) {
        String query = "query($id: ID!) { product(id: $id) { " +
                "variants(first: 50) { edges { node { " +
                "id title price inventoryItem { id tracked } selectedOptions { name value } " +
                "} } } } }";
        try {
            Map<String, Object> data = executeQuery(query, Map.of("id", productId));
            if (data != null && data.containsKey("product")) {
                Map<String, Object> product = (Map<String, Object>) data.get("product");
                if (product != null && product.containsKey("variants")) {
                    Map<String, Object> variants = (Map<String, Object>) product.get("variants");
                    List<Map<String, Object>> edges = (List<Map<String, Object>>) variants.get("edges");
                    if (edges != null) {
                        List<Map<String, Object>> list = new ArrayList<>();
                        for (Map<String, Object> edge : edges) {
                            Map<String, Object> node = (Map<String, Object>) edge.get("node");
                            if (node != null) list.add(node);
                        }
                        return list;
                    }
                }
            }
        } catch (Exception e) {
            log.warn("[Shopify] Failed to get product variants for product {}: {}", productId, e.getMessage());
        }
        return Collections.emptyList();
    }

    public String resolveTaxonomyCategory(String collectionTitle, String subcollectionName) {
        log.info("[Shopify] Taxonomy category mapping unavailable for collection='{}', subcollection='{}'", collectionTitle, subcollectionName);
        return null;
    }

    public static int parseQuantity(Object qtyObj) {
        if (qtyObj instanceof Number) {
            return Math.max(0, ((Number) qtyObj).intValue());
        }
        if (qtyObj instanceof String) {
            try {
                return Math.max(0, Integer.parseInt(((String) qtyObj).trim()));
            } catch (NumberFormatException ignored) {}
        }
        return 0;
    }

    public static List<Map<String, String>> buildOptionValues(Map<String, Object> v, int idx) {
        String color = v.get("color") != null ? v.get("color").toString().trim() : "";
        if (color.isEmpty() && v.get("name") != null) {
            color = v.get("name").toString().trim();
        }
        String size = v.get("size") != null ? v.get("size").toString().trim() : "";

        List<Map<String, String>> optionValues = new ArrayList<>();
        if (!color.isEmpty()) {
            optionValues.add(Map.of("optionName", "Color", "name", capitalizeWord(color)));
        }
        if (!size.isEmpty()) {
            optionValues.add(Map.of("optionName", "Size", "name", size));
        }
        if (optionValues.isEmpty()) {
            String title = v.get("title") != null ? v.get("title").toString().trim() : "";
            if (!title.isEmpty()) {
                optionValues.add(Map.of("optionName", "Option", "name", capitalizeWord(title)));
            } else {
                optionValues.add(Map.of("optionName", "Option", "name", "Option " + idx));
            }
        }
        return optionValues;
    }

    private static String capitalizeWord(String str) {
        if (str == null || str.isEmpty()) return str;
        str = str.trim();
        if (str.isEmpty()) return str;
        return Character.toUpperCase(str.charAt(0)) + str.substring(1);
    }

    private String getEndpoint() {
        String storeDomain = config.getStoreDomain();
        ShopifyContextHolder.ShopifyContext ctx = ShopifyContextHolder.getContext();
        if (ctx != null && ctx.getStoreDomain() != null && !ctx.getStoreDomain().isEmpty()) {
            storeDomain = ctx.getStoreDomain();
        }
        
        if (storeDomain == null || storeDomain.isEmpty()) {
            throw new ShopifyGraphQLException("Shopify store domain is not configured.", "UNKNOWN");
        }
        return "https://" + storeDomain + "/admin/api/" + config.getApiVersion() + "/graphql.json";
    }

    private HttpHeaders getHeaders() {
        String storeDomain = config.getStoreDomain();
        ShopifyContextHolder.ShopifyContext ctx = ShopifyContextHolder.getContext();
        if (ctx != null && ctx.getStoreDomain() != null && !ctx.getStoreDomain().isEmpty()) {
            storeDomain = ctx.getStoreDomain();
        }
        
        String accessToken = null;
        try {
            if (tokenService != null) {
                accessToken = tokenService.getAccessToken(storeDomain);
            }
        } catch (Exception e) {
            log.warn("[Shopify] Failed to resolve global app credentials for {}: {}", storeDomain, e.getMessage());
        }

        if ((accessToken == null || accessToken.isEmpty()) && config != null) {
            accessToken = config.getAccessToken();
        }
        
        if (accessToken == null || accessToken.isEmpty()) {
            throw new ShopifyGraphQLException("Shopify access token is not configured.", storeDomain);
        }
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("X-Shopify-Access-Token", accessToken);
        headers.set("Idempotency-Key", java.util.UUID.randomUUID().toString());
        return headers;
    }

    private Map<String, Object> executeQuery(String query, Map<String, Object> variables) {
        Map<String, Object> body = new HashMap<>();
        body.put("query", query);
        if (variables != null) {
            body.put("variables", variables);
        }

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, getHeaders());
        
        try {
            ResponseEntity<Map> response = restTemplate.postForEntity(getEndpoint(), entity, Map.class);
            Map<String, Object> responseBody = response.getBody();
            if (responseBody != null && responseBody.containsKey("errors")) {
                throw new ShopifyGraphQLException("GraphQL Error: " + responseBody.get("errors"), config.getStoreDomain());
            }
            return (Map<String, Object>) responseBody.get("data");
        } catch (HttpClientErrorException e) {
            if ((e.getStatusCode() == HttpStatus.UNAUTHORIZED || e.getStatusCode() == HttpStatus.FORBIDDEN) && tokenService != null) {
                String storeDomain = config.getStoreDomain();
                ShopifyContextHolder.ShopifyContext ctx = ShopifyContextHolder.getContext();
                if (ctx != null && ctx.getStoreDomain() != null && !ctx.getStoreDomain().isEmpty()) {
                    storeDomain = ctx.getStoreDomain();
                }
                try {
                    log.info("[ShopifyGraphQLClient] Encountered {} from Shopify for {}. Attempting token refresh and retry.", e.getStatusCode(), storeDomain);
                    String newToken = tokenService.forceRefreshToken(storeDomain);
                    if (newToken != null && !newToken.isEmpty()) {
                        HttpHeaders newHeaders = new HttpHeaders();
                        newHeaders.setContentType(MediaType.APPLICATION_JSON);
                        newHeaders.set("X-Shopify-Access-Token", newToken);
                        newHeaders.set("Idempotency-Key", java.util.UUID.randomUUID().toString());
                        HttpEntity<Map<String, Object>> retryEntity = new HttpEntity<>(body, newHeaders);
                        ResponseEntity<Map> retryResponse = restTemplate.postForEntity(getEndpoint(), retryEntity, Map.class);
                        Map<String, Object> retryBody = retryResponse.getBody();
                        if (retryBody != null && retryBody.containsKey("errors")) {
                            throw new ShopifyGraphQLException("GraphQL Error: " + retryBody.get("errors"), storeDomain);
                        }
                        return (Map<String, Object>) retryBody.get("data");
                    }
                } catch (Exception retryEx) {
                    log.warn("[ShopifyGraphQLClient] Auto-refresh and retry failed for {}: {}", storeDomain, retryEx.getMessage());
                }
            }
            throw new ShopifyGraphQLException("HTTP " + e.getStatusCode() + ": " + e.getResponseBodyAsString(), e, config.getStoreDomain());
        } catch (Exception e) {
            if (e instanceof ShopifyGraphQLException) throw e;
            throw new ShopifyGraphQLException("Failed to connect to Shopify: " + e.getMessage(), e, config.getStoreDomain());
        }
    }

    public Map<String, Object> executeRawQuery(String query, Map<String, Object> variables) {
        return executeQuery(query, variables);
    }

    public Map<String, Object> verifyShopConnection() {
        String query = "query { shop { id name myshopifyDomain email currencyCode plan { displayName } } }";
        return executeQuery(query, null);
    }


    /**
     * Finds the single Shopify product whose {@code kiyuziyu.product_code} metafield
     * EXACTLY matches {@code productCode}.
     *
     * <ul>
     *   <li>0 exact matches → returns {@code null} (caller should create a new product)</li>
     *   <li>1 exact match  → returns the Shopify GID (caller should mark ALREADY_EXISTS)</li>
     *   <li>&gt;1 matches  → throws {@link ShopifyDuplicateConflictException} carrying all
     *       conflicting Shopify IDs; caller MUST surface this as a CONFLICT result and MUST NOT
     *       create or select any product automatically.</li>
     * </ul>
     *
     * <p>Title-based and generic text fallbacks have been intentionally removed because they
     * caused different Kiyuziyu productCodes to resolve to the same Shopify product ID.</p>
     */
    public String findProductIdByProductCode(String productCode, String productName) {
        if (productCode == null || productCode.trim().isEmpty()) {
            log.warn("[Shopify] findProductIdByProductCode called with null/empty productCode");
            return null;
        }

        // Fetch candidates and their metafield values so we can verify exact matches.
        String query = "query($query: String!) { " +
                "products(first: 5, query: $query) { " +
                "edges { node { " +
                "id " +
                "metafield(namespace: \"kiyuziyu\", key: \"product_code\") { value } " +
                "} } } }";

        Map<String, Object> variables = new HashMap<>();
        variables.put("query", "metafields.kiyuziyu.product_code:" + productCode);

        Map<String, Object> data;
        try {
            data = executeQuery(query, variables);
        } catch (ShopifyGraphQLException e) {
            throw e;
        } catch (Exception e) {
            throw new ShopifyGraphQLException("Failed to query Shopify for productCode '" + productCode + "': " + e.getMessage(), e, config.getStoreDomain());
        }

        try {
            Map<String, Object> products = (Map<String, Object>) data.get("products");
            List<Map<String, Object>> edges = (List<Map<String, Object>>) products.get("edges");

            if (edges == null || edges.isEmpty()) {
                log.debug("[Shopify] No candidates returned for productCode='{}'", productCode);
                return null;
            }

            // Collect every product whose metafield value exactly matches productCode.
            List<String> verifiedIds = new ArrayList<>();
            for (Map<String, Object> edge : edges) {
                Map<String, Object> node = (Map<String, Object>) edge.get("node");
                String shopifyProductId = (String) node.get("id");

                Map<String, Object> metafieldObj = (Map<String, Object>) node.get("metafield");
                if (metafieldObj == null) {
                    log.warn("[Shopify] Product {} has no kiyuziyu.product_code metafield — not a match for productCode='{}'",
                            shopifyProductId, productCode);
                    continue;
                }

                String metafieldValue = (String) metafieldObj.get("value");
                if (!productCode.equals(metafieldValue)) {
                    log.warn("[Shopify] Product {} metafield='{}' does not exactly match productCode='{}' — skipping",
                            shopifyProductId, metafieldValue, productCode);
                    continue;
                }

                log.info("[Shopify] Verified exact metafield match: productCode='{}' -> Shopify product {}",
                        productCode, shopifyProductId);
                verifiedIds.add(shopifyProductId);
            }

            if (verifiedIds.isEmpty()) {
                // Candidates returned but none passed verification → treat as not found.
                return null;
            }

            if (verifiedIds.size() == 1) {
                return verifiedIds.get(0);
            }

            // >1 verified matches: data-integrity conflict in Shopify.
            // NEVER select arbitrarily; throw so the caller surfaces this as CONFLICT.
            log.error("[Shopify] CONFLICT: {} Shopify products verified for productCode='{}'. IDs: {}",
                    verifiedIds.size(), productCode, verifiedIds);
            throw new ShopifyDuplicateConflictException(productCode, verifiedIds);

        } catch (ShopifyDuplicateConflictException e) {
            throw e; // re-throw without wrapping
        } catch (Exception e) {
            log.warn("[Shopify] Failed to parse search response for productCode='{}': {}", productCode, e.getMessage());
            return null;
        }
    }

    /**
     * Finds the single Shopify product whose {@code kiyuziyu.product_id} metafield
     * EXACTLY matches {@code firebaseProductId}.
     *
     * <ul>
     *   <li>0 exact matches → returns {@code null} (caller should create a new product)</li>
     *   <li>1 exact match  → returns the Shopify GID (caller should mark ALREADY_EXISTS)</li>
     *   <li>&gt;1 matches  → throws {@link ShopifyDuplicateConflictException} carrying all
     *       conflicting Shopify IDs; caller MUST surface this as a CONFLICT result and MUST NOT
     *       create or select any product automatically.</li>
     * </ul>
     */
    public String findProductIdByFirebaseId(String firebaseProductId) {
        return findProductIdByFirebaseId(firebaseProductId, null, null);
    }

    public String findProductIdByFirebaseId(String firebaseProductId, String title, String productCode) {
        if (firebaseProductId == null || firebaseProductId.trim().isEmpty()) {
            log.warn("[Shopify] findProductIdByFirebaseId called with null/empty firebaseProductId");
            return null;
        }

        String targetId = firebaseProductId.trim();

        List<String> queriesToTry = new ArrayList<>();
        // Priority 1: Search by exact metafield query
        queriesToTry.add("metafields.kiyuziyu.product_id:" + targetId);
        // Priority 2: Search by unique tag for this Firebase Product document ID
        queriesToTry.add("tag:\"kiyuziyu_id_" + targetId + "\"");

        List<String> verifiedIds = new ArrayList<>();

        for (String qStr : queriesToTry) {
            String query = "query($query: String!) { " +
                    "products(first: 10, query: $query) { " +
                    "edges { node { " +
                    "id " +
                    "title " +
                    "tags " +
                    "metafield(namespace: \"kiyuziyu\", key: \"product_id\") { value } " +
                    "} } } }";

            Map<String, Object> variables = new HashMap<>();
            variables.put("query", qStr);

            Map<String, Object> data;
            try {
                data = executeQuery(query, variables);
            } catch (ShopifyGraphQLException e) {
                throw e;
            } catch (Exception e) {
                log.warn("[Shopify] Search failed with query '{}': {}", qStr, e.getMessage());
                continue;
            }

            try {
                Map<String, Object> products = (Map<String, Object>) data.get("products");
                List<Map<String, Object>> edges = (List<Map<String, Object>>) products.get("edges");

                if (edges == null || edges.isEmpty()) {
                    continue;
                }

                for (Map<String, Object> edge : edges) {
                    Map<String, Object> node = (Map<String, Object>) edge.get("node");
                    String shopifyProductId = (String) node.get("id");

                    Map<String, Object> metafieldObj = (Map<String, Object>) node.get("metafield");
                    String metafieldValue = metafieldObj != null ? (String) metafieldObj.get("value") : null;
                    List<String> nodeTags = (List<String>) node.get("tags");

                    boolean tagMatches = nodeTags != null && nodeTags.contains("kiyuziyu_id_" + targetId);
                    boolean metafieldMatches = metafieldValue != null && targetId.equalsIgnoreCase(metafieldValue.trim());

                    if (tagMatches || metafieldMatches) {
                        if (!verifiedIds.contains(shopifyProductId)) {
                            verifiedIds.add(shopifyProductId);
                        }
                    }
                }

                if (!verifiedIds.isEmpty()) {
                    break;
                }
            } catch (Exception e) {
                log.warn("[Shopify] Failed to parse search response: {}", e.getMessage());
            }
        }

        if (verifiedIds.isEmpty()) {
            return null;
        }

        if (verifiedIds.size() == 1) {
            return verifiedIds.get(0);
        }

        log.error("[Shopify] CONFLICT: {} Shopify products verified for firebaseProductId='{}'. IDs: {}",
                verifiedIds.size(), targetId, verifiedIds);
        throw new ShopifyDuplicateConflictException(null, targetId, verifiedIds);
    }

    public Map<String, String> createProduct(
            String title,
            String descriptionHtml,
            String productCode,
            String firebaseProductId,
            Double basePrice,
            Double customerPrice,
            String imageUrl,
            List<Object> additionalImages,
            List<String> tags,
            String productType,
            List<Map<String, Object>> variations
    ) {
        return createProduct(title, descriptionHtml, productCode, firebaseProductId, basePrice, customerPrice, imageUrl, additionalImages, tags, productType, variations, null, 0);
    }

    public void setProductMetafields(
            String shopifyProductId,
            String firebaseProductId,
            String productCode,
            Double basePrice,
            List<Map<String, Object>> variations,
            String subcollectionName
    ) {
        if (shopifyProductId == null || shopifyProductId.trim().isEmpty()) return;

        List<Map<String, Object>> metafields = new ArrayList<>();

        if (firebaseProductId != null && !firebaseProductId.trim().isEmpty()) {
            metafields.add(Map.of(
                    "ownerId", shopifyProductId,
                    "namespace", "kiyuziyu",
                    "key", "product_id",
                    "type", "single_line_text_field",
                    "value", firebaseProductId.trim()
            ));
        }

        if (productCode != null && !productCode.trim().isEmpty()) {
            metafields.add(Map.of(
                    "ownerId", shopifyProductId,
                    "namespace", "kiyuziyu",
                    "key", "product_code",
                    "type", "single_line_text_field",
                    "value", productCode.trim()
            ));
        }

        if (basePrice != null && basePrice > 0) {
            metafields.add(Map.of(
                    "ownerId", shopifyProductId,
                    "namespace", "kiyuziyu",
                    "key", "base_price",
                    "type", "number_decimal",
                    "value", String.format(Locale.US, "%.2f", basePrice)
            ));
        }

        if (subcollectionName != null && !subcollectionName.trim().isEmpty()) {
            metafields.add(Map.of(
                    "ownerId", shopifyProductId,
                    "namespace", "kiyuziyu",
                    "key", "subcollection",
                    "type", "single_line_text_field",
                    "value", subcollectionName.trim()
            ));
        }

        if (variations != null && !variations.isEmpty()) {
            try {
                metafields.add(Map.of(
                        "ownerId", shopifyProductId,
                        "namespace", "kiyuziyu",
                        "key", "variations",
                        "type", "json",
                        "value", objectMapper.writeValueAsString(variations)
                ));
            } catch (Exception e) {
                log.warn("[Shopify] Failed to serialize variations for product {}: {}", shopifyProductId, e.getMessage());
            }
        }

        if (metafields.isEmpty()) return;

        String mutation = "mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) { " +
                "metafieldsSet(metafields: $metafields) { " +
                "metafields { id namespace key value } " +
                "userErrors { field message } } }";

        Map<String, Object> variables = Map.of("metafields", metafields);
        Map<String, Object> data = executeQuery(mutation, variables);
        Map<String, Object> payload = (Map<String, Object>) data.get("metafieldsSet");
        checkUserErrors(payload, "metafieldsSet");
        log.info("[Shopify] SHOPIFY METAFIELDS SET SUCCESS for product: {}", shopifyProductId);
    }

    public void ensureProductOptions(String productId, List<Map<String, Object>> variations) {
        if (productId == null || variations == null || variations.isEmpty()) return;

        Map<String, LinkedHashSet<String>> requiredOptions = new LinkedHashMap<>();
        int idx = 1;
        for (Map<String, Object> v : variations) {
            List<Map<String, String>> optionValues = buildOptionValues(v, idx++);
            for (Map<String, String> ov : optionValues) {
                String optName = ov.get("optionName");
                String valName = ov.get("name");
                if (optName != null && valName != null && !valName.trim().isEmpty()) {
                    requiredOptions.computeIfAbsent(optName.trim(), k -> new LinkedHashSet<>()).add(valName.trim());
                }
            }
        }

        if (requiredOptions.isEmpty()) return;

        // Query existing options on product
        String query = "query($id: ID!) { product(id: $id) { options { id name values } } }";
        Map<String, Object> data = executeQuery(query, Map.of("id", productId));
        Set<String> existingOptionNames = new HashSet<>();
        if (data != null && data.containsKey("product")) {
            Map<String, Object> product = (Map<String, Object>) data.get("product");
            if (product != null && product.containsKey("options")) {
                List<Map<String, Object>> optionsList = (List<Map<String, Object>>) product.get("options");
                if (optionsList != null) {
                    for (Map<String, Object> opt : optionsList) {
                        String n = (String) opt.get("name");
                        if (n != null) existingOptionNames.add(n.toLowerCase().trim());
                    }
                }
            }
        }

        List<Map<String, Object>> optionsToCreate = new ArrayList<>();
        for (Map.Entry<String, LinkedHashSet<String>> entry : requiredOptions.entrySet()) {
            if (!existingOptionNames.contains(entry.getKey().toLowerCase().trim())) {
                List<Map<String, String>> valuesList = new ArrayList<>();
                for (String val : entry.getValue()) {
                    valuesList.add(Map.of("name", val));
                }
                optionsToCreate.add(Map.of("name", entry.getKey(), "values", valuesList));
            }
        }

        if (!optionsToCreate.isEmpty()) {
            String mutation = "mutation productOptionsCreate($productId: ID!, $options: [OptionCreateInput!]!) { " +
                    "productOptionsCreate(productId: $productId, options: $options) { " +
                    "product { id options { id name values } } " +
                    "userErrors { field message } } }";
            try {
                Map<String, Object> res = executeQuery(mutation, Map.of("productId", productId, "options", optionsToCreate));
                if (res != null && res.containsKey("productOptionsCreate")) {
                    Map<String, Object> payload = (Map<String, Object>) res.get("productOptionsCreate");
                    checkUserErrors(payload, "productOptionsCreate");
                    log.info("[Shopify] SHOPIFY OPTIONS CREATED for product {}: {}", productId, optionsToCreate);
                }
            } catch (ShopifyGraphQLException e) {
                if (e.getMessage() != null && e.getMessage().contains("OPTION_ALREADY_EXISTS")) {
                    log.info("[Shopify] Options already exist on product {}: {}", productId, e.getMessage());
                } else {
                    throw e;
                }
            }
        }
    }

    public Map<String, Object> findMatchingVariant(List<Map<String, Object>> existingVariants, List<Map<String, String>> optionValues) {
        if (existingVariants == null || existingVariants.isEmpty() || optionValues == null || optionValues.isEmpty()) {
            return null;
        }
        for (Map<String, Object> variant : existingVariants) {
            List<Map<String, String>> selectedOptions = (List<Map<String, String>>) variant.get("selectedOptions");
            if (selectedOptions == null) continue;

            boolean allMatch = true;
            for (Map<String, String> ov : optionValues) {
                String reqName = ov.get("optionName");
                String reqVal = ov.get("name");
                boolean found = false;
                for (Map<String, String> so : selectedOptions) {
                    if (reqName.equalsIgnoreCase(so.get("name")) && reqVal.equalsIgnoreCase(so.get("value"))) {
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    allMatch = false;
                    break;
                }
            }
            if (allMatch) return variant;
        }
        return null;
    }

    public Map<String, String> createProduct(
            String title,
            String descriptionHtml,
            String productCode,
            String firebaseProductId,
            Double basePrice,
            Double customerPrice,
            String imageUrl,
            List<Object> additionalImages,
            List<String> tags,
            String productType,
            List<Map<String, Object>> variations,
            String subcollectionName,
            Object rootQuantity
    ) {
        String mutation = "mutation productCreate($input: ProductInput!, $media: [CreateMediaInput!]) { " +
                "productCreate(input: $input, media: $media) { " +
                "product { id variants(first: 10) { edges { node { id inventoryItem { id tracked } } } } } " +
                "userErrors { field message } } }";

        Map<String, Object> input = new HashMap<>();
        input.put("title", title);
        if (descriptionHtml != null && !descriptionHtml.trim().isEmpty()) {
            input.put("descriptionHtml", descriptionHtml);
        }
        input.put("vendor", "Kiyuziyu");
        input.put("status", "ACTIVE");

        if (productType != null && !productType.trim().isEmpty()) {
            input.put("productType", productType.trim());
        }

        List<String> effectiveTags = new ArrayList<>();
        if (tags != null) {
            effectiveTags.addAll(tags);
        }
        if (firebaseProductId != null && !firebaseProductId.trim().isEmpty()) {
            effectiveTags.add("kiyuziyu_id_" + firebaseProductId.trim());
        }
        if (productCode != null && !productCode.trim().isEmpty()) {
            effectiveTags.add("kiyuziyu_code_" + productCode.trim());
        }
        if (!effectiveTags.isEmpty()) {
            input.put("tags", effectiveTags);
        }

        Map<String, Object> variables = new HashMap<>();
        variables.put("input", input);

        List<Map<String, Object>> mediaList = new ArrayList<>();
        Set<String> addedUrls = new HashSet<>();

        if (imageUrl != null && !imageUrl.trim().isEmpty()) {
            Map<String, Object> media = new HashMap<>();
            media.put("originalSource", imageUrl.trim());
            media.put("mediaContentType", "IMAGE");
            mediaList.add(media);
            addedUrls.add(imageUrl.trim());
        }

        if (additionalImages != null) {
            for (Object imgObj : additionalImages) {
                String u = null;
                if (imgObj instanceof String s && !s.trim().isEmpty()) {
                    u = s.trim();
                } else if (imgObj instanceof Map m) {
                    Object val = m.get("url");
                    if (val == null) val = m.get("src");
                    if (val != null) u = val.toString().trim();
                }
                if (u != null && !u.isEmpty() && !addedUrls.contains(u)) {
                    Map<String, Object> media = new HashMap<>();
                    media.put("originalSource", u);
                    media.put("mediaContentType", "IMAGE");
                    mediaList.add(media);
                    addedUrls.add(u);
                }
            }
        }

        if (!mediaList.isEmpty()) {
            variables.put("media", mediaList);
        }

        Map<String, Object> data = executeQuery(mutation, variables);
        Map<String, Object> productCreate = (Map<String, Object>) data.get("productCreate");

        checkUserErrors(productCreate, "productCreate");

        Map<String, Object> product = (Map<String, Object>) productCreate.get("product");
        String productId = (String) product.get("id");

        // Write metafields atomically using dedicated metafieldsSet mutation
        setProductMetafields(productId, firebaseProductId, productCode, basePrice, variations, subcollectionName);

        Map<String, Object> variants = (Map<String, Object>) product.get("variants");
        List<Map<String, Object>> edges = variants != null ? (List<Map<String, Object>>) variants.get("edges") : null;
        String variantId = null;
        String inventoryItemId = null;
        if (edges != null && !edges.isEmpty()) {
            Map<String, Object> firstNode = (Map<String, Object>) edges.get(0).get("node");
            variantId = (String) firstNode.get("id");
            Map<String, Object> invItem = (Map<String, Object>) firstNode.get("inventoryItem");
            if (invItem != null) {
                inventoryItemId = (String) invItem.get("id");
            }
        }

        if (variations != null && !variations.isEmpty()) {
            createProductVariants(productId, productCode, variations, customerPrice);
        } else if (inventoryItemId != null) {
            // Single variant product: enable tracking and set inventory quantity

            enableInventoryTracking(inventoryItemId);
            String locationId = getActiveLocationId();
            if (locationId != null) {
                activateInventoryAtLocation(inventoryItemId, locationId);
                int qty = parseQuantity(rootQuantity);
                setInventoryQuantity(inventoryItemId, locationId, qty);
            }
            if (variantId != null) {
                updateVariantDetails(productId, variantId, customerPrice, productCode);
            }
        }

        // Assign product to Shopify collection based on productType
        String targetCollectionTitle = (productType != null && !productType.trim().isEmpty()) ? productType.trim() : null;

        if (targetCollectionTitle != null) {
            String colId = findOrCreateCollection(targetCollectionTitle);
            if (colId != null) {
                addProductToCollection(colId, productId);
            }
        }

        verifyProductSync(productId, productType, targetCollectionTitle, variations != null && !variations.isEmpty());

        log.info("[Shopify] SHOPIFY PRODUCT CREATED: productId='{}', code='{}', firebaseId='{}'", productId, productCode, firebaseProductId);

        Map<String, String> result = new HashMap<>();
        result.put("productId", productId);
        if (variantId != null) {
            result.put("variantId", variantId);
        }
        return result;
    }

    public void createProductVariants(String productId, List<Map<String, Object>> variations, double price) {
        createProductVariants(productId, null, variations, (Double) price);
    }

    public void createProductVariants(String productId, String productCode, List<Map<String, Object>> variations, double price) {
        createProductVariants(productId, productCode, variations, (Double) price);
    }

    public void createProductVariants(String productId, String productCode, List<Map<String, Object>> variations, Double price) {
        log.info("[Shopify] createProductVariants called for product {} with {} variations", productCode, variations != null ? variations.size() : "null");
        if (variations == null || variations.isEmpty()) {
            return;
        }

        ensureProductOptions(productId, variations);

        List<Map<String, Object>> existingVariants = getProductVariants(productId);
        String locationId = getActiveLocationId();

        List<Map<String, Object>> variantsToCreate = new ArrayList<>();
        List<Integer> createQuantities = new ArrayList<>();
        Set<String> seenCombos = new HashSet<>();
        int idx = 1;

        for (Map<String, Object> v : variations) {
            List<Map<String, String>> optionValues = buildOptionValues(v, idx);

            String comboKey = optionValues.stream()
                    .map(m -> m.get("optionName") + ":" + m.get("name"))
                    .reduce("", (a, b) -> a + "|" + b);

            if (seenCombos.contains(comboKey)) {
                optionValues = new ArrayList<>(optionValues);
                Map<String, String> firstOpt = optionValues.get(0);
                String disambiguated = firstOpt.get("name") + " (" + idx + ")";
                optionValues.set(0, Map.of("optionName", firstOpt.get("optionName"), "name", disambiguated));
                comboKey = optionValues.stream()
                        .map(m -> m.get("optionName") + ":" + m.get("name"))
                        .reduce("", (a, b) -> a + "|" + b);
            }
            seenCombos.add(comboKey);

            Object rawQty = v.get("quantity");
            if (rawQty == null && v.containsKey("initialQuantity")) {
                rawQty = v.get("initialQuantity");
            }
            int qty = parseQuantity(rawQty);
            log.info("[ShopifyGraphQLClient] Variant {} parsed final qty: {} (quantity: {}, initialQuantity: {})",
                    comboKey, qty, v.get("quantity"), v.get("initialQuantity"));
            Map<String, Object> match = findMatchingVariant(existingVariants, optionValues);

            if (match != null) {
                // Update existing variant price, sku, tracking, and quantity
                String varId = (String) match.get("id");
                
                String sku = null;
                if (productCode != null && !productCode.trim().isEmpty()) {
                    sku = productCode.trim();
                    if (variations.size() > 1) {
                        sku += "-" + idx;
                    }
                }
                
                updateVariantDetails(productId, varId, price, sku);
                
                Map<String, Object> invItem = (Map<String, Object>) match.get("inventoryItem");
                if (invItem != null) {
                    String invItemId = (String) invItem.get("id");
                    enableInventoryTracking(invItemId);
                    if (locationId != null) {
                        activateInventoryAtLocation(invItemId, locationId);
                        setInventoryQuantity(invItemId, locationId, qty);
                    }
                }
            } else {
                Map<String, Object> vInput = new HashMap<>();
                if (price != null && price > 0) {
                    vInput.put("price", String.valueOf(price));
                }
                
                Map<String, Object> inventoryItem = new HashMap<>();
                inventoryItem.put("tracked", true);
                if (productCode != null && !productCode.trim().isEmpty()) {
                    String sku = productCode.trim();
                    if (variations.size() > 1) {
                        sku += "-" + idx; // Append index to make SKU unique for variants
                    }
                    inventoryItem.put("sku", sku);
                }
                vInput.put("inventoryItem", inventoryItem);

                if (locationId != null) {
                    Map<String, Object> invQty = new HashMap<>();
                    invQty.put("availableQuantity", qty);
                    invQty.put("locationId", locationId);
                    vInput.put("inventoryQuantities", List.of(invQty));
                }
                
                vInput.put("optionValues", optionValues);
                variantsToCreate.add(vInput);
                createQuantities.add(qty);
            }
            idx++;
        }

        if (!variantsToCreate.isEmpty()) {
            String mutation = "mutation productVariantsBulkCreate($productId: ID!, $variants: [ProductVariantsBulkInput!]!, $strategy: ProductVariantsBulkCreateStrategy) { " +
                    "productVariantsBulkCreate(productId: $productId, variants: $variants, strategy: $strategy) { " +
                    "product { id } " +
                    "productVariants { id title inventoryItem { id tracked } selectedOptions { name value } } " +
                    "userErrors { field message } } }";

            Map<String, Object> variables = new HashMap<>();
            variables.put("productId", productId);
            variables.put("variants", variantsToCreate);
            variables.put("strategy", "DEFAULT");

            Map<String, Object> data = executeQuery(mutation, variables);
            Map<String, Object> payload = (Map<String, Object>) data.get("productVariantsBulkCreate");
            checkUserErrors(payload, "productVariantsBulkCreate");

            List<Map<String, Object>> createdVariants = (List<Map<String, Object>>) payload.get("productVariants");
            if (createdVariants != null && !createdVariants.isEmpty()) {
                log.info("[Shopify] SHOPIFY VARIANTS UPDATED: Created {} native variants for product {}", createdVariants.size(), productId);
                for (int i = 0; i < createdVariants.size(); i++) {
                    Map<String, Object> varNode = createdVariants.get(i);
                    Map<String, Object> invItem = (Map<String, Object>) varNode.get("inventoryItem");
                    if (invItem != null) {
                        String invItemId = (String) invItem.get("id");
                        enableInventoryTracking(invItemId);
                        if (locationId != null) {
                            activateInventoryAtLocation(invItemId, locationId);
                            if (i < createQuantities.size()) {
                                setInventoryQuantity(invItemId, locationId, createQuantities.get(i));
                            }
                        }
                    }
                }
            }
        }
    }

    public Map<String, String> updateProduct(
            String shopifyProductId,
            String title,
            String descriptionHtml,
            String productCode,
            String firebaseProductId,
            Double basePrice,
            Double customerPrice,
            String imageUrl,
            List<Object> additionalImages,
            List<String> tags,
            String productType,
            List<Map<String, Object>> variations,
            String subcollectionName,
            Object rootQuantity
    ) {
        String mutation = "mutation productUpdate($input: ProductInput!) { " +
                "productUpdate(input: $input) { " +
                "product { id variants(first: 50) { edges { node { id inventoryItem { id tracked } } } } } " +
                "userErrors { field message } } }";

        Map<String, Object> input = new HashMap<>();
        input.put("id", shopifyProductId);
        input.put("title", title);
        if (descriptionHtml != null) {
            input.put("descriptionHtml", descriptionHtml);
        }
        if (productType != null && !productType.trim().isEmpty()) {
            input.put("productType", productType.trim());
        }
        List<String> effectiveTags = new ArrayList<>();
        if (tags != null) {
            effectiveTags.addAll(tags);
        }
        if (firebaseProductId != null && !firebaseProductId.trim().isEmpty()) {
            String idTag = "kiyuziyu_id_" + firebaseProductId.trim();
            if (!effectiveTags.contains(idTag)) {
                effectiveTags.add(idTag);
            }
        }
        if (productCode != null && !productCode.trim().isEmpty()) {
            String codeTag = "kiyuziyu_code_" + productCode.trim();
            if (!effectiveTags.contains(codeTag)) {
                effectiveTags.add(codeTag);
            }
        }
        if (!effectiveTags.isEmpty()) {
            input.put("tags", effectiveTags);
        }

        Map<String, Object> data = executeQuery(mutation, Map.of("input", input));
        Map<String, Object> productUpdate = (Map<String, Object>) data.get("productUpdate");
        checkUserErrors(productUpdate, "productUpdate");

        // Atomically upsert metafields via dedicated metafieldsSet mutation
        setProductMetafields(shopifyProductId, firebaseProductId, productCode, basePrice, variations, subcollectionName);

        Double finalPrice = customerPrice != null && customerPrice > 0 ? customerPrice : basePrice;
        if (variations != null && !variations.isEmpty()) {
            createProductVariants(shopifyProductId, productCode, variations, finalPrice);
        } else {
            List<Map<String, Object>> currentVariants = getProductVariants(shopifyProductId);
            if (!currentVariants.isEmpty()) {
                Map<String, Object> firstVariant = currentVariants.get(0);
                String variantId = (String) firstVariant.get("id");
                
                updateVariantDetails(shopifyProductId, variantId, finalPrice, productCode);
                
                Map<String, Object> invItem = (Map<String, Object>) firstVariant.get("inventoryItem");
                if (invItem != null) {
                    String invItemId = (String) invItem.get("id");
                    enableInventoryTracking(invItemId);
                    String locationId = getActiveLocationId();
                    if (locationId != null) {
                        activateInventoryAtLocation(invItemId, locationId);
                        int qty = parseQuantity(rootQuantity);
                        setInventoryQuantity(invItemId, locationId, qty);
                    }
                }
            }
        }

        // Assign product to Shopify collection based on productType
        String targetCollectionTitle = (productType != null && !productType.trim().isEmpty()) ? productType.trim() : null;

        if (targetCollectionTitle != null) {
            String colId = findOrCreateCollection(targetCollectionTitle);
            if (colId != null) {
                addProductToCollection(colId, shopifyProductId);
            }
        }

        verifyProductSync(shopifyProductId, productType, targetCollectionTitle, variations != null && !variations.isEmpty());

        log.info("[Shopify] SHOPIFY PRODUCT UPDATED: id='{}', code='{}'", shopifyProductId, productCode);
        return Map.of("productId", shopifyProductId);
    }

    public void verifyProductSync(String shopifyProductId, String expectedProductType, String expectedCollectionTitle, boolean expectVariations) {
        if (shopifyProductId == null || shopifyProductId.trim().isEmpty()) return;

        String query = "query verifyProduct($id: ID!) { product(id: $id) { " +
                "id title productType " +
                "collections(first: 20) { edges { node { id title } } } " +
                "variants(first: 50) { edges { node { id title price inventoryItem { id tracked } } } } " +
                "metafields(first: 10, namespace: \"kiyuziyu\") { edges { node { key value } } } " +
                "} }";

        Map<String, Object> data = executeQuery(query, Map.of("id", shopifyProductId));
        if (data == null || !data.containsKey("product")) {
            throw new ShopifyGraphQLException("Verification query failed: product not found in Shopify for id " + shopifyProductId, config.getStoreDomain());
        }

        Map<String, Object> product = (Map<String, Object>) data.get("product");
        if (product == null) {
            throw new ShopifyGraphQLException("Verification query failed: null product returned for id " + shopifyProductId, config.getStoreDomain());
        }

        // Verify variants and inventory tracking
        Map<String, Object> variantsObj = (Map<String, Object>) product.get("variants");
        List<Map<String, Object>> variantEdges = variantsObj != null ? (List<Map<String, Object>>) variantsObj.get("edges") : null;
        if (variantEdges == null || variantEdges.isEmpty()) {
            throw new ShopifyGraphQLException("Verification failed: product " + shopifyProductId + " has 0 variants", config.getStoreDomain());
        }
        if (expectVariations && variantEdges.size() < 2) {
            log.warn("[Shopify] Product {} expected multiple variants but has {}", shopifyProductId, variantEdges.size());
        }
        for (Map<String, Object> edge : variantEdges) {
            Map<String, Object> node = (Map<String, Object>) edge.get("node");
            if (node != null) {
                Map<String, Object> invItem = (Map<String, Object>) node.get("inventoryItem");
                if (invItem != null) {
                    Boolean tracked = (Boolean) invItem.get("tracked");
                    if (!Boolean.TRUE.equals(tracked)) {
                        log.warn("[Shopify] Variant {} inventoryItem is not tracked yet.", node.get("id"));
                    }
                }
            }
        }

        // Verify collection membership
        if (expectedCollectionTitle != null && !expectedCollectionTitle.trim().isEmpty()) {
            String targetCol = expectedCollectionTitle.trim();
            Map<String, Object> collectionsObj = (Map<String, Object>) product.get("collections");
            List<Map<String, Object>> colEdges = collectionsObj != null ? (List<Map<String, Object>>) collectionsObj.get("edges") : null;
            boolean foundCollection = false;
            List<String> presentCollections = new ArrayList<>();
            if (colEdges != null) {
                for (Map<String, Object> edge : colEdges) {
                    Map<String, Object> node = (Map<String, Object>) edge.get("node");
                    if (node != null && node.get("title") != null) {
                        String title = node.get("title").toString().trim();
                        presentCollections.add(title);
                        if (title.equalsIgnoreCase(targetCol)) {
                            foundCollection = true;
                        }
                    }
                }
            }
            if (!foundCollection) {
                log.error("[Shopify] Verification failed: product {} is not in expected collection '{}'. Present collections: {}",
                        shopifyProductId, targetCol, presentCollections);
                throw new ShopifyGraphQLException(
                        "Verification failed: product " + shopifyProductId + " is not in expected Shopify collection '" + targetCol + "'. Present collections: " + presentCollections,
                        config.getStoreDomain());
            }
            log.info("[Shopify] Verified collection membership for product {}: collection='{}'", shopifyProductId, targetCol);
        }

        // Verify metafields
        Map<String, Object> metafieldsObj = (Map<String, Object>) product.get("metafields");
        List<Map<String, Object>> mfEdges = metafieldsObj != null ? (List<Map<String, Object>>) metafieldsObj.get("edges") : null;
        Set<String> presentKeys = new HashSet<>();
        if (mfEdges != null) {
            for (Map<String, Object> edge : mfEdges) {
                Map<String, Object> node = (Map<String, Object>) edge.get("node");
                if (node != null && node.get("key") != null && node.get("value") != null && !node.get("value").toString().isEmpty()) {
                    presentKeys.add((String) node.get("key"));
                }
            }
        }
        log.info("[Shopify] Verified product {}: variantsCount={}, presentMetafields={}, productType='{}'",
                shopifyProductId, variantEdges.size(), presentKeys, product.get("productType"));
    }

    public Map<String, String> createProduct(String title, String descriptionHtml, String productCode, String firebaseProductId, Double basePrice, String imageUrl) {
        return createProduct(title, descriptionHtml, productCode, firebaseProductId, basePrice, basePrice, imageUrl, null, null, null, null, null, 0);
    }

    public Map<String, String> createProduct(String title, String descriptionHtml, String productCode, String firebaseProductId, String imageUrl) {
        return createProduct(title, descriptionHtml, productCode, firebaseProductId, null, imageUrl);
    }

    public Map<String, String> createProduct(String title, String descriptionHtml, String productCode, String imageUrl) {
        return createProduct(title, descriptionHtml, productCode, null, null, imageUrl);
    }

    public void updateVariantPrice(String productId, String variantId, double price) {
        updateVariantDetails(productId, variantId, (Double) price, null);
    }

    public void updateVariantDetails(String productId, String variantId, double price) {
        updateVariantDetails(productId, variantId, (Double) price, null);
    }

    public void updateVariantDetails(String productId, String variantId, Double price, String sku) {
        String mutation = "mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) { " +
                "productVariantsBulkUpdate(productId: $productId, variants: $variants) { " +
                "userErrors { field message } } }";

        Map<String, Object> variant = new HashMap<>();
        variant.put("id", variantId);
        
        if (price != null && price > 0) {
            variant.put("price", String.valueOf(price));
        }
        
        if (sku != null && !sku.trim().isEmpty()) {
            Map<String, Object> inventoryItem = new HashMap<>();
            inventoryItem.put("sku", sku.trim());
            variant.put("inventoryItem", inventoryItem);
        }

        Map<String, Object> variables = new HashMap<>();
        variables.put("productId", productId);
        variables.put("variants", List.of(variant));

        Map<String, Object> data = executeQuery(mutation, variables);
        Map<String, Object> bulkUpdate = (Map<String, Object>) data.get("productVariantsBulkUpdate");

        checkUserErrors(bulkUpdate, "productVariantsBulkUpdate");
    }

    public List<Map<String, Object>> getWebhookSubscriptions() {
        String query = "query getWebhooks { webhookSubscriptions(first: 50) { edges { node { id topic endpoint { __typename ... on WebhookHttpEndpoint { callbackUrl } } } } } }";
        Map<String, Object> data = executeQuery(query, null);
        if (data != null && data.containsKey("webhookSubscriptions")) {
            Map<String, Object> subs = (Map<String, Object>) data.get("webhookSubscriptions");
            if (subs != null && subs.containsKey("edges")) {
                List<Map<String, Object>> edges = (List<Map<String, Object>>) subs.get("edges");
                List<Map<String, Object>> result = new ArrayList<>();
                for (Map<String, Object> edge : edges) {
                    if (edge.get("node") instanceof Map) {
                        result.add((Map<String, Object>) edge.get("node"));
                    }
                }
                return result;
            }
        }
        return Collections.emptyList();
    }

    public Map<String, Object> registerWebhookSubscription(String topic, String callbackUrl) {
        String normalizedTopic = topic != null ? topic.trim().toUpperCase().replace('/', '_') : "";
        String mutation = "mutation webhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {\n" +
                "  webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {\n" +
                "    userErrors {\n" +
                "      field\n" +
                "      message\n" +
                "    }\n" +
                "    webhookSubscription {\n" +
                "      id\n" +
                "      topic\n" +
                "      endpoint {\n" +
                "        __typename\n" +
                "        ... on WebhookHttpEndpoint {\n" +
                "          callbackUrl\n" +
                "        }\n" +
                "      }\n" +
                "    }\n" +
                "  }\n" +
                "}";

        Map<String, Object> subInput = new HashMap<>();
        subInput.put("callbackUrl", callbackUrl);
        subInput.put("format", "JSON");

        Map<String, Object> variables = new HashMap<>();
        variables.put("topic", normalizedTopic);
        variables.put("webhookSubscription", subInput);

        Map<String, Object> data = executeQuery(mutation, variables);
        Map<String, Object> createResult = (Map<String, Object>) data.get("webhookSubscriptionCreate");
        checkUserErrors(createResult, "webhookSubscriptionCreate");
        return (Map<String, Object>) createResult.get("webhookSubscription");
    }

    public boolean deleteWebhookSubscription(String id) {
        String mutation = "mutation webhookSubscriptionDelete($id: ID!) {\n" +
                "  webhookSubscriptionDelete(id: $id) {\n" +
                "    userErrors {\n" +
                "      field\n" +
                "      message\n" +
                "    }\n" +
                "    deletedWebhookSubscriptionId\n" +
                "  }\n" +
                "}";

        Map<String, Object> variables = new HashMap<>();
        variables.put("id", id);

        Map<String, Object> data = executeQuery(mutation, variables);
        Map<String, Object> deleteResult = (Map<String, Object>) data.get("webhookSubscriptionDelete");
        checkUserErrors(deleteResult, "webhookSubscriptionDelete");
        return deleteResult != null && deleteResult.get("deletedWebhookSubscriptionId") != null;
    }

    public Map<String, Object> getInventoryItem(String inventoryItemId) {
        String gid = inventoryItemId != null && inventoryItemId.startsWith("gid://") ? inventoryItemId : "gid://shopify/InventoryItem/" + inventoryItemId;
        String query = "query getInventoryItem($id: ID!) {\n" +
                "  inventoryItem(id: $id) {\n" +
                "    id\n" +
                "    sku\n" +
                "    variant {\n" +
                "      id\n" +
                "      title\n" +
                "      sku\n" +
                "      product {\n" +
                "        id\n" +
                "        title\n" +
                "      }\n" +
                "    }\n" +
                "  }\n" +
                "}";

        Map<String, Object> variables = new HashMap<>();
        variables.put("id", gid);

        Map<String, Object> data = executeQuery(query, variables);
        if (data != null && data.containsKey("inventoryItem")) {
            return (Map<String, Object>) data.get("inventoryItem");
        }
        return Collections.emptyMap();
    }

    public Map<String, Object> getShopifyOrder(String orderId) {
        String gid = orderId != null && orderId.startsWith("gid://") ? orderId : "gid://shopify/Order/" + orderId;
        String query = "query getOrder($id: ID!) {\n" +
                "  order(id: $id) {\n" +
                "    id\n" +
                "    name\n" +
                "    createdAt\n" +
                "    displayFinancialStatus\n" +
                "    displayFulfillmentStatus\n" +
                "    note\n" +
                "    totalPriceSet {\n" +
                "      shopMoney {\n" +
                "        amount\n" +
                "        currencyCode\n" +
                "      }\n" +
                "    }\n" +
                "    customer {\n" +
                "      firstName\n" +
                "      lastName\n" +
                "      email\n" +
                "      phone\n" +
                "    }\n" +
                "    shippingAddress {\n" +
                "      name\n" +
                "      company\n" +
                "      address1\n" +
                "      address2\n" +
                "      city\n" +
                "      province\n" +
                "      zip\n" +
                "      country\n" +
                "      phone\n" +
                "    }\n" +
                "    billingAddress {\n" +
                "      name\n" +
                "      company\n" +
                "      address1\n" +
                "      address2\n" +
                "      city\n" +
                "      province\n" +
                "      zip\n" +
                "      country\n" +
                "      phone\n" +
                "    }\n" +
                "    lineItems(first: 50) {\n" +
                "      edges {\n" +
                "        node {\n" +
                "          id\n" +
                "          title\n" +
                "          quantity\n" +
                "          sku\n" +
                "          originalUnitPriceSet {\n" +
                "            shopMoney {\n" +
                "              amount\n" +
                "            }\n" +
                "          }\n" +
                "          variant {\n" +
                "            id\n" +
                "            title\n" +
                "            sku\n" +
                "          }\n" +
                "        }\n" +
                "      }\n" +
                "    }\n" +
                "  }\n" +
                "}";

        Map<String, Object> variables = new HashMap<>();
        variables.put("id", gid);

        Map<String, Object> data = executeQuery(query, variables);
        if (data != null && data.containsKey("order")) {
            return (Map<String, Object>) data.get("order");
        }
        return Collections.emptyMap();
    }

    public List<Map<String, Object>> getRecentShopifyOrders(int limit) {
        String query = "query getRecentOrders($first: Int!) {\n" +
                "  orders(first: $first, sortKey: CREATED_AT, reverse: true) {\n" +
                "    edges {\n" +
                "      node {\n" +
                "        id\n" +
                "        name\n" +
                "        createdAt\n" +
                "        displayFinancialStatus\n" +
                "        displayFulfillmentStatus\n" +
                "        note\n" +
                "        totalPriceSet {\n" +
                "          shopMoney {\n" +
                "            amount\n" +
                "            currencyCode\n" +
                "          }\n" +
                "        }\n" +
                "        customer {\n" +
                "          firstName\n" +
                "          lastName\n" +
                "          email\n" +
                "          phone\n" +
                "        }\n" +
                "        shippingAddress {\n" +
                "          name\n" +
                "          company\n" +
                "          address1\n" +
                "          address2\n" +
                "          city\n" +
                "          province\n" +
                "          zip\n" +
                "          country\n" +
                "          phone\n" +
                "        }\n" +
                "        billingAddress {\n" +
                "          name\n" +
                "          company\n" +
                "          address1\n" +
                "          address2\n" +
                "          city\n" +
                "          province\n" +
                "          zip\n" +
                "          country\n" +
                "          phone\n" +
                "        }\n" +
                "        lineItems(first: 50) {\n" +
                "          edges {\n" +
                "            node {\n" +
                "              id\n" +
                "              title\n" +
                "              quantity\n" +
                "              sku\n" +
                "              originalUnitPriceSet {\n" +
                "                shopMoney {\n" +
                "                  amount\n" +
                "                }\n" +
                "              }\n" +
                "              variant {\n" +
                "                id\n" +
                "                title\n" +
                "                sku\n" +
                "              }\n" +
                "            }\n" +
                "          }\n" +
                "        }\n" +
                "      }\n" +
                "    }\n" +
                "  }\n" +
                "}";

        Map<String, Object> variables = new HashMap<>();
        variables.put("first", limit);

        Map<String, Object> data = executeQuery(query, variables);
        if (data != null && data.containsKey("orders")) {
            Map<String, Object> ordersMap = (Map<String, Object>) data.get("orders");
            if (ordersMap != null && ordersMap.containsKey("edges")) {
                List<Map<String, Object>> edges = (List<Map<String, Object>>) ordersMap.get("edges");
                List<Map<String, Object>> result = new ArrayList<>();
                for (Map<String, Object> edge : edges) {
                    if (edge.get("node") instanceof Map) {
                        result.add((Map<String, Object>) edge.get("node"));
                    }
                }
                return result;
            }
        }
        return Collections.emptyList();
    }

    private void checkUserErrors(Map<String, Object> payload, String operation) {
        if (payload != null && payload.containsKey("userErrors")) {
            List<Map<String, Object>> userErrors = (List<Map<String, Object>>) payload.get("userErrors");
            if (userErrors != null && !userErrors.isEmpty()) {
                String errorDetails = userErrors.toString();
                if (errorDetails.contains("trial accounts") || errorDetails.contains("Select a plan to upload this file")) {
                    log.warn("[Shopify] SHOPIFY MEDIA FAILED: {}", errorDetails);
                }
                throw new ShopifyGraphQLException("UserErrors in " + operation + ": " + errorDetails, config.getStoreDomain());
            }
        }
    }
}
