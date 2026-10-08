package com.kiyuziyu.api.model;

import com.google.cloud.firestore.annotation.DocumentId;
import com.google.cloud.Timestamp;

public class ApiClient {
    @DocumentId
    private String clientId;
    private String clientName;
    private String domain;
    private String status; // ACTIVE, SUSPENDED, REVOKED
    private Timestamp createdAt;
    private Timestamp updatedAt;

    // Getters and Setters
    public String getClientId() { return clientId; }
    public void setClientId(String clientId) { this.clientId = clientId; }
    public String getClientName() { return clientName; }
    public void setClientName(String clientName) { this.clientName = clientName; }
    public String getDomain() { return domain; }
    public void setDomain(String domain) { this.domain = domain; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Timestamp getCreatedAt() { return createdAt; }
    public void setCreatedAt(Timestamp createdAt) { this.createdAt = createdAt; }
    public Timestamp getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Timestamp updatedAt) { this.updatedAt = updatedAt; }
}
