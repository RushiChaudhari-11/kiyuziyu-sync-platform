package com.kiyuziyu.api.dto.shopifymapping;

public class ShopifyProductMappingResponse {

    private String mappingId;
    private String tenantId;
    private String storeId;
    private String connectionId;
    private String productId;
    private String productCode;
    private String shopifyProductId;
    private String shopifyProductHandle;
    private String status;
    private String createdAt;
    private String updatedAt;

    public ShopifyProductMappingResponse() {
    }

    public ShopifyProductMappingResponse(String mappingId, String tenantId, String storeId, String connectionId, String productId, String productCode, String shopifyProductId, String shopifyProductHandle, String status, String createdAt, String updatedAt) {
        this.mappingId = mappingId;
        this.tenantId = tenantId;
        this.storeId = storeId;
        this.connectionId = connectionId;
        this.productId = productId;
        this.productCode = productCode;
        this.shopifyProductId = shopifyProductId;
        this.shopifyProductHandle = shopifyProductHandle;
        this.status = status;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public String getMappingId() {
        return mappingId;
    }

    public void setMappingId(String mappingId) {
        this.mappingId = mappingId;
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

    public String getConnectionId() {
        return connectionId;
    }

    public void setConnectionId(String connectionId) {
        this.connectionId = connectionId;
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

    public String getShopifyProductId() {
        return shopifyProductId;
    }

    public void setShopifyProductId(String shopifyProductId) {
        this.shopifyProductId = shopifyProductId;
    }

    public String getShopifyProductHandle() {
        return shopifyProductHandle;
    }

    public void setShopifyProductHandle(String shopifyProductHandle) {
        this.shopifyProductHandle = shopifyProductHandle;
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
