package com.kiyuziyu.api.dto.syncjob;

import java.util.List;

public class CreateProductSyncJobRequest {

    private List<String> productIds;

    public CreateProductSyncJobRequest() {
    }

    public CreateProductSyncJobRequest(List<String> productIds) {
        this.productIds = productIds;
    }

    public List<String> getProductIds() {
        return productIds;
    }

    public void setProductIds(List<String> productIds) {
        this.productIds = productIds;
    }
}
