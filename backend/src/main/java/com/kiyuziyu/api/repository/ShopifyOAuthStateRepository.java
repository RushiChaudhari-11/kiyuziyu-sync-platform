package com.kiyuziyu.api.repository;

import com.google.cloud.firestore.Firestore;
import com.kiyuziyu.api.model.ShopifyOAuthState;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Repository;

import java.util.concurrent.ExecutionException;

@Repository
public class ShopifyOAuthStateRepository {
    private static final String COLLECTION = "apiShopifyOAuthStates";
    
    @Autowired
    private Firestore firestore;
    
    public void save(ShopifyOAuthState state) throws ExecutionException, InterruptedException {
        firestore.collection(COLLECTION).document(state.getStateId()).set(state).get();
    }
    
    public ShopifyOAuthState findById(String stateId) throws ExecutionException, InterruptedException {
        var snap = firestore.collection(COLLECTION).document(stateId).get().get();
        return snap.exists() ? snap.toObject(ShopifyOAuthState.class) : null;
    }
    
    public void delete(String stateId) throws ExecutionException, InterruptedException {
        firestore.collection(COLLECTION).document(stateId).delete().get();
    }
}
