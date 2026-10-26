package com.kiyuziyu.api.service;

import com.kiyuziyu.api.dto.PagedResult;
import com.kiyuziyu.api.dto.shopify.ShopifyBulkSyncItem;
import com.kiyuziyu.api.dto.shopify.ShopifyBulkSyncRequest;
import com.kiyuziyu.api.dto.shopify.ShopifyBulkSyncResponse;
import com.kiyuziyu.api.exception.BadRequestException;
import com.kiyuziyu.api.integration.shopify.ShopifyDuplicateConflictException;
import com.kiyuziyu.api.integration.shopify.ShopifyGraphQLClient;
import com.kiyuziyu.api.model.ClientProductOverride;
import com.kiyuziyu.api.model.Product;
import com.kiyuziyu.api.repository.ClientProductOverrideRepository;
import com.kiyuziyu.api.repository.ProductRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class ShopifyBulkProductSyncService {

    private static final Logger log = LoggerFactory.getLogger(ShopifyBulkProductSyncService.class);

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private ClientProductOverrideRepository overrideRepository;

    @Autowired
    private ShopifyGraphQLClient shopifyGraphQLClient;

    public ShopifyBulkSyncResponse syncProductsBulk(ShopifyBulkSyncRequest request) {
        return syncProductsBulk(null, request);
    }

    public ShopifyBulkSyncResponse syncProductsBulk(String clientId, ShopifyBulkSyncRequest request) {
        log.info("[ShopifyBulkProductSyncService] SHOPIFY SYNC START. ClientId: {}, Page: {}, Limit: {}", clientId, request.getPage(), request.getLimit());

        if (clientId == null || clientId.trim().isEmpty()) {
            throw new BadRequestException("Client ID is required for Shopify bulk sync.");
        }

        if (request.getLimit() > 50) {
            throw new BadRequestException("Safety Limit Exceeded: Maximum limit for bulk sync is 50 products per request.");
        }
        
        if (request.getLimit() <= 0 || request.getPage() <= 0) {
            throw new BadRequestException("Page and Limit must be positive integers.");
        }

        int offset = (request.getPage() - 1) * request.getLimit();

        PagedResult<Product> pagedResult;
        try {
            pagedResult = productRepository.findAllProducts(request.getLimit(), offset);
        } catch (Exception e) {
            log.error("[ShopifyBulkProductSyncService] Failed to fetch products from repository", e);
            throw new RuntimeException("Failed to fetch products for bulk sync: " + e.getMessage(), e);
        }

        List<Product> products = pagedResult.getData();
        if (products == null || products.isEmpty()) {
            log.info("[ShopifyBulkProductSyncService] No products found for page {}", request.getPage());
            return buildResponse(request, 0, 0, 0, 0, 0, 0, new ArrayList<>(), "No products found to sync");
        }

        int created = 0;
        int alreadyExists = 0;
        int updated = 0;
        int conflict = 0;
        int failed = 0;
        List<ShopifyBulkSyncItem> results = new ArrayList<>();

        for (Product product : products) {
            String productCode = product.getProductCode();
            String productId = product.getId();
            log.info("[ShopifyBulkProductSyncService] Processing product: ID='{}', productCode='{}' for clientId='{}'", productId, productCode, clientId);

            if (productId == null || productId.trim().isEmpty()) {
                log.warn("[ShopifyBulkProductSyncService] Skipping product with no Firestore document ID (productCode: {})", productCode);
                results.add(new ShopifyBulkSyncItem(productCode != null ? productCode : "UNKNOWN", null, "FAILED", null, "Product missing Firestore document ID (productId)"));
                failed++;
                continue;
            }

            if (productCode == null || productCode.trim().isEmpty()) {
                log.warn("[ShopifyBulkProductSyncService] Skipping product with no productCode (ID: {})", productId);
                results.add(new ShopifyBulkSyncItem("UNKNOWN", productId, "FAILED", null, "Product missing productCode"));
                failed++;
                continue;
            }

            try {
                // Validation
                if (product.getProductName() == null || product.getProductName().trim().isEmpty()) {
                    throw new Exception("Product has no name (productName is missing)");
                }

                // Pricing Resolution and Validation: default to basePrice
                Double basePrice = product.getBasePrice();
                if (basePrice == null || basePrice <= 0) {
                    throw new Exception("Firebase product has missing or invalid basePrice.");
                }

                Double customerPrice = basePrice;
                ClientProductOverride override = null;
                if (clientId != null && !clientId.trim().isEmpty()) {
                    try {
                        override = overrideRepository.findByClientAndProduct(clientId, productId);
                        if (override == null && productCode != null) {
                            override = overrideRepository.findByClientAndProduct(clientId, productCode);
                        }
                    } catch (Exception e) {
                        log.warn("[ShopifyBulkProductSyncService] Failed to query ClientProductOverride for productId={}: {}. Falling back to basePrice.",
                                productId, e.getMessage());
                        override = null;
                    }
                }

                if (override != null && override.getSellingPrice() != null) {
                    Double sellingPrice = override.getSellingPrice();
                    if (sellingPrice < basePrice) {
                        throw new Exception("Client selling price cannot be lower than Kiyuziyu base price.");
                    }
                    if (sellingPrice > 0) {
                        customerPrice = sellingPrice;
                    }
                }

                // Extract collectionTitle from collectionData
                String collectionTitle = null;
                if (product.getCollectionData() != null) {
                    Object titleObj = product.getCollectionData().get("title");
                    if (titleObj == null) {
                        titleObj = product.getCollectionData().get("name");
                    }
                    if (titleObj != null && !titleObj.toString().trim().isEmpty()) {
                        collectionTitle = titleObj.toString().trim();
                    }
                }

                // Extract subcollectionName from subcollectionData
                String subcollectionName = null;
                if (product.getSubcollectionData() != null) {
                    Object nameObj = product.getSubcollectionData().get("name");
                    if (nameObj == null) {
                        nameObj = product.getSubcollectionData().get("title");
                    }
                    if (nameObj != null && !nameObj.toString().trim().isEmpty()) {
                        subcollectionName = nameObj.toString().trim();
                    }
                }

                // Product Type per Requirement 4:
                // Shopify Product Type = collectionData.title
                // If collectionData.title is missing: Shopify Product Type = subcollectionData.name
                // If both are missing: leave Product Type empty (null)
                String productType = null;
                if (collectionTitle != null && !collectionTitle.isEmpty()) {
                    productType = collectionTitle;
                } else if (subcollectionName != null && !subcollectionName.isEmpty()) {
                    productType = subcollectionName;
                }

                String descriptionHtml = product.getDescription() != null ? "<p>" + product.getDescription() + "</p>" : "";

                // Duplicate Check — strictly using kiyuziyu.product_id
                String existingShopifyProductId = shopifyGraphQLClient.findProductIdByFirebaseId(productId);

                if (existingShopifyProductId != null) {
                    log.info("[ShopifyBulkProductSyncService] SHOPIFY PRODUCT ALREADY EXISTS: Product ID='{}' (code='{}') in Shopify as {}. Updating existing product...",
                            productId, productCode, existingShopifyProductId);

                    String resolvedTitle = ShopifyProductService.resolveProductTitle(product);

                    shopifyGraphQLClient.updateProduct(
                            existingShopifyProductId,
                            resolvedTitle,
                            descriptionHtml,
                            productCode,
                            productId,
                            basePrice,
                            customerPrice,
                            product.getImage(),
                            product.getImages(),
                            product.getTags(),
                            productType,
                            product.getVariations(),
                            subcollectionName,
                            product.getQuantity()
                    );

                    log.info("[ShopifyBulkProductSyncService] SHOPIFY PRODUCT UPDATED: {}", existingShopifyProductId);
                    results.add(new ShopifyBulkSyncItem(productCode, productId, "ALREADY_EXISTS", existingShopifyProductId, null));
                    alreadyExists++;
                    updated++;
                    continue;
                }

                // Creation with full product details
                String resolvedTitle = ShopifyProductService.resolveProductTitle(product);
                java.util.Map<String, String> createResult = shopifyGraphQLClient.createProduct(
                        resolvedTitle,
                        descriptionHtml,
                        productCode,
                        productId,
                        basePrice,
                        customerPrice,
                        product.getImage(),
                        product.getImages(),
                        product.getTags(),
                        productType,
                        product.getVariations(),
                        subcollectionName,
                        product.getQuantity()
                );

                String shopifyProductId = createResult.get("productId");
                String shopifyVariantId = createResult.get("variantId");

                // Update Price to customerPrice if variant exists
                if (shopifyVariantId != null && !shopifyVariantId.trim().isEmpty()) {
                    shopifyGraphQLClient.updateVariantDetails(shopifyProductId, shopifyVariantId, customerPrice, productCode);
                }

                log.info("[ShopifyBulkProductSyncService] SHOPIFY PRODUCT CREATED: ID='{}' (code='{}'). Shopify ID: {}", productId, productCode, shopifyProductId);
                results.add(new ShopifyBulkSyncItem(productCode, productId, "CREATED", shopifyProductId, null));
                created++;

            } catch (ShopifyDuplicateConflictException e) {
                log.error("[ShopifyBulkProductSyncService] SHOPIFY PRODUCT CONFLICT for productId: '{}' (code: '{}'). {}", productId, productCode, e.getMessage());
                results.add(new ShopifyBulkSyncItem(productCode, productId, "CONFLICT", null,
                        "Multiple Shopify products found with the same kiyuziyu.product_id metafield. " +
                        "Manual cleanup required in Shopify admin. Conflicting IDs: " + e.getConflictingShopifyIds()));
                conflict++;

            } catch (Exception e) {
                String errorMsg = e.getMessage();
                if (errorMsg != null && (errorMsg.contains("trial") || errorMsg.contains("Select a plan to upload this file"))) {
                    log.warn("[ShopifyBulkProductSyncService] SHOPIFY MEDIA FAILED for product ID='{}' (code='{}'): {}", productId, productCode, errorMsg);
                } else {
                    log.error("[ShopifyBulkProductSyncService] Failed to sync product ID: '{}' (code: '{}'). Reason: {}", productId, productCode, errorMsg, e);
                }
                results.add(new ShopifyBulkSyncItem(productCode, productId, "FAILED", null, errorMsg));
                failed++;
            }
        }

        log.info("[ShopifyBulkProductSyncService] SHOPIFY SYNC COMPLETED: totalProcessed={}, created={}, alreadyExists={}, updated={}, conflict={}, failed={}",
                products.size(), created, alreadyExists, updated, conflict, failed);

        return buildResponse(request, products.size(), created, alreadyExists, updated, conflict, failed, results, "Shopify product batch sync completed");
    }

    private ShopifyBulkSyncResponse buildResponse(ShopifyBulkSyncRequest req, int total, int created, int exists, int updated, int conflict, int failed, List<ShopifyBulkSyncItem> items, String msg) {
        ShopifyBulkSyncResponse res = new ShopifyBulkSyncResponse();
        res.setSuccess(true);
        res.setMessage(msg);
        res.setPage(req.getPage());
        res.setLimit(req.getLimit());
        res.setTotalProcessed(total);
        res.setCreated(created);
        res.setAlreadyExists(exists);
        res.setUpdated(updated);
        res.setConflict(conflict);
        res.setFailed(failed);
        res.setResults(items);
        return res;
    }
}
