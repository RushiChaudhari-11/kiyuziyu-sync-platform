package com.kiyuziyu.api.dto.shopify;

public class ShopifyBulkSyncItem {
    private String productCode;
    private String productId;
    private String status;
    private String shopifyProductId;
    private String error;

    public ShopifyBulkSyncItem() {}

    public ShopifyBulkSyncItem(String productCode, String status, String shopifyProductId) {
        this(productCode, null, status, shopifyProductId, null);
    }

    public ShopifyBulkSyncItem(String productCode, String status, String shopifyProductId, String error) {
        this(productCode, null, status, shopifyProductId, error);
    }

    public ShopifyBulkSyncItem(String productCode, String productId, String status, String shopifyProductId, String error) {
        this.productCode = productCode;
        this.productId = productId;
        this.status = status;
        this.shopifyProductId = shopifyProductId;
        this.error = error;
    }

    public String getProductCode() {
        return productCode;
    }

    public void setProductCode(String productCode) {
        this.productCode = productCode;
    }

    public String getProductId() {
        return productId;
    }

    public void setProductId(String productId) {
        this.productId = productId;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getShopifyProductId() {
        return shopifyProductId;
    }

    public void setShopifyProductId(String shopifyProductId) {
        this.shopifyProductId = shopifyProductId;
    }

    public String getError() {
        return error;
    }

    public void setError(String error) {
        this.error = error;
    }
}
