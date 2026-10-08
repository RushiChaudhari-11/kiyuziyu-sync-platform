package com.kiyuziyu.api.repository;

import com.google.cloud.firestore.CollectionReference;
import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.QueryDocumentSnapshot;
import com.google.cloud.firestore.QuerySnapshot;
import com.kiyuziyu.api.model.Store;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutionException;

@Repository
public class StoreRepository {

    @Autowired
    private Firestore firestore;

    public static final String TENANT_COLLECTION = "apiTenants";
    public static final String STORES_SUBCOLLECTION = "stores";

    private CollectionReference getStoresCollection(String tenantId) {
        return firestore.collection(TENANT_COLLECTION).document(tenantId.trim()).collection(STORES_SUBCOLLECTION);
    }

    public boolean existsByCode(String tenantId, String code) throws ExecutionException, InterruptedException {
        if (firestore == null || tenantId == null || code == null) {
            return false;
        }
        QuerySnapshot snap = getStoresCollection(tenantId)
                .whereEqualTo("code", code.trim().toUpperCase())
                .limit(1)
                .get()
                .get();
        return !snap.isEmpty();
    }

    public Store findById(String tenantId, String storeId) throws ExecutionException, InterruptedException {
        if (firestore == null || tenantId == null || storeId == null) {
            return null;
        }
        DocumentSnapshot snap = getStoresCollection(tenantId).document(storeId.trim()).get().get();
        if (snap.exists()) {
            return snap.toObject(Store.class);
        }
        return null;
    }

    public Store findByCode(String tenantId, String code) throws ExecutionException, InterruptedException {
        if (firestore == null || tenantId == null || code == null) {
            return null;
        }
        QuerySnapshot snap = getStoresCollection(tenantId)
                .whereEqualTo("code", code.trim().toUpperCase())
                .limit(1)
                .get()
                .get();
        if (!snap.isEmpty()) {
            return snap.getDocuments().get(0).toObject(Store.class);
        }
        return null;
    }

    public List<Store> findAllByTenantId(String tenantId) throws ExecutionException, InterruptedException {
        List<Store> list = new ArrayList<>();
        if (firestore == null || tenantId == null || tenantId.trim().isEmpty()) {
            return list;
        }
        QuerySnapshot snap = getStoresCollection(tenantId).get().get();
        for (QueryDocumentSnapshot doc : snap.getDocuments()) {
            Store store = doc.toObject(Store.class);
            list.add(store);
        }
        return list;
    }

    public void save(String tenantId, Store store) throws ExecutionException, InterruptedException {
        if (firestore == null || tenantId == null || store == null || store.getStoreId() == null) {
            return;
        }
        getStoresCollection(tenantId).document(store.getStoreId().trim()).set(store).get();
    }

    public Store findByStoreId(String storeId) throws ExecutionException, InterruptedException {
        if (firestore == null || storeId == null || storeId.trim().isEmpty()) {
            return null;
        }
        QuerySnapshot snap = firestore.collectionGroup(STORES_SUBCOLLECTION)
                .whereEqualTo("storeId", storeId.trim())
                .limit(1)
                .get()
                .get();
        if (!snap.isEmpty()) {
            return snap.getDocuments().get(0).toObject(Store.class);
        }
        return null;
    }
}
