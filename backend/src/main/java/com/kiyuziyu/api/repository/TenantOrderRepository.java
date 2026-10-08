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
}
