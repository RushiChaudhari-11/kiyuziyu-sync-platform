package com.kiyuziyu.api.model;

import com.google.cloud.firestore.annotation.DocumentId;

public class ShopifyConnection {

    @DocumentId
    private String connectionId;
    private String tenantId;
    private String storeId;
    private String shopifyStoreDomain;
    private String shopifyStoreId;

    private String status;
    private String connectedAt;
    private String updatedAt;
    
    private String accessToken;
    private String scopes;
    private String refreshToken;
    private Long accessTokenExpiresAt;
    private Long refreshTokenExpiresAt;

    public ShopifyConnection() {
    }

    public ShopifyConnection(String connectionId, String tenantId, String storeId, String shopifyStoreDomain, String shopifyStoreId, String status, String connectedAt, String updatedAt) {
        this.connectionId = connectionId;
        this.tenantId = tenantId;
        this.storeId = storeId;
        this.shopifyStoreDomain = shopifyStoreDomain;
        this.shopifyStoreId = shopifyStoreId;
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

    public String getAccessToken() {
        return accessToken;
    }

    public void setAccessToken(String accessToken) {
        this.accessToken = accessToken;
    }

    public String getScopes() {
        return scopes;
    }

    public void setScopes(String scopes) {
        this.scopes = scopes;
    }

    public String getRefreshToken() {
        return refreshToken;
    }

    public void setRefreshToken(String refreshToken) {
        this.refreshToken = refreshToken;
    }

    public Long getAccessTokenExpiresAt() {
        return accessTokenExpiresAt;
    }

    public void setAccessTokenExpiresAt(Long accessTokenExpiresAt) {
        this.accessTokenExpiresAt = accessTokenExpiresAt;
    }

    public Long getRefreshTokenExpiresAt() {
        return refreshTokenExpiresAt;
    }

    public void setRefreshTokenExpiresAt(Long refreshTokenExpiresAt) {
        this.refreshTokenExpiresAt = refreshTokenExpiresAt;
    }
}
