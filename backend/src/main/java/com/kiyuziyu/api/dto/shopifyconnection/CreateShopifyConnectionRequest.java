package com.kiyuziyu.api.dto.shopifyconnection;

public class CreateShopifyConnectionRequest {

    private String shopifyStoreDomain;
    private String shopifyStoreId;


    public CreateShopifyConnectionRequest() {
    }

    public CreateShopifyConnectionRequest(String shopifyStoreDomain) {
        this.shopifyStoreDomain = shopifyStoreDomain;
    }

    public CreateShopifyConnectionRequest(String shopifyStoreDomain, String shopifyStoreId) {
        this.shopifyStoreDomain = shopifyStoreDomain;
        this.shopifyStoreId = shopifyStoreId;
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
