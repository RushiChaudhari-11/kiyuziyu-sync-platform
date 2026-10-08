package com.kiyuziyu.api.model;

public class OwnerProduct {
    private String selectionId;
    private String tenantId;
    private String storeId;
    private String productId;
    private String productCode;
    private boolean enabled;
    private String createdAt;
    private String updatedAt;

    public OwnerProduct() {
    }

    public OwnerProduct(String selectionId, String tenantId, String storeId, String productId, String productCode, boolean enabled, String createdAt, String updatedAt) {
        this.selectionId = selectionId;
        this.tenantId = tenantId;
        this.storeId = storeId;
        this.productId = productId;
        this.productCode = productCode;
        this.enabled = enabled;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public String getSelectionId() {
        return selectionId;
    }

    public void setSelectionId(String selectionId) {
        this.selectionId = selectionId;
    }

    public String getTenantId() {
        return tenantId;
    }

    public void setTenantId(String tenantId) {
        this.tenantId = tenantId;
    }

    public String getStoreId() {
        return storeId;
    }

    public void setStoreId(String storeId) {
        this.storeId = storeId;
    }

    public String getProductId() {
        return productId;
    }

    public void setProductId(String productId) {
        this.productId = productId;
    }

    public String getProductCode() {
        return productCode;
    }

    public void setProductCode(String productCode) {
        this.productCode = productCode;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
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
