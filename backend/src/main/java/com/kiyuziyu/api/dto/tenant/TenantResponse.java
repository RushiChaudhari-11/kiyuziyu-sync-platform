package com.kiyuziyu.api.dto.tenant;

import com.google.cloud.Timestamp;
import com.kiyuziyu.api.model.Tenant;

public class TenantResponse {

    private String tenantId;
    private String name;
    private String code;
    private String status;
    private String ownerUserId;
    private String createdAt;
    private String updatedAt;

    public TenantResponse() {
    }

    public static TenantResponse from(Tenant tenant) {
        if (tenant == null) return null;
        TenantResponse dto = new TenantResponse();
        dto.setTenantId(tenant.getTenantId());
        dto.setName(tenant.getName());
        dto.setCode(tenant.getCode());
        dto.setStatus(tenant.getStatus());
        dto.setOwnerUserId(tenant.getOwnerUserId());
        dto.setCreatedAt(formatTimestamp(tenant.getCreatedAt()));
        dto.setUpdatedAt(formatTimestamp(tenant.getUpdatedAt()));
        return dto;
    }

    private static String formatTimestamp(Timestamp ts) {
        if (ts == null) return null;
        return ts.toDate().toInstant().toString();
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
