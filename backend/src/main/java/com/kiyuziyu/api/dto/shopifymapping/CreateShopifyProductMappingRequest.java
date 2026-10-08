package com.kiyuziyu.api.dto.shopifymapping;

public class CreateShopifyProductMappingRequest {

    private String productId;
    private String shopifyProductId;
    private String shopifyProductHandle;

    public CreateShopifyProductMappingRequest() {
    }

    public CreateShopifyProductMappingRequest(String productId, String shopifyProductId) {
        this.productId = productId;
        this.shopifyProductId = shopifyProductId;
    }

    public CreateShopifyProductMappingRequest(String productId, String shopifyProductId, String shopifyProductHandle) {
        this.productId = productId;
        this.shopifyProductId = shopifyProductId;
        this.shopifyProductHandle = shopifyProductHandle;
    }

    public String getProductId() {
        return productId;
    }

    public void setProductId(String productId) {
        this.productId = productId;
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
}
