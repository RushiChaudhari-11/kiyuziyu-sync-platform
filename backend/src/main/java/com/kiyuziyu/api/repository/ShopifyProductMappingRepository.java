package com.kiyuziyu.api.repository;

import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.QueryDocumentSnapshot;
import com.google.cloud.firestore.QuerySnapshot;
import com.kiyuziyu.api.model.ShopifyProductMapping;
import com.kiyuziyu.api.util.ShopifySkuParser;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutionException;

@Repository
public class ShopifyProductMappingRepository {

    private static final Logger log = LoggerFactory.getLogger(ShopifyProductMappingRepository.class);

    public static final String COLLECTION_NAME = "apiShopifyProductMappings";

    @Autowired
    private Firestore firestore;

    private final Map<String, ShopifyProductMapping> cacheByShopifyId = new ConcurrentHashMap<>();
    private final Map<String, ShopifyProductMapping> cacheByProductCode = new ConcurrentHashMap<>();
    private final Map<String, ShopifyProductMapping> cacheByProductId = new ConcurrentHashMap<>();
    private volatile long lastCacheRefreshTime = 0;
    private static final long CACHE_TTL_MS = 300_000; // 5 minutes

    public void save(ShopifyProductMapping mapping) throws ExecutionException, InterruptedException {
        if (firestore == null || mapping == null || mapping.getMappingId() == null) {
            return;
        }
        firestore.collection(COLLECTION_NAME)
                .document(mapping.getMappingId().trim())
                .set(mapping)
                .get();
        indexMappingInCache(mapping);
        log.info("[ShopifyProductMappingRepo] Saved mappingId={}, tenantId={}, storeId={}, productId={}, shopifyProductId={}",
                mapping.getMappingId(), mapping.getTenantId(), mapping.getStoreId(), mapping.getProductId(), mapping.getShopifyProductId());
    }

    private void indexMappingInCache(ShopifyProductMapping m) {
        if (m == null) return;
        if (m.getShopifyProductId() != null) {
            String sId = m.getShopifyProductId().trim();
            cacheByShopifyId.put(sId, m);
            if (sId.contains("/")) {
                String numeric = sId.substring(sId.lastIndexOf('/') + 1);
                cacheByShopifyId.put(numeric, m);
            } else {
                cacheByShopifyId.put("gid://shopify/Product/" + sId, m);
            }
        }
        if (m.getProductCode() != null) {
            String pCode = m.getProductCode().trim();
            cacheByProductCode.put(pCode.toLowerCase(), m);
            cacheByProductCode.put(ShopifySkuParser.normalize(pCode).toLowerCase(), m);
        }
        if (m.getProductId() != null) {
            cacheByProductId.put(m.getProductId().trim(), m);
        }
    }

    public synchronized void refreshCacheIfStale() {
        long now = System.currentTimeMillis();
        if (now - lastCacheRefreshTime < CACHE_TTL_MS && !cacheByShopifyId.isEmpty()) {
            return;
        }
        if (firestore == null) return;
        try {
            QuerySnapshot snap = firestore.collection(COLLECTION_NAME).get().get();
            for (QueryDocumentSnapshot doc : snap.getDocuments()) {
                ShopifyProductMapping m = doc.toObject(ShopifyProductMapping.class);
                indexMappingInCache(m);
            }
            lastCacheRefreshTime = now;
            log.info("[ShopifyProductMappingRepo] Refreshed mapping cache (loaded {} mappings)", snap.size());
        } catch (Exception e) {
            log.warn("[ShopifyProductMappingRepo] Cache refresh failed: {}", e.getMessage());
        }
    }

    public ShopifyProductMapping findByStoreAndProduct(String tenantId, String storeId, String productId) throws ExecutionException, InterruptedException {
        if (firestore == null || tenantId == null || storeId == null || productId == null) {
            return null;
        }
        QuerySnapshot snap = firestore.collection(COLLECTION_NAME)
                .whereEqualTo("tenantId", tenantId.trim())
                .whereEqualTo("storeId", storeId.trim())
                .whereEqualTo("productId", productId.trim())
                .limit(1)
                .get()
                .get();
        if (!snap.isEmpty()) {
            ShopifyProductMapping m = snap.getDocuments().get(0).toObject(ShopifyProductMapping.class);
            indexMappingInCache(m);
            return m;
        }
        return null;
    }

    public ShopifyProductMapping findByStoreAndShopifyProductId(String tenantId, String storeId, String shopifyProductId) throws ExecutionException, InterruptedException {
        if (firestore == null || tenantId == null || storeId == null || shopifyProductId == null) {
            return null;
        }
        String cleanId = shopifyProductId.trim();
        ShopifyProductMapping m = findByShopifyProductId(cleanId);
        if (m != null) return m;

        QuerySnapshot snap = firestore.collection(COLLECTION_NAME)
                .whereEqualTo("tenantId", tenantId.trim())
                .whereEqualTo("storeId", storeId.trim())
                .whereEqualTo("shopifyProductId", cleanId)
                .limit(1)
                .get()
                .get();
        if (!snap.isEmpty()) {
            ShopifyProductMapping mapping = snap.getDocuments().get(0).toObject(ShopifyProductMapping.class);
            indexMappingInCache(mapping);
            return mapping;
        }
        return null;
    }

    public List<ShopifyProductMapping> findAllByStore(String tenantId, String storeId) throws ExecutionException, InterruptedException {
        List<ShopifyProductMapping> list = new ArrayList<>();
        if (firestore == null || tenantId == null || storeId == null) {
            return list;
        }
        QuerySnapshot snap = firestore.collection(COLLECTION_NAME)
                .whereEqualTo("tenantId", tenantId.trim())
                .whereEqualTo("storeId", storeId.trim())
                .get()
                .get();
        for (QueryDocumentSnapshot doc : snap.getDocuments()) {
            list.add(doc.toObject(ShopifyProductMapping.class));
        }
        return list;
    }

