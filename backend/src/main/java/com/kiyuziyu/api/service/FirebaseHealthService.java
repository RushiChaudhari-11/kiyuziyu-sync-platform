package com.kiyuziyu.api.service;

import com.google.cloud.firestore.Firestore;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class FirebaseHealthService {

    private final Firestore firestore;

    @Autowired
    public FirebaseHealthService(@Autowired(required = false) Firestore firestore) {
        this.firestore = firestore;
    }

    public boolean checkFirebaseConnection() {
        if (firestore == null) {
            return false;
        }
        
        try {
            // Lightweight check: Attempt to iterate over collections
            firestore.listCollections().iterator().hasNext();
            return true;
        } catch (Exception e) {
            System.err.println("Firebase connectivity check failed: " + e.getMessage());
            return false;
        }
    }
}
