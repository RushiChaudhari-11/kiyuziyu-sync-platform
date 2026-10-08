package com.kiyuziyu.api.repository;

import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.QuerySnapshot;
import com.kiyuziyu.api.model.Tenant;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Repository;

import java.util.concurrent.ExecutionException;

@Repository
public class TenantRepository {

    @Autowired
    private Firestore firestore;

    public static final String COLLECTION_NAME = "apiTenants";

    public boolean existsById(String tenantId) throws ExecutionException, InterruptedException {
        if (firestore == null || tenantId == null || tenantId.trim().isEmpty()) {
            return false;
        }
        DocumentSnapshot snap = firestore.collection(COLLECTION_NAME).document(tenantId.trim()).get().get();
        return snap.exists();
    }

    public boolean existsByCode(String code) throws ExecutionException, InterruptedException {
        if (firestore == null || code == null || code.trim().isEmpty()) {
            return false;
        }
        QuerySnapshot snap = firestore.collection(COLLECTION_NAME)
                .whereEqualTo("code", code.trim().toUpperCase())
                .limit(1)
                .get()
                .get();
        return !snap.isEmpty();
    }

    public Tenant findById(String tenantId) throws ExecutionException, InterruptedException {
        if (firestore == null || tenantId == null || tenantId.trim().isEmpty()) {
            return null;
        }
        DocumentSnapshot snap = firestore.collection(COLLECTION_NAME).document(tenantId.trim()).get().get();
        if (snap.exists()) {
            return snap.toObject(Tenant.class);
        }
        return null;
    }

    public Tenant findByCode(String code) throws ExecutionException, InterruptedException {
        if (firestore == null || code == null || code.trim().isEmpty()) {
            return null;
        }
        QuerySnapshot snap = firestore.collection(COLLECTION_NAME)
                .whereEqualTo("code", code.trim().toUpperCase())
                .limit(1)
                .get()
                .get();
        if (!snap.isEmpty()) {
            return snap.getDocuments().get(0).toObject(Tenant.class);
        }
        return null;
    }

    public void save(Tenant tenant) throws ExecutionException, InterruptedException {
        if (firestore == null || tenant == null || tenant.getTenantId() == null) {
            return;
        }
        firestore.collection(COLLECTION_NAME).document(tenant.getTenantId().trim()).set(tenant).get();
    }

    public java.util.List<Tenant> findAll() throws ExecutionException, InterruptedException {
        if (firestore == null) {
            return java.util.Collections.emptyList();
        }
        QuerySnapshot snap = firestore.collection(COLLECTION_NAME).get().get();
        java.util.List<Tenant> list = new java.util.ArrayList<>();
        for (DocumentSnapshot doc : snap.getDocuments()) {
            Tenant t = doc.toObject(Tenant.class);
            if (t != null) {
                list.add(t);
            }
        }
        return list;
    }
}

