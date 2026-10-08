package com.kiyuziyu.api.model;

import com.google.cloud.Timestamp;
import com.google.cloud.firestore.annotation.DocumentId;

public class Store {

    @DocumentId
    private String storeId;
    private String tenantId;
    private String name;
    private String code;
    private String platform;
    private String status;
    private Timestamp createdAt;
    private Timestamp updatedAt;

    public Store() {
    }

    public Store(String storeId, String tenantId, String name, String code, String platform) {
        this.storeId = storeId;
        this.tenantId = tenantId;
        this.name = name;
        this.code = code;
        this.platform = platform != null ? platform : StorePlatform.GENERIC.name();
        this.status = StoreStatus.ACTIVE.name();
        this.createdAt = Timestamp.now();
        this.updatedAt = Timestamp.now();
    }

    public String getStoreId() {
        return storeId;
    }

    public void setStoreId(String storeId) {
        this.storeId = storeId;
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

    public String getPlatform() {
        return platform;
    }

    public void setPlatform(String platform) {
        this.platform = platform;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
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
