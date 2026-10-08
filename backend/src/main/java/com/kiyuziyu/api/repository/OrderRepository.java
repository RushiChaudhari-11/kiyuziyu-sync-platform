package com.kiyuziyu.api.repository;

import com.google.api.core.ApiFuture;
import com.google.cloud.firestore.DocumentReference;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.Query;
import com.google.cloud.firestore.QuerySnapshot;
import com.google.cloud.firestore.Transaction;
import com.kiyuziyu.api.model.Order;
import com.kiyuziyu.api.model.OrderIdempotency;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.concurrent.ExecutionException;

@Repository
public class OrderRepository {

    @Autowired
    private Firestore firestore;

    public Order findById(String orderId) throws ExecutionException, InterruptedException {
        return firestore.collection("apiOrders").document(orderId).get().get().toObject(Order.class);
    }

    public List<Order> findByClientId(String clientId, int limit, int offset) throws ExecutionException, InterruptedException {
        Query query = firestore.collection("apiOrders")
                .whereEqualTo("clientId", clientId)
                .orderBy("createdAt", Query.Direction.DESCENDING)
                .offset(offset)
                .limit(limit);
        QuerySnapshot querySnapshot = query.get().get();
        return querySnapshot.toObjects(Order.class);
    }

    public OrderIdempotency findIdempotency(String idempotencyId) throws ExecutionException, InterruptedException {
        return firestore.collection("apiOrderIdempotency").document(idempotencyId).get().get().toObject(OrderIdempotency.class);
    }

    public DocumentReference getOrderRef(String orderId) {
        return firestore.collection("apiOrders").document(orderId);
    }

    public DocumentReference getIdempotencyRef(String idempotencyId) {
        return firestore.collection("apiOrderIdempotency").document(idempotencyId);
    }

    public DocumentReference getProductRef(String collectionId, String subcollectionId, String productId) {
        return firestore.collection("collections").document(collectionId)
                .collection("subcollections").document(subcollectionId)
                .collection("products").document(productId);
    }

    public DocumentReference getExternalIdRef(String clientId, String externalOrderId) {
        return firestore.collection("apiOrderExternalIds").document(clientId + "_" + externalOrderId);
    }

    public <T> T runTransaction(Transaction.Function<T> updateFunction) throws ExecutionException, InterruptedException {
        try {
            ApiFuture<T> transaction = firestore.runTransaction(updateFunction);
            return transaction.get();
        } catch (ExecutionException e) {
            Throwable cause = e.getCause();
            while (cause != null) {
                if (cause instanceof com.kiyuziyu.api.exception.BadRequestException ||
                    cause instanceof com.kiyuziyu.api.exception.NotFoundException ||
                    cause instanceof com.kiyuziyu.api.exception.ConflictException) {
                    throw (RuntimeException) cause;
                }
                cause = cause.getCause();
            }
            // If it's just a generic RuntimeException (like FirestoreException), unwrap it too
            if (e.getCause() instanceof RuntimeException) {
                throw (RuntimeException) e.getCause();
            }
            throw e;
        }
    }
}
