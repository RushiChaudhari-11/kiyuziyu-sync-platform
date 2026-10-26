package com.kiyuziyu.api.service;

import com.google.cloud.firestore.DocumentChange;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.QueryDocumentSnapshot;
import com.kiyuziyu.api.integration.shopify.ShopifyContextHolder;
import com.kiyuziyu.api.model.Product;
import com.kiyuziyu.api.model.ShopifyConnection;
import com.kiyuziyu.api.model.ShopifyProductMapping;
import com.kiyuziyu.api.repository.ShopifyConnectionRepository;
import com.kiyuziyu.api.repository.ShopifyProductMappingRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class RealtimeStockListener {

    private static final Logger log = LoggerFactory.getLogger(RealtimeStockListener.class);

    // Loop suppression cache: key = productId or productCode, value = timestamp millis
    public static final ConcurrentHashMap<String, Long> loopSuppressionCache = new ConcurrentHashMap<>();
    private static final long SUPPRESSION_WINDOW_MS = 15000L; // 15 seconds

    @Autowired
    private Firestore firestore;

    @Autowired
    private ShopifyProductMappingRepository mappingRepository;

    @Autowired
    private ShopifyConnectionRepository shopifyConnectionRepository;

    @Autowired
    private ShopifyProductService shopifyProductService;

    /**
     * Suppress Firestore realtime updates triggered by internal operations (e.g. Shopify Webhooks or Cancel Restores)
     */
    public static void suppressLoop(String key) {
        if (key != null && !key.trim().isEmpty()) {
            loopSuppressionCache.put(key.trim(), System.currentTimeMillis());
            log.info("[RealtimeStockListener] Loop suppression activated for key: {}", key.trim());
        }
    }

    public static boolean isSuppressed(String key) {
        if (key == null) return false;
        Long ts = loopSuppressionCache.get(key.trim());
        if (ts != null) {
            if (System.currentTimeMillis() - ts < SUPPRESSION_WINDOW_MS) {
                return true;
            } else {
                loopSuppressionCache.remove(key.trim());
            }
        }
        return false;
    }

    @PostConstruct
    public void initStockListener() {
        log.info("[RealtimeStockListener] Initializing Firestore listener for product stock updates...");
        
        // Listen to all products subcollections for real-time stock/variation updates
        firestore.collectionGroup("products").addSnapshotListener((snapshots, e) -> {
            if (e != null) {
                log.error("[RealtimeStockListener] Listen failed: {}", e.getMessage(), e);
                return;
            }

            if (snapshots != null) {
                for (DocumentChange dc : snapshots.getDocumentChanges()) {
                    if (dc.getType() == DocumentChange.Type.MODIFIED) {
                        try {
                            log.info("[RealtimeStockListener] Detected MODIFIED document in products collectionGroup: {}", dc.getDocument().getId());
                            handleProductUpdate(dc.getDocument());
                        } catch (Exception ex) {
                            log.error("[RealtimeStockListener] Error processing product update: {}", ex.getMessage(), ex);
                        }
                    }
                }
            }
        });
    }

    public void handleProductUpdate(QueryDocumentSnapshot document) throws Exception {
        String productId = document.getId();
        String productCode = document.getString("productCode");

        // Check if suppressed to prevent infinite loops from webhook order deductions or cancel restores
        if (isSuppressed(productId) || (productCode != null && isSuppressed(productCode))) {
            log.info("[RealtimeStockListener] Suppressing echo stock update for productId={}, productCode={}", productId, productCode);
            return;
        }
        
        log.info("[RealtimeStockListener] Handling stock update for productId={}, productCode={}", productId, productCode);

        // Only sync products that have already been mapped/synced by tenants to their Shopify stores
        List<ShopifyProductMapping> mappings = getMappingsForProduct(productId, productCode);
        
        if (mappings.isEmpty()) {
            log.info("[RealtimeStockListener] Product {} (code={}) is not synced to any Shopify store yet. Skipping auto-sync until explicitly synced by tenant.", productId, productCode);
            return;
        }

        Product product = document.toObject(Product.class);
        if (product.getId() == null) {
            product.setId(productId);
        }
        if (product.getProductCode() == null) {
            product.setProductCode(productCode);
        }

        log.info("[RealtimeStockListener] Product {} (code={}) was modified. Triggering direct inventory sync for {} store targets...",
                productId, productCode, mappings.size());

        for (ShopifyProductMapping mapping : mappings) {
            String tenantId = mapping.getTenantId();
            String storeId = mapping.getStoreId();
            String connectionId = mapping.getConnectionId();
            String shopifyProductId = mapping.getShopifyProductId();

            if (tenantId == null || storeId == null || connectionId == null || shopifyProductId == null) {
                continue;
            }

            try {
                ShopifyConnection connection = shopifyConnectionRepository.findById(connectionId);
                if (connection != null && connection.getShopifyStoreDomain() != null) {
                    ShopifyContextHolder.setContext(connection.getShopifyStoreDomain());
                    boolean success = shopifyProductService.syncInventoryOnly(tenantId, shopifyProductId, product);
                    if (success) {
                        log.info("[RealtimeStockListener] Successfully synced real-time inventory to Shopify store {} for product {}",
                                connection.getShopifyStoreDomain(), productId);
                    } else {
                        log.warn("[RealtimeStockListener] Inventory sync returned false for store {} and product {}",
                                connection.getShopifyStoreDomain(), productId);
                    }
                } else {
                    log.warn("[RealtimeStockListener] ShopifyConnection {} not found or missing domain", connectionId);
                }
            } catch (Exception ex) {
                log.error("[RealtimeStockListener] Failed direct inventory sync for product {} on store {}: {}",
                        productId, storeId, ex.getMessage(), ex);
            } finally {
                ShopifyContextHolder.clearContext();
            }
        }
    }

    private List<ShopifyProductMapping> getMappingsForProduct(String productId, String productCode) {
        List<ShopifyProductMapping> list = new ArrayList<>();
        try {
            // Strictly query by exact productId (Firestore documentId) to prevent cross-contamination
            // across distinct product documents that share the same productCode.
            var snap1 = firestore.collection(ShopifyProductMappingRepository.COLLECTION_NAME)
                    .whereEqualTo("productId", productId)
                    .get().get();
            
            for (var doc : snap1.getDocuments()) {
                ShopifyProductMapping m = doc.toObject(ShopifyProductMapping.class);
                if (m != null && isMappedStatus(m.getStatus())) {
                    list.add(m);
                }
            }
        } catch (Exception e) {
            log.warn("[RealtimeStockListener] Failed to get mappings for product {}: {}", productId, e.getMessage());
        }
        return list;
    }

    private boolean isMappedStatus(String status) {
        return status == null || "MAPPED".equalsIgnoreCase(status) || "SYNCED".equalsIgnoreCase(status) || "PARTIAL".equalsIgnoreCase(status);
    }
}
