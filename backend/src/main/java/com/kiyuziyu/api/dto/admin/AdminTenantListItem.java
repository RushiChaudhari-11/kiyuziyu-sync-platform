package com.kiyuziyu.api.dto.admin;

import com.kiyuziyu.api.model.Tenant;

public class AdminTenantListItem {
    private String tenantId;
    private String name;
    private String code;
    private String ownerUserId;
    private String status;
    private String createdAt;
    private String updatedAt;

    public AdminTenantListItem() {}

    public static AdminTenantListItem from(Tenant tenant) {
        if (tenant == null) return null;
        AdminTenantListItem item = new AdminTenantListItem();
        item.setTenantId(tenant.getTenantId());
        item.setName(tenant.getName());
        item.setCode(tenant.getCode());
        item.setOwnerUserId(tenant.getOwnerUserId());
        item.setStatus(tenant.getStatus());
        if (tenant.getCreatedAt() != null) {
            item.setCreatedAt(tenant.getCreatedAt().toDate().toInstant().toString());
        }
        if (tenant.getUpdatedAt() != null) {
            item.setUpdatedAt(tenant.getUpdatedAt().toDate().toInstant().toString());
        }
        return item;
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

    public String getOwnerUserId() {
        return ownerUserId;
    }

    public void setOwnerUserId(String ownerUserId) {
        this.ownerUserId = ownerUserId;
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
