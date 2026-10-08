package com.kiyuziyu.api.repository;

import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.QuerySnapshot;
import com.kiyuziyu.api.model.ShopifyConnection;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Repository;
import java.util.ArrayList;
import java.util.List;

@Repository
public class ShopifyConnectionRepository {

    private static final Logger log = LoggerFactory.getLogger(ShopifyConnectionRepository.class);

    public static final String COLLECTION_NAME = "apiShopifyConnections";

    @Autowired(required = false)
    private Firestore firestore;

    public void save(ShopifyConnection connection) {
        if (firestore == null || connection == null || connection.getConnectionId() == null) {
            return;
        }
        try {
            firestore.collection(COLLECTION_NAME)
                    .document(connection.getConnectionId().trim())
                    .set(connection)
                    .get();
            log.info("[ShopifyConnectionRepo] Saved connectionId={}, tenantId={}, storeId={}, status={}",
                    connection.getConnectionId(), connection.getTenantId(), connection.getStoreId(), connection.getStatus());
        } catch (Exception e) {
            log.warn("[ShopifyConnectionRepo] Failed to save connection {}: {}", connection.getConnectionId(), e.getMessage());
        }
    }

    public ShopifyConnection findByStoreId(String tenantId, String storeId) {
        if (firestore == null || tenantId == null || storeId == null) {
            return null;
        }
        try {
            QuerySnapshot snap = firestore.collection(COLLECTION_NAME)
                    .whereEqualTo("tenantId", tenantId.trim())
                    .whereEqualTo("storeId", storeId.trim())
                    .limit(1)
                    .get()
                    .get();
            if (!snap.isEmpty()) {
                return snap.getDocuments().get(0).toObject(ShopifyConnection.class);
            }
        } catch (Exception e) {
            log.warn("[ShopifyConnectionRepo] Failed to findByStoreId for tenantId={}, storeId={}: {}", tenantId, storeId, e.getMessage());
        }
        return null;
    }

    public ShopifyConnection findByTenantId(String tenantId) {
        if (firestore == null || tenantId == null || tenantId.trim().isEmpty()) {
            return null;
        }
        try {
            QuerySnapshot snap = firestore.collection(COLLECTION_NAME)
                    .whereEqualTo("tenantId", tenantId.trim())
                    .limit(1)
                    .get()
                    .get();
            if (!snap.isEmpty()) {
                return snap.getDocuments().get(0).toObject(ShopifyConnection.class);
            }
        } catch (Exception e) {
            log.warn("[ShopifyConnectionRepo] Failed to findByTenantId for tenantId={}: {}", tenantId, e.getMessage());
        }
        return null;
    }

    public ShopifyConnection findById(String connectionId) {
        if (firestore == null || connectionId == null || connectionId.trim().isEmpty()) {
            return null;
        }
        try {
            com.google.cloud.firestore.DocumentSnapshot snap = firestore.collection(COLLECTION_NAME)
                    .document(connectionId.trim())
                    .get()
                    .get();
            if (snap.exists()) {
                return snap.toObject(ShopifyConnection.class);
            }
        } catch (Exception e) {
            log.warn("[ShopifyConnectionRepo] Failed to findById for connectionId={}: {}", connectionId, e.getMessage());
        }
        return null;
    }

    public ShopifyConnection findByStoreId(String storeId) {
        if (firestore == null || storeId == null) {
            return null;
        }
        try {
            QuerySnapshot snap = firestore.collection(COLLECTION_NAME)
                    .whereEqualTo("storeId", storeId.trim())
                    .limit(1)
                    .get()
                    .get();
            if (!snap.isEmpty()) {
                return snap.getDocuments().get(0).toObject(ShopifyConnection.class);
            }
        } catch (Exception e) {
            log.warn("[ShopifyConnectionRepo] Failed to findByStoreId for storeId={}: {}", storeId, e.getMessage());
        }
        return null;
    }

    public ShopifyConnection findByShopifyStoreDomain(String shopifyStoreDomain) {
        if (firestore == null || shopifyStoreDomain == null || shopifyStoreDomain.trim().isEmpty()) {
            return null;
        }
        try {
            QuerySnapshot snap = firestore.collection(COLLECTION_NAME)
                    .whereEqualTo("shopifyStoreDomain", shopifyStoreDomain.trim())
                    .whereEqualTo("status", "CONNECTED")
                    .limit(1)
                    .get()
                    .get();
            if (!snap.isEmpty()) {
                return snap.getDocuments().get(0).toObject(ShopifyConnection.class);
            }
        } catch (Exception e) {
            log.warn("[ShopifyConnectionRepo] Failed to findByShopifyStoreDomain for domain={}: {}", shopifyStoreDomain, e.getMessage());
        }
        return null;
    }

    public List<ShopifyConnection> findAllConnected() {
        List<ShopifyConnection> list = new ArrayList<>();
        if (firestore == null) return list;
        try {
            QuerySnapshot snap = firestore.collection(COLLECTION_NAME)
                    .whereEqualTo("status", "CONNECTED")
                    .get()
                    .get();
            for (var doc : snap.getDocuments()) {
                list.add(doc.toObject(ShopifyConnection.class));
            }
        } catch (Exception e) {
            log.warn("[ShopifyConnectionRepo] Failed to findAllConnected: {}", e.getMessage());
        }
        return list;
    }

    public void delete(String connectionId) {
        if (firestore == null || connectionId == null || connectionId.trim().isEmpty()) {
            return;
        }
        try {
            firestore.collection(COLLECTION_NAME)
                    .document(connectionId.trim())
                    .delete()
                    .get();
            log.info("[ShopifyConnectionRepo] Deleted connectionId={}", connectionId);
        } catch (Exception e) {
            log.warn("[ShopifyConnectionRepo] Failed to delete connectionId={}: {}", connectionId, e.getMessage());
        }
    }
}

