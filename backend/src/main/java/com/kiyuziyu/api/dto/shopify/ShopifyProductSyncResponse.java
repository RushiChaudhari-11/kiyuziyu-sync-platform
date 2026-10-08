package com.kiyuziyu.api.dto.shopify;

import java.util.Map;

public class ShopifyProductSyncResponse {
    private boolean success;
    private String message;
    private boolean alreadyExists;
    private Map<String, Object> data;

    public ShopifyProductSyncResponse() {}

    public ShopifyProductSyncResponse(boolean success, String message, boolean alreadyExists, Map<String, Object> data) {
        this.success = success;
        this.message = message;
        this.alreadyExists = alreadyExists;
        this.data = data;
    }

    public boolean isSuccess() {
        return success;
    }

    public void setSuccess(boolean success) {
        this.success = success;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public boolean isAlreadyExists() {
        return alreadyExists;
    }

    public void setAlreadyExists(boolean alreadyExists) {
        this.alreadyExists = alreadyExists;
    }

    public Map<String, Object> getData() {
        return data;
    }

    public void setData(Map<String, Object> data) {
        this.data = data;
    }
}
