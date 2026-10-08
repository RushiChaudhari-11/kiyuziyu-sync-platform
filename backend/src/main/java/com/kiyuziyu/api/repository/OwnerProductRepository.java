package com.kiyuziyu.api.repository;

import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.QueryDocumentSnapshot;
import com.google.cloud.firestore.QuerySnapshot;
import com.kiyuziyu.api.model.OwnerProduct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutionException;

@Repository
public class OwnerProductRepository {

    private static final Logger log = LoggerFactory.getLogger(OwnerProductRepository.class);

    public static final String OWNER_PRODUCTS_COLLECTION = "apiOwnerProducts";

    @Autowired
    private Firestore firestore;

    public void save(OwnerProduct ownerProduct) throws ExecutionException, InterruptedException {
        if (firestore == null || ownerProduct == null || ownerProduct.getSelectionId() == null) {
            return;
        }
        firestore.collection(OWNER_PRODUCTS_COLLECTION)
                .document(ownerProduct.getSelectionId().trim())
                .set(ownerProduct)
                .get();
        log.info("[OwnerProductRepo] Saved selectionId={}, tenantId={}, storeId={}, productId={}",
                ownerProduct.getSelectionId(), ownerProduct.getTenantId(), ownerProduct.getStoreId(), ownerProduct.getProductId());
    }

    public OwnerProduct findByTenantStoreAndProduct(String tenantId, String storeId, String productId) throws ExecutionException, InterruptedException {
        if (firestore == null || tenantId == null || storeId == null || productId == null) {
            return null;
        }
        QuerySnapshot snap = firestore.collection(OWNER_PRODUCTS_COLLECTION)
                .whereEqualTo("tenantId", tenantId.trim())
                .whereEqualTo("storeId", storeId.trim())
                .whereEqualTo("productId", productId.trim())
                .limit(1)
                .get()
                .get();
        if (!snap.isEmpty()) {
            return snap.getDocuments().get(0).toObject(OwnerProduct.class);
        }
        return null;
    }

    public List<OwnerProduct> findByStoreId(String tenantId, String storeId) throws ExecutionException, InterruptedException {
        List<OwnerProduct> list = new ArrayList<>();
        if (firestore == null || tenantId == null || storeId == null) {
            return list;
        }
        QuerySnapshot snap = firestore.collection(OWNER_PRODUCTS_COLLECTION)
                .whereEqualTo("tenantId", tenantId.trim())
                .whereEqualTo("storeId", storeId.trim())
                .get()
                .get();
        for (QueryDocumentSnapshot doc : snap.getDocuments()) {
            list.add(doc.toObject(OwnerProduct.class));
        }
        return list;
    }

    public void delete(String selectionId) throws ExecutionException, InterruptedException {
        if (firestore == null || selectionId == null || selectionId.trim().isEmpty()) {
            return;
        }
        firestore.collection(OWNER_PRODUCTS_COLLECTION)
                .document(selectionId.trim())
                .delete()
                .get();
        log.info("[OwnerProductRepo] Deleted selectionId={}", selectionId);
    }
}
