package com.kiyuziyu.api.repository;

import com.google.cloud.firestore.DocumentReference;
import com.google.cloud.firestore.Firestore;
import com.kiyuziyu.api.model.ClientProductOverride;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Repository;

import java.util.concurrent.ExecutionException;

@Repository
public class ClientProductOverrideRepository {

    @Autowired
    private Firestore firestore;

    public void save(ClientProductOverride override) throws ExecutionException, InterruptedException {
        String id = override.getClientId() + "_" + override.getProductCode();
        override.setOverrideId(id);
        firestore.collection("clientProductOverrides").document(id).set(override).get();
    }

    public ClientProductOverride findByClientAndProduct(String clientId, String productCode) throws ExecutionException, InterruptedException {
        String id = clientId + "_" + productCode;
        DocumentReference docRef = firestore.collection("clientProductOverrides").document(id);
        if (docRef.get().get().exists()) {
            return docRef.get().get().toObject(ClientProductOverride.class);
        }
        return null;
    }
}
