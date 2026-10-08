package com.kiyuziyu.api.dto.ownerproduct;

public class SelectOwnerProductRequest {
    private String productId;

    public SelectOwnerProductRequest() {
    }

    public SelectOwnerProductRequest(String productId) {
        this.productId = productId;
    }

    public String getProductId() {
        return productId;
    }

    public void setProductId(String productId) {
        this.productId = productId;
    }
}
