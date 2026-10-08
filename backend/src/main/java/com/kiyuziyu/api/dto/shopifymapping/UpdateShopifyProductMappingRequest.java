package com.kiyuziyu.api.dto.shopifymapping;

public class UpdateShopifyProductMappingRequest {

    private String shopifyProductId;
    private String shopifyProductHandle;
    private String status;

    public UpdateShopifyProductMappingRequest() {
    }

    public UpdateShopifyProductMappingRequest(String status) {
        this.status = status;
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
}
