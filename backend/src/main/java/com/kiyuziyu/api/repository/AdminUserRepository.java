package com.kiyuziyu.api.repository;

import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.kiyuziyu.api.model.AdminUser;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Repository;

import java.util.concurrent.ExecutionException;

@Repository
public class AdminUserRepository {

    @Autowired
    private Firestore firestore;

    public static final String COLLECTION_NAME = "adminUsers";

    public AdminUser findByUid(String uid) throws ExecutionException, InterruptedException {
        if (firestore == null || uid == null || uid.trim().isEmpty()) {
            return null;
        }
        DocumentSnapshot snap = firestore.collection(COLLECTION_NAME).document(uid.trim()).get().get();
        if (snap.exists()) {
            return snap.toObject(AdminUser.class);
        }
        return null;
    }

    public void save(AdminUser adminUser) throws ExecutionException, InterruptedException {
        if (firestore == null || adminUser == null || adminUser.getUid() == null) {
            return;
        }
        firestore.collection(COLLECTION_NAME).document(adminUser.getUid().trim()).set(adminUser).get();
    }
}
