package com.kiyuziyu.api.model;

import com.google.cloud.Timestamp;
import com.google.cloud.firestore.annotation.DocumentId;

public class OrderIdempotency {
    @DocumentId
    private String idempotencyId; // format: clientId_idempotencyKey
    
    private String orderId;
    private Timestamp createdAt;

    public OrderIdempotency() {}

    public String getIdempotencyId() { return idempotencyId; }
    public void setIdempotencyId(String idempotencyId) { this.idempotencyId = idempotencyId; }
    public String getOrderId() { return orderId; }
    public void setOrderId(String orderId) { this.orderId = orderId; }
    public Timestamp getCreatedAt() { return createdAt; }
    public void setCreatedAt(Timestamp createdAt) { this.createdAt = createdAt; }
}