    public List<ShopifyProductMapping> findAllByTenant(String tenantId) throws ExecutionException, InterruptedException {
        List<ShopifyProductMapping> list = new ArrayList<>();
        if (firestore == null || tenantId == null || tenantId.trim().isEmpty()) {
            return list;
        }
        QuerySnapshot snap = firestore.collection(COLLECTION_NAME)
                .whereEqualTo("tenantId", tenantId.trim())
                .get()
                .get();
        for (QueryDocumentSnapshot doc : snap.getDocuments()) {
            list.add(doc.toObject(ShopifyProductMapping.class));
        }
        return list;
    }

    public void delete(String mappingId) throws ExecutionException, InterruptedException {
        if (firestore == null || mappingId == null || mappingId.trim().isEmpty()) {
            return;
        }
        firestore.collection(COLLECTION_NAME)
                .document(mappingId.trim())
                .delete()
                .get();
        log.info("[ShopifyProductMappingRepo] Deleted mappingId={}", mappingId);
    }

    public ShopifyProductMapping findByShopifyProductId(String shopifyProductId) {
        if (shopifyProductId == null || shopifyProductId.trim().isEmpty()) {
            return null;
        }
        String clean = shopifyProductId.trim();
        refreshCacheIfStale();

        // 1. In-memory cache check
        if (cacheByShopifyId.containsKey(clean)) {
            return cacheByShopifyId.get(clean);
        }
        if (clean.contains("/")) {
            String num = clean.substring(clean.lastIndexOf('/') + 1);
            if (cacheByShopifyId.containsKey(num)) return cacheByShopifyId.get(num);
        } else {
            String gid = "gid://shopify/Product/" + clean;
            if (cacheByShopifyId.containsKey(gid)) return cacheByShopifyId.get(gid);
        }

        // 2. Firestore query
        if (firestore != null) {
            try {
                QuerySnapshot snap = firestore.collection(COLLECTION_NAME)
                        .whereEqualTo("shopifyProductId", clean)
                        .limit(1)
                        .get()
                        .get();
                if (snap.isEmpty() && !clean.startsWith("gid://shopify/Product/")) {
                    snap = firestore.collection(COLLECTION_NAME)
                            .whereEqualTo("shopifyProductId", "gid://shopify/Product/" + clean)
                            .limit(1)
                            .get()
                            .get();
                }
                if (snap.isEmpty() && clean.contains("/")) {
                    String num = clean.substring(clean.lastIndexOf('/') + 1);
                    snap = firestore.collection(COLLECTION_NAME)
                            .whereEqualTo("shopifyProductId", num)
                            .limit(1)
                            .get()
                            .get();
                }
                if (!snap.isEmpty()) {
                    ShopifyProductMapping m = snap.getDocuments().get(0).toObject(ShopifyProductMapping.class);
                    indexMappingInCache(m);
                    return m;
                }
            } catch (Exception e) {
                log.warn("[ShopifyProductMappingRepo] Error finding mapping by shopifyProductId {}: {}", shopifyProductId, e.getMessage());
            }
        }
        return null;
    }

    public ShopifyProductMapping findByProductCode(String productCode) {
        if (productCode == null || productCode.trim().isEmpty()) {
            return null;
        }
        refreshCacheIfStale();

        String clean = productCode.trim();
        String norm = ShopifySkuParser.normalize(clean).toLowerCase();

        // 1. Cache check
        if (cacheByProductCode.containsKey(clean.toLowerCase())) {
            return cacheByProductCode.get(clean.toLowerCase());
        }
        if (cacheByProductCode.containsKey(norm)) {
            return cacheByProductCode.get(norm);
        }

        // 2. Firestore query
        if (firestore != null) {
            try {
                QuerySnapshot snap = firestore.collection(COLLECTION_NAME)
                        .whereEqualTo("productCode", clean)
                        .limit(1)
                        .get()
                        .get();
                if (snap.isEmpty()) {
                    snap = firestore.collection(COLLECTION_NAME)
                            .whereEqualTo("productCode", clean + " ")
                            .limit(1)
                            .get()
                            .get();
                }
                if (snap.isEmpty()) {
                    snap = firestore.collection(COLLECTION_NAME)
                            .whereEqualTo("productCode", clean + "  ")
                            .limit(1)
                            .get()
                            .get();
                }
                if (!snap.isEmpty()) {
                    ShopifyProductMapping m = snap.getDocuments().get(0).toObject(ShopifyProductMapping.class);
                    indexMappingInCache(m);
                    return m;
                }
            } catch (Exception e) {
                log.warn("[ShopifyProductMappingRepo] Error finding mapping by productCode {}: {}", productCode, e.getMessage());
            }
        }
        return null;
    }

    /**
     * Resolves mapping by either incoming SKU (parsing suffix) or productCode.
     */
    public ShopifyProductMapping findBySkuOrProductCode(String skuOrCode) {
        if (skuOrCode == null || skuOrCode.trim().isEmpty()) {
            return null;
        }
        ShopifyProductMapping m = findByProductCode(skuOrCode);
        if (m != null) return m;

        ShopifySkuParser.SkuParseResult parsed = ShopifySkuParser.parse(skuOrCode);
        if (parsed.hasVariantSuffix() && !parsed.getBaseProductCode().isEmpty()) {
            m = findByProductCode(parsed.getBaseProductCode());
            if (m != null) return m;
        }

        return null;
    }
}
