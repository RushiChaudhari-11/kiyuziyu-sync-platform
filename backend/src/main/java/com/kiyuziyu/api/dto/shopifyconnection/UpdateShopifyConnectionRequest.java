package com.kiyuziyu.api.dto.shopifyconnection;

public class UpdateShopifyConnectionRequest {

    private String status;
    private String shopifyStoreDomain;
    private String shopifyStoreId;

    public UpdateShopifyConnectionRequest() {
    }

    public UpdateShopifyConnectionRequest(String status) {
        this.status = status;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
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
}
