package com.kiyuziyu.api.model;

import com.google.cloud.Timestamp;
import com.google.cloud.firestore.annotation.DocumentId;

public class Tenant {

    @DocumentId
    private String tenantId;
    private String name;
    private String code;
    private String status;
    private String ownerUserId;
    private Timestamp createdAt;
    private Timestamp updatedAt;

    public Tenant() {
    }

    public Tenant(String tenantId, String name, String code, String ownerUserId) {
        this.tenantId = tenantId;
        this.name = name;
        this.code = code;
        this.ownerUserId = ownerUserId;
        this.status = TenantStatus.ACTIVE.name();
        this.createdAt = Timestamp.now();
        this.updatedAt = Timestamp.now();
    }

    public String getTenantId() {
        return tenantId;
    }

    public void setTenantId(String tenantId) {
        this.tenantId = tenantId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getOwnerUserId() {
        return ownerUserId;
    }

    public void setOwnerUserId(String ownerUserId) {
        this.ownerUserId = ownerUserId;
    }

    public Timestamp getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Timestamp createdAt) {
        this.createdAt = createdAt;
    }

    public Timestamp getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Timestamp updatedAt) {
        this.updatedAt = updatedAt;
    }
}
