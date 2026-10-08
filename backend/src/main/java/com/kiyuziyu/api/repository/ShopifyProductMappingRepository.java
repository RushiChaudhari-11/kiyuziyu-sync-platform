package com.kiyuziyu.api.repository;

import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.QueryDocumentSnapshot;
import com.google.cloud.firestore.QuerySnapshot;
import com.kiyuziyu.api.model.ShopifyProductMapping;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutionException;

@Repository
public class ShopifyProductMappingRepository {

    private static final Logger log = LoggerFactory.getLogger(ShopifyProductMappingRepository.class);

    public static final String COLLECTION_NAME = "apiShopifyProductMappings";

    @Autowired
    private Firestore firestore;

    public void save(ShopifyProductMapping mapping) throws ExecutionException, InterruptedException {
        if (firestore == null || mapping == null || mapping.getMappingId() == null) {
            return;
        }
        firestore.collection(COLLECTION_NAME)
                .document(mapping.getMappingId().trim())
                .set(mapping)
                .get();
        log.info("[ShopifyProductMappingRepo] Saved mappingId={}, tenantId={}, storeId={}, productId={}, shopifyProductId={}",
                mapping.getMappingId(), mapping.getTenantId(), mapping.getStoreId(), mapping.getProductId(), mapping.getShopifyProductId());
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
            return snap.getDocuments().get(0).toObject(ShopifyProductMapping.class);
        }
        return null;
    }

    public ShopifyProductMapping findByStoreAndShopifyProductId(String tenantId, String storeId, String shopifyProductId) throws ExecutionException, InterruptedException {
        if (firestore == null || tenantId == null || storeId == null || shopifyProductId == null) {
            return null;
        }
        QuerySnapshot snap = firestore.collection(COLLECTION_NAME)
                .whereEqualTo("tenantId", tenantId.trim())
                .whereEqualTo("storeId", storeId.trim())
                .whereEqualTo("shopifyProductId", shopifyProductId.trim())
                .limit(1)
                .get()
                .get();
        if (!snap.isEmpty()) {
            return snap.getDocuments().get(0).toObject(ShopifyProductMapping.class);
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
}
