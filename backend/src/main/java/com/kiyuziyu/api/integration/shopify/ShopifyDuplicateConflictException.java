package com.kiyuziyu.api.integration.shopify;

import java.util.List;

/**
 * Thrown when multiple Shopify products are found with the same
 * {@code kiyuziyu.product_code} metafield value for a single Kiyuziyu productCode.
 *
 * <p>This indicates a data-integrity problem in Shopify (duplicates already exist there).
 * The caller MUST NOT create another product and MUST NOT arbitrarily select one of the
 * conflicting products. It should surface this as a CONFLICT result and let a human
 * operator resolve it in the Shopify admin.</p>
 */
public class ShopifyDuplicateConflictException extends RuntimeException {

    private final String productCode;
    private final String productId;
    private final List<String> conflictingShopifyIds;

    public ShopifyDuplicateConflictException(String productCode, List<String> conflictingShopifyIds) {
        this(productCode, null, conflictingShopifyIds);
    }

    public ShopifyDuplicateConflictException(String productCode, String productId, List<String> conflictingShopifyIds) {
        super(formatMessage(productCode, productId, conflictingShopifyIds));
        this.productCode = productCode;
        this.productId = productId;
        this.conflictingShopifyIds = conflictingShopifyIds;
    }

    private static String formatMessage(String productCode, String productId, List<String> conflictingShopifyIds) {
        if (productId != null && !productId.trim().isEmpty()) {
            return String.format(
                    "CONFLICT: %d Shopify products found with metafield kiyuziyu.product_id='%s'. " +
                    "Conflicting IDs: %s. Manual cleanup in Shopify admin required.",
                    conflictingShopifyIds.size(), productId, conflictingShopifyIds);
        } else {
            return String.format(
                    "CONFLICT: %d Shopify products found with metafield kiyuziyu.product_code='%s'. " +
                    "Conflicting IDs: %s. Manual cleanup in Shopify admin required.",
                    conflictingShopifyIds.size(), productCode, conflictingShopifyIds);
        }
    }

    public String getProductCode() {
        return productCode;
    }

    public String getProductId() {
        return productId;
    }

    public List<String> getConflictingShopifyIds() {
        return conflictingShopifyIds;
    }
}
