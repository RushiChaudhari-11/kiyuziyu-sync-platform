package com.kiyuziyu.api.dto.shopifyconnection;

public class ShopifyConnectionResponse {

    private String connectionId;
    private String tenantId;
    private String storeId;
    private String shopifyStoreDomain;
    private String shopifyStoreId;
    private boolean connected;
    private String status;
    private String connectedAt;
    private String updatedAt;

    public ShopifyConnectionResponse() {
    }

    public ShopifyConnectionResponse(String connectionId, String tenantId, String storeId, String shopifyStoreDomain, String shopifyStoreId, boolean connected, String status, String connectedAt, String updatedAt) {
        this.connectionId = connectionId;
        this.tenantId = tenantId;
        this.storeId = storeId;
        this.shopifyStoreDomain = shopifyStoreDomain;
        this.shopifyStoreId = shopifyStoreId;
        this.connected = connected;
        this.status = status;
        this.connectedAt = connectedAt;
        this.updatedAt = updatedAt;
    }

    public String getConnectionId() {
        return connectionId;
    }

    public void setConnectionId(String connectionId) {
        this.connectionId = connectionId;
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

    public String getShopifyStoreDomain() {
        return shopifyStoreDomain;
    }

    public void setShopifyStoreDomain(String shopifyStoreDomain) {
        this.shopifyStoreDomain = shopifyStoreDomain;
    }

    public String getShopifyStoreId() {
        return shopifyStoreId;
    }

    public void setShopifyStoreId(String shopifyStoreId) {
        this.shopifyStoreId = shopifyStoreId;
    }



    public boolean isConnected() {
        return connected;
    }

    public void setConnected(boolean connected) {
        this.connected = connected;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getConnectedAt() {
        return connectedAt;
    }

    public void setConnectedAt(String connectedAt) {
        this.connectedAt = connectedAt;
    }

    public String getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(String updatedAt) {
        this.updatedAt = updatedAt;
    }
}
