package com.kiyuziyu.api.integration.shopify;

public class ShopifyGraphQLException extends RuntimeException {
    
    private final String storeDomain;

    public ShopifyGraphQLException(String message, String storeDomain) {
        super(message);
        this.storeDomain = storeDomain;
    }

    public ShopifyGraphQLException(String message, Throwable cause, String storeDomain) {
        super(message, cause);
        this.storeDomain = storeDomain;
    }

    public String getStoreDomain() {
        return storeDomain;
    }
}
