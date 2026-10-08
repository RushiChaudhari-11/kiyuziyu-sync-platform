package com.kiyuziyu.api.model;

import com.google.cloud.firestore.annotation.DocumentId;
import com.google.cloud.Timestamp;

public class ApiCredential {
    @DocumentId
    private String credentialId;
    private String clientId;
    private String apiKeyHash;
    private String status; // ACTIVE, REVOKED
    private Timestamp createdAt;
    private Timestamp lastUsedAt;

    // Getters and Setters
    public String getCredentialId() { return credentialId; }
    public void setCredentialId(String credentialId) { this.credentialId = credentialId; }
    public String getClientId() { return clientId; }
    public void setClientId(String clientId) { this.clientId = clientId; }
    public String getApiKeyHash() { return apiKeyHash; }
    public void setApiKeyHash(String apiKeyHash) { this.apiKeyHash = apiKeyHash; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Timestamp getCreatedAt() { return createdAt; }
    public void setCreatedAt(Timestamp createdAt) { this.createdAt = createdAt; }
    public Timestamp getLastUsedAt() { return lastUsedAt; }
    public void setLastUsedAt(Timestamp lastUsedAt) { this.lastUsedAt = lastUsedAt; }
}
