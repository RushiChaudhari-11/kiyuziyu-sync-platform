package com.kiyuziyu.api.dto.store;

import com.google.cloud.Timestamp;
import com.kiyuziyu.api.model.Store;

public class StoreResponse {

    private String storeId;
    private String tenantId;
    private String name;
    private String code;
    private String platform;
    private String status;
    private String createdAt;
    private String updatedAt;

    public StoreResponse() {
    }

    public static StoreResponse from(Store store) {
        if (store == null) return null;
        StoreResponse dto = new StoreResponse();
        dto.setStoreId(store.getStoreId());
        dto.setTenantId(store.getTenantId());
        dto.setName(store.getName());
        dto.setCode(store.getCode());
        dto.setPlatform(store.getPlatform());
        dto.setStatus(store.getStatus());
        dto.setCreatedAt(formatTimestamp(store.getCreatedAt()));
        dto.setUpdatedAt(formatTimestamp(store.getUpdatedAt()));
        return dto;
    }

    private static String formatTimestamp(Timestamp ts) {
        if (ts == null) return null;
        return ts.toDate().toInstant().toString();
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

    public String getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(String createdAt) {
        this.createdAt = createdAt;
    }

    public String getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(String updatedAt) {
        this.updatedAt = updatedAt;
    }
}
