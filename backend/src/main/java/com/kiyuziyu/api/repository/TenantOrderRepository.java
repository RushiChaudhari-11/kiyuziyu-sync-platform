package com.kiyuziyu.api.repository;

import com.google.cloud.firestore.Firestore;
import com.kiyuziyu.api.model.TenantOrder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Repository;

import java.util.concurrent.ExecutionException;

@Repository
public class TenantOrderRepository {

    private static final Logger log = LoggerFactory.getLogger(TenantOrderRepository.class);
    public static final String COLLECTION_NAME = "apiTenantOrders";

    @Autowired
    private Firestore firestore;

    public void save(TenantOrder order) throws ExecutionException, InterruptedException {
        if (firestore == null || order == null || order.getOrderId() == null) {
            return;
        }
        firestore.collection(COLLECTION_NAME)
                .document(order.getOrderId().trim())
                .set(order)
                .get();
        log.info("[TenantOrderRepo] Saved Order: orderId={}, tenantId={}, shopifyOrderId={}",
                order.getOrderId(), order.getTenantId(), order.getShopifyOrderId());
    }

    public boolean existsByShopifyOrderId(String tenantId, String shopifyOrderId) {
        try {
            com.google.cloud.firestore.QuerySnapshot querySnapshot = firestore.collection(COLLECTION_NAME)
                    .whereEqualTo("tenantId", tenantId)
                    .whereEqualTo("shopifyOrderId", shopifyOrderId)
                    .limit(1)
                    .get()
                    .get();
            return !querySnapshot.isEmpty();
        } catch (Exception e) {
            log.error("Failed to check if order exists", e);
            return false;
        }
    }

    public boolean acquireLock(String tenantId, String shopifyOrderId) {
        String lockId = "lock_" + tenantId + "_" + shopifyOrderId;
        try {
            firestore.collection("apiOrderLocks").document(lockId).create(java.util.Map.of("lockedAt", System.currentTimeMillis())).get();
            return true;
        } catch (Exception e) {
            log.warn("[TenantOrderRepo] Order already locked or processed: {}", lockId);
            return false;
        }
    }

    public java.util.List<TenantOrder> findByTenantId(String tenantId) {
        java.util.List<TenantOrder> list = new java.util.ArrayList<>();
        if (firestore == null || tenantId == null || tenantId.trim().isEmpty()) {
            return list;
        }
        try {
            com.google.cloud.firestore.QuerySnapshot snap = firestore.collection(COLLECTION_NAME)
                    .whereEqualTo("tenantId", tenantId.trim())
                    .get()
                    .get();
            for (com.google.cloud.firestore.QueryDocumentSnapshot doc : snap.getDocuments()) {
                TenantOrder order = doc.toObject(TenantOrder.class);
                if (order != null) {
                    if (order.getOrderId() == null) {
                        order.setOrderId(doc.getId());
                    }
                    list.add(order);
                }
            }
        } catch (Exception e) {
            log.warn("[TenantOrderRepo] Failed to findByTenantId for {}: {}", tenantId, e.getMessage());
        }
        return list;
    }
}
