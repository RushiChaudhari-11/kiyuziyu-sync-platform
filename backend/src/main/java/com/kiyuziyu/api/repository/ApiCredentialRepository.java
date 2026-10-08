package com.kiyuziyu.api.repository;

import com.google.cloud.firestore.DocumentReference;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.QueryDocumentSnapshot;
import com.kiyuziyu.api.model.ApiCredential;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.concurrent.ExecutionException;

@Repository
public class ApiCredentialRepository {

    @Autowired
    private Firestore firestore;

    public void save(ApiCredential credential) throws ExecutionException, InterruptedException {
        firestore.collection("apiCredentials").document(credential.getCredentialId()).set(credential).get();
    }

    public ApiCredential findByHash(String hash) throws ExecutionException, InterruptedException {
        List<QueryDocumentSnapshot> docs = firestore.collection("apiCredentials")
                .whereEqualTo("apiKeyHash", hash)
                .limit(1)
                .get().get().getDocuments();
        
        if (!docs.isEmpty()) {
            return docs.get(0).toObject(ApiCredential.class);
        }
        return null;
    }
}
