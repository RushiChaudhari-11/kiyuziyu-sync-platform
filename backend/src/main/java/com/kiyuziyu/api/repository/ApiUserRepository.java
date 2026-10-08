package com.kiyuziyu.api.repository;

import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.kiyuziyu.api.model.ApiUser;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Repository;

import java.util.concurrent.ExecutionException;

@Repository
public class ApiUserRepository {

    @Autowired
    private Firestore firestore;

    public static final String COLLECTION_NAME = "apiUsers";

    public boolean existsById(String uid) throws ExecutionException, InterruptedException {
        if (firestore == null || uid == null || uid.trim().isEmpty()) {
            return false;
        }
        DocumentSnapshot snap = firestore.collection(COLLECTION_NAME).document(uid.trim()).get().get();
        return snap.exists();
    }

    public ApiUser findById(String uid) throws ExecutionException, InterruptedException {
        if (firestore == null || uid == null || uid.trim().isEmpty()) {
            return null;
        }
        DocumentSnapshot snap = firestore.collection(COLLECTION_NAME).document(uid.trim()).get().get();
        if (snap.exists()) {
            return snap.toObject(ApiUser.class);
        }
        return null;
    }

    public void save(ApiUser user) throws ExecutionException, InterruptedException {
        if (firestore == null || user == null || user.getUid() == null || user.getUid().trim().isEmpty()) {
            return;
        }
        firestore.collection(COLLECTION_NAME).document(user.getUid().trim()).set(user).get();
    }
}
