package com.kiyuziyu.api.dto.admin;

import com.kiyuziyu.api.model.Tenant;

public class AdminTenantListItem {
    private String tenantId;
    private String name;
    private String businessName;
    private String fullName;
    private String code;
    private String ownerUserId;
    private String ownerEmail;
    private String status;
    private String subscriptionType;
    private String subscriptionStartDate;
    private String subscriptionEndDate;
    private Double subscriptionAmount;
    private String createdAt;
    private String updatedAt;

    public AdminTenantListItem() {}

    public static AdminTenantListItem from(Tenant tenant) {
        if (tenant == null) return null;
        AdminTenantListItem item = new AdminTenantListItem();
        item.setTenantId(tenant.getTenantId());
        item.setName(tenant.getName());
        item.setBusinessName(tenant.getBusinessName());
        item.setFullName(tenant.getFullName());
        item.setCode(tenant.getCode());
        item.setOwnerUserId(tenant.getOwnerUserId());
        item.setStatus(tenant.getStatus());
        item.setSubscriptionType(tenant.getSubscriptionType());
        if (tenant.getSubscriptionStartDate() != null) {
            item.setSubscriptionStartDate(tenant.getSubscriptionStartDate().toDate().toInstant().toString());
        }
        if (tenant.getSubscriptionEndDate() != null) {
            item.setSubscriptionEndDate(tenant.getSubscriptionEndDate().toDate().toInstant().toString());
        }
        item.setSubscriptionAmount(tenant.getSubscriptionAmount());
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

    public String getBusinessName() {
        return businessName;
    }

    public void setBusinessName(String businessName) {
        this.businessName = businessName;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
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

    public String getOwnerEmail() {
        return ownerEmail;
    }

    public void setOwnerEmail(String ownerEmail) {
        this.ownerEmail = ownerEmail;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getSubscriptionType() {
        return subscriptionType;
    }

    public void setSubscriptionType(String subscriptionType) {
        this.subscriptionType = subscriptionType;
    }

    public String getSubscriptionStartDate() {
        return subscriptionStartDate;
    }

    public void setSubscriptionStartDate(String subscriptionStartDate) {
        this.subscriptionStartDate = subscriptionStartDate;
    }

    public String getSubscriptionEndDate() {
        return subscriptionEndDate;
    }

    public void setSubscriptionEndDate(String subscriptionEndDate) {
        this.subscriptionEndDate = subscriptionEndDate;
    }

    public Double getSubscriptionAmount() {
        return subscriptionAmount;
    }

    public void setSubscriptionAmount(Double subscriptionAmount) {
        this.subscriptionAmount = subscriptionAmount;
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
