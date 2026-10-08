package com.kiyuziyu.api.integration.shopify;

public class ShopifyContextHolder {
    private static final ThreadLocal<ShopifyContext> contextHolder = new ThreadLocal<>();

    public static void setContext(String storeDomain) {
        contextHolder.set(new ShopifyContext(storeDomain));
    }

    public static ShopifyContext getContext() {
        return contextHolder.get();
    }

    public static void clearContext() {
        contextHolder.remove();
    }

    public static class ShopifyContext {
        private final String storeDomain;

        public ShopifyContext(String storeDomain) {
            this.storeDomain = storeDomain;
        }

        public String getStoreDomain() {
            return storeDomain;
        }
    }
}
