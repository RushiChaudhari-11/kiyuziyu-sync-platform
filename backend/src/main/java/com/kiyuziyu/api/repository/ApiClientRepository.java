package com.kiyuziyu.api.repository;

import com.google.cloud.firestore.DocumentReference;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.QueryDocumentSnapshot;
import com.kiyuziyu.api.model.ApiClient;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Repository;

import java.util.concurrent.ExecutionException;

@Repository
public class ApiClientRepository {

    @Autowired
    private Firestore firestore;

    public void save(ApiClient client) throws ExecutionException, InterruptedException {
        firestore.collection("apiClients").document(client.getClientId()).set(client).get();
    }

    public ApiClient findById(String clientId) throws ExecutionException, InterruptedException {
        DocumentReference docRef = firestore.collection("apiClients").document(clientId);
        return docRef.get().get().toObject(ApiClient.class);
    }
}
