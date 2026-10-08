package com.kiyuziyu.api.model;

import com.google.cloud.firestore.annotation.DocumentId;

public class ShopifyOAuthState {

    @DocumentId
    private String stateId;
    private String tenantId;
    private String shopDomain;
    private long expiryTimestamp;

    public ShopifyOAuthState() {
    }

    public ShopifyOAuthState(String stateId, String tenantId, String shopDomain, long expiryTimestamp) {
        this.stateId = stateId;
        this.tenantId = tenantId;
        this.shopDomain = shopDomain;
        this.expiryTimestamp = expiryTimestamp;
    }

    public String getStateId() {
        return stateId;
    }

    public void setStateId(String stateId) {
        this.stateId = stateId;
    }

    public String getTenantId() {
        return tenantId;
    }

    public void setTenantId(String tenantId) {
        this.tenantId = tenantId;
    }

    public String getShopDomain() {
        return shopDomain;
    }

    public void setShopDomain(String shopDomain) {
        this.shopDomain = shopDomain;
    }

    public long getExpiryTimestamp() {
        return expiryTimestamp;
    }

    public void setExpiryTimestamp(long expiryTimestamp) {
        this.expiryTimestamp = expiryTimestamp;
    }
}
