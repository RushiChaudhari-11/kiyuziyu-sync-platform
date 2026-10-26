package com.kiyuziyu.api.service;

import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.Query;
import com.google.cloud.firestore.QueryDocumentSnapshot;
import com.kiyuziyu.api.integration.shopify.ShopifyContextHolder;
import com.kiyuziyu.api.integration.shopify.ShopifyGraphQLClient;
import com.kiyuziyu.api.model.ShopifyConnection;
import com.kiyuziyu.api.model.ShopifyProductMapping;
import com.kiyuziyu.api.repository.ShopifyConnectionRepository;
import com.kiyuziyu.api.repository.ShopifyProductMappingRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class ShopifyInventoryWebhookService {

    private static final Logger log = LoggerFactory.getLogger(ShopifyInventoryWebhookService.class);

    @Autowired
    private Firestore firestore;

    @Autowired
    private ShopifyGraphQLClient graphQLClient;

    @Autowired
    private ShopifyConnectionRepository connectionRepository;

    @Autowired
    private ShopifyProductMappingRepository mappingRepository;

    /**
     * Processes inventory_levels/update webhook from Shopify.
     * Updates Firebase product/variant stock to the authoritative Shopify available inventory.
     * Uses RealtimeStockListener.suppressLoop to prevent circular echo sync back to Shopify.
     */
    public boolean processInventoryLevelUpdate(String shopDomain, String explicitTenantId, Map<String, Object> payload) {
        if (payload == null) {
            log.warn("[ShopifyInventoryWebhook] Received null payload");
            return false;
        }

        Object invItemIdObj = payload.get("inventory_item_id");
        Object availableObj = payload.get("available");
        if (invItemIdObj == null || availableObj == null) {
            log.warn("[ShopifyInventoryWebhook] Missing inventory_item_id or available in payload: {}", payload);
            return false;
        }

        String inventoryItemId = String.valueOf(invItemIdObj).trim();
        int availableQty = 0;
        if (availableObj instanceof Number) {
            availableQty = ((Number) availableObj).intValue();
        } else {
            try {
                availableQty = Integer.parseInt(String.valueOf(availableObj).trim());
            } catch (Exception e) {
                log.warn("[ShopifyInventoryWebhook] Invalid available quantity: {}", availableObj);
                return false;
            }
        }

        // Resolve shop domain and connection
        String resolvedShopDomain = shopDomain;
        if ((resolvedShopDomain == null || resolvedShopDomain.trim().isEmpty()) && explicitTenantId != null) {
            ShopifyConnection conn = connectionRepository.findByTenantId(explicitTenantId);
            if (conn != null && conn.getShopifyStoreDomain() != null) {
                resolvedShopDomain = conn.getShopifyStoreDomain();
            }
        }

        log.info("[ShopifyInventoryWebhook] Processing inventory_levels/update for inventoryItemId={}, available={}, shopDomain={}",
                inventoryItemId, availableQty, resolvedShopDomain);

        if (resolvedShopDomain != null && !resolvedShopDomain.trim().isEmpty()) {
            ShopifyContextHolder.setContext(resolvedShopDomain.trim());
        }

        try {
            // Step 1: Query Shopify GraphQL to retrieve SKU and variant details
            String sku = null;
            String shopifyProductId = null;
            try {
                Map<String, Object> itemData = graphQLClient.getInventoryItem(inventoryItemId);
                if (itemData != null && !itemData.isEmpty()) {
                    sku = (String) itemData.get("sku");
                    @SuppressWarnings("unchecked")
                    Map<String, Object> variant = (Map<String, Object>) itemData.get("variant");
                    if (variant != null) {
                        if (sku == null || sku.trim().isEmpty()) {
                            sku = (String) variant.get("sku");
                        }
                        if (variant.containsKey("product")) {
                            @SuppressWarnings("unchecked")
                            Map<String, Object> prod = (Map<String, Object>) variant.get("product");
                            if (prod != null) {
                                shopifyProductId = (String) prod.get("id");
                            }
                        }
                    }
                }
            } catch (Exception ex) {
                log.warn("[ShopifyInventoryWebhook] GraphQL inventory item lookup failed for id {}: {}", inventoryItemId, ex.getMessage());
            }

            // Step 2: Fallback lookup via ShopifyProductMapping if SKU is still unknown
            if ((sku == null || sku.trim().isEmpty()) && shopifyProductId != null) {
                ShopifyProductMapping mapping = mappingRepository.findByShopifyProductId(shopifyProductId);
                if (mapping != null && mapping.getProductCode() != null) {
                    sku = mapping.getProductCode();
                }
            }

            if (sku == null || sku.trim().isEmpty()) {
                log.warn("[ShopifyInventoryWebhook] Could not determine SKU or productCode for inventoryItemId={}", inventoryItemId);
                return false;
            }

            com.kiyuziyu.api.util.ShopifySkuParser.SkuParseResult parsedSku = com.kiyuziyu.api.util.ShopifySkuParser.parse(sku);
            String productCode = parsedSku.getBaseProductCode();
            int variantIdx = parsedSku.getVariantIndex();
            log.info("[ShopifyInventoryWebhook] Resolved SKU='{}' -> baseProductCode='{}', variantIdx={} for inventoryItemId={}",
                    sku, productCode, variantIdx, inventoryItemId);

            // Step 3: Query matching master products in Firestore
            List<QueryDocumentSnapshot> matchingDocs = new ArrayList<>();
            try {
                Query query = firestore.collectionGroup("products").whereEqualTo("productCode", productCode);
                matchingDocs = query.get().get().getDocuments();
                if (matchingDocs.isEmpty()) {
                    query = firestore.collectionGroup("products").whereEqualTo("productCode", productCode + " ");
                    matchingDocs = query.get().get().getDocuments();
                }
            } catch (Exception cgEx) {
                log.warn("[ShopifyInventoryWebhook] collectionGroup query failed for {}: {}. Trying iteration fallback...", productCode, cgEx.getMessage());
            }

            if (matchingDocs.isEmpty()) {
                // Iteration fallback across collections and subcollections
                Iterable<com.google.cloud.firestore.DocumentReference> collections = firestore.collection("collections").listDocuments();
                for (com.google.cloud.firestore.DocumentReference colRef : collections) {
                    Iterable<com.google.cloud.firestore.DocumentReference> subcollections = colRef.collection("subcollections").listDocuments();
                    for (com.google.cloud.firestore.DocumentReference subRef : subcollections) {
                        Query q = subRef.collection("products").whereEqualTo("productCode", productCode);
                        List<QueryDocumentSnapshot> docs = q.get().get().getDocuments();
                        if (docs.isEmpty()) {
                            q = subRef.collection("products").whereEqualTo("productCode", productCode + " ");
                            docs = q.get().get().getDocuments();
                        }
                        if (!docs.isEmpty()) {
                            matchingDocs.addAll(docs);
                        }
                    }
                }
            }

            if (matchingDocs.isEmpty()) {
                log.warn("[ShopifyInventoryWebhook] No Firebase product found with productCode={}", productCode);
                return false;
            }

            // Step 4: Update product and/or variant quantity in Firestore
            for (QueryDocumentSnapshot doc : matchingDocs) {
                String docId = doc.getId();
                // CRITICAL: Suppress RealtimeStockListener loop so Firebase doesn't echo back to Shopify
                RealtimeStockListener.suppressLoop(docId);
                RealtimeStockListener.suppressLoop(productCode);

                Map<String, Object> updates = new HashMap<>();

                if (variantIdx >= 0) {
                    @SuppressWarnings("unchecked")
                    List<Map<String, Object>> variations = (List<Map<String, Object>>) doc.get("variations");
                    if (variations != null && variantIdx < variations.size()) {
                        List<Map<String, Object>> mutableVariations = new ArrayList<>();
                        int totalStock = 0;
                        for (int i = 0; i < variations.size(); i++) {
                            Map<String, Object> v = new HashMap<>(variations.get(i));
                            if (i == variantIdx) {
                                v.put("quantity", availableQty);
                                totalStock += availableQty;
                            } else {
                                Object qVal = v.get("quantity");
                                if (qVal == null) qVal = v.get("initialQuantity");
                                int currentVQty = 0;
                                if (qVal instanceof Number) currentVQty = ((Number) qVal).intValue();
                                else if (qVal instanceof String) {
                                    try { currentVQty = Integer.parseInt((String) qVal); } catch (Exception ignored) {}
                                }
                                totalStock += currentVQty;
                            }
                            mutableVariations.add(v);
                        }
                        updates.put("variations", mutableVariations);
                        updates.put("quantity", totalStock);
                        log.info("[ShopifyInventoryWebhook] Updating variant index {} to qty={} and total quantity={} on doc={}",
                                variantIdx, availableQty, totalStock, docId);
                    } else {
                        updates.put("quantity", availableQty);
                    }
                } else {
                    updates.put("quantity", availableQty);
                    log.info("[ShopifyInventoryWebhook] Updating root product quantity={} on doc={}", availableQty, docId);
                }

                doc.getReference().update(updates).get();
                log.info("[ShopifyInventoryWebhook] Successfully synced Shopify stock to Firebase for docId={}, productCode={}, available={}",
                        docId, productCode, availableQty);
            }

            return true;
        } catch (Exception e) {
            log.error("[ShopifyInventoryWebhook] Error updating inventory for item {}: {}", inventoryItemId, e.getMessage(), e);
            return false;
        } finally {
            ShopifyContextHolder.clearContext();
        }
    }
}
