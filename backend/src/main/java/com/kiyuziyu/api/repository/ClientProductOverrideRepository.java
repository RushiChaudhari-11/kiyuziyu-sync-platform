package com.kiyuziyu.api.repository;

import com.google.cloud.firestore.DocumentReference;
import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.kiyuziyu.api.model.ClientProductOverride;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Repository;

import java.util.concurrent.ExecutionException;

@Repository
public class ClientProductOverrideRepository {

    @Autowired
    private Firestore firestore;

    private String buildDocId(String clientId, String productCode) {
        // Firestore document IDs cannot contain '/' — replace with '_'
        String safe = clientId.trim() + "_" + productCode.trim();
        return safe.replace('/', '_').replace(' ', '_');
    }

    public void save(ClientProductOverride override) throws ExecutionException, InterruptedException {
        if (override == null || override.getClientId() == null || override.getClientId().trim().isEmpty()
                || override.getProductCode() == null || override.getProductCode().trim().isEmpty()) {
            return;
        }
        String id = buildDocId(override.getClientId(), override.getProductCode());
        override.setOverrideId(id);
        firestore.collection("clientProductOverrides").document(id).set(override).get();
    }

    public ClientProductOverride findByClientAndProduct(String clientId, String productCode) throws ExecutionException, InterruptedException {
        if (clientId == null || clientId.trim().isEmpty() || productCode == null || productCode.trim().isEmpty()) {
            return null;
        }
        String id = buildDocId(clientId, productCode);
        DocumentReference docRef = firestore.collection("clientProductOverrides").document(id);
        DocumentSnapshot snap = docRef.get().get();
        if (snap.exists()) {
            return snap.toObject(ClientProductOverride.class);
        }
        return null;
    }
}
