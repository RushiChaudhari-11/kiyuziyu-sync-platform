package com.kiyuziyu.api.service;

import com.kiyuziyu.api.dto.shopify.ShopifyProductSyncResponse;
import com.kiyuziyu.api.exception.BadRequestException;
import com.kiyuziyu.api.exception.NotFoundException;
import com.kiyuziyu.api.integration.shopify.ShopifyDuplicateConflictException;
import com.kiyuziyu.api.integration.shopify.ShopifyGraphQLClient;
import com.kiyuziyu.api.model.Product;
import com.kiyuziyu.api.model.ClientProductOverride;
import com.kiyuziyu.api.repository.ClientProductOverrideRepository;
import com.kiyuziyu.api.repository.ProductRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutionException;

@Service
public class ShopifyProductService {

    private static final Logger log = LoggerFactory.getLogger(ShopifyProductService.class);

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private ClientProductOverrideRepository overrideRepository;

    @Autowired
    private ShopifyGraphQLClient shopifyGraphQLClient;

    public ShopifyProductSyncResponse syncProductToShopify(String productCode) throws ExecutionException, InterruptedException {
        return syncProductToShopify(null, productCode, null);
    }

    public ShopifyProductSyncResponse syncProductToShopify(String clientId, String productCode) throws ExecutionException, InterruptedException {
        return syncProductToShopify(clientId, productCode, null);
    }

    public ShopifyProductSyncResponse syncProductToShopify(String clientId, String productCode, String documentId) throws ExecutionException, InterruptedException {
        log.info("[ShopifyProductService] SHOPIFY SYNC START for productCode: {} documentId: {} (clientId: {})", productCode, documentId, clientId);

        if (clientId == null || clientId.trim().isEmpty()) {
            throw new BadRequestException("Client ID is required for Shopify sync.");
        }

        if ((productCode == null || productCode.trim().isEmpty()) && (documentId == null || documentId.trim().isEmpty())) {
            throw new BadRequestException("productCode or documentId cannot be null or empty");
        }

        // STEP 1 - Fetch Kiyuziyu Product using documentId first for exact document match
        Product product = null;
        if (documentId != null && !documentId.trim().isEmpty()) {
            product = productRepository.findByDocumentId(documentId.trim());
            if (product == null) {
                product = productRepository.findById(documentId.trim());
            }
        }
        if (product == null && productCode != null && !productCode.trim().isEmpty()) {
            product = productRepository.findById(productCode.trim());
        }
        if (product == null) {
            throw new NotFoundException("Product not found with code: " + productCode);
        }

        return syncProduct(clientId, product);
    }

    public ShopifyProductSyncResponse syncProduct(String clientId, Product product) throws ExecutionException, InterruptedException {
        return syncProduct(clientId, product, null);
    }

    public ShopifyProductSyncResponse syncProduct(String clientId, Product product, String knownShopifyProductId) throws ExecutionException, InterruptedException {
        if (clientId == null || clientId.trim().isEmpty()) {
            throw new BadRequestException("Client ID is required for Shopify sync.");
        }
        if (product == null) {
            throw new BadRequestException("Product cannot be null");
        }

        String productCode = product.getProductCode();
        String productId = product.getId();
        log.info("[ShopifyProductService] SHOPIFY SYNC START for product: {} (code: {}, ID: {}, clientId: {})",
                product.getProductName(), productCode, productId, clientId);

        if (productId == null || productId.trim().isEmpty()) {
            throw new BadRequestException("Product has no unique Firestore document ID (productId is missing)");
        }

        // STEP 2 - Validate product
        if (product.getProductName() == null || product.getProductName().trim().isEmpty()) {
            throw new BadRequestException("Product has no name (productName is missing)");
        }

        // STEP 3 - Pricing Resolution and Validation
        Double basePrice = product.getBasePrice();
        if (basePrice == null || basePrice <= 0) {
            // Check subcollection tieredPricing
            if (product.getSubcollectionData() != null && product.getSubcollectionData().containsKey("tieredPricing")) {
                Object tpObj = product.getSubcollectionData().get("tieredPricing");
                if (tpObj instanceof Map tp) {
                    for (String roleKey : new String[]{"retail", "dropshipping", "wholesale", "dealer", "vip", "distributor"}) {
                        Object listObj = tp.get(roleKey);
                        if (listObj instanceof List list && !list.isEmpty()) {
                            Object first = list.get(0);
                            if (first instanceof Map m && m.containsKey("price")) {
                                Object pVal = m.get("price");
                                if (pVal instanceof Number num) basePrice = num.doubleValue();
                                else if (pVal instanceof String s) {
                                    try { basePrice = Double.parseDouble(s); } catch (Exception ignored) {}
                                }
                                if (basePrice != null && basePrice > 0) break;
                            }
                        }
                    }
                }
            }
            // Check variations for price
            if ((basePrice == null || basePrice <= 0) && product.getVariations() != null) {
                for (Map<String, Object> v : product.getVariations()) {
                    Object pVal = v.get("price");
                    if (pVal == null) pVal = v.get("sellingPrice");
                    if (pVal instanceof Number num) basePrice = num.doubleValue();
                    else if (pVal instanceof String s) {
                        try { basePrice = Double.parseDouble(s); } catch (Exception ignored) {}
                    }
                    if (basePrice != null && basePrice > 0) break;
                }
            }
            // Check purchaseRate fallback
            if ((basePrice == null || basePrice <= 0) && product.getEffectivePurchaseRate() != null && product.getEffectivePurchaseRate() > 0) {
                basePrice = product.getEffectivePurchaseRate();
            }
            if (basePrice != null && basePrice > 0) {
                product.setBasePrice(basePrice);
            }
        }

        if (basePrice == null || basePrice <= 0) {
            throw new BadRequestException("Firebase product has missing or invalid basePrice.");
        }

        // Default customer-facing price is basePrice. If ClientProductOverride exists with valid sellingPrice >= basePrice, use it.
        Double customerPrice = basePrice;
        ClientProductOverride override = null;
        if (clientId != null && !clientId.trim().isEmpty()) {
            try {
                override = overrideRepository.findByClientAndProduct(clientId, productId);
                if (override == null && productCode != null) {
                    override = overrideRepository.findByClientAndProduct(clientId, productCode);
                }
            } catch (Exception e) {
                log.warn("[ShopifyProductService] Error querying ClientProductOverride for clientId={}, productId={}: {}. Falling back to basePrice.",
                        clientId, productId, e.getMessage());
                override = null;
            }
        }

        if (override != null && override.getSellingPrice() != null) {
            Double sellingPrice = override.getSellingPrice();
            if (sellingPrice < basePrice) {
                throw new BadRequestException("Client selling price cannot be lower than Kiyuziyu base price.");
            }
            if (sellingPrice > 0) {
                customerPrice = sellingPrice;
            }
        }

        log.info("[ShopifyProductService] Product {} (ID: {}) pricing: basePrice={}, customerPrice={}",
                productCode, productId, basePrice, customerPrice);

        // STEP 4 - Extract collectionTitle, subcollectionName, and productType
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

        // STEP 5 - Duplicate protection & existing product update using kiyuziyu.product_id
        String existingShopifyProductId = knownShopifyProductId;
        if (existingShopifyProductId == null) {
            try {
                existingShopifyProductId = shopifyGraphQLClient.findProductIdByFirebaseId(productId);
            } catch (ShopifyDuplicateConflictException e) {
                log.error("[ShopifyProductService] SHOPIFY PRODUCT CONFLICT for productCode: {} (ID: {}). {}", productCode, productId, e.getMessage());
                Map<String, Object> data = new HashMap<>();
                data.put("productCode", productCode);
                data.put("productId", productId);
                data.put("conflictingShopifyIds", e.getConflictingShopifyIds());
                return new ShopifyProductSyncResponse(false,
                        "Conflict detected: multiple Shopify products found with the same kiyuziyu.product_id metafield. " +
                        "Manual cleanup required in Shopify admin. Conflicting IDs: " + e.getConflictingShopifyIds(),
                        false, data);
            }
        }

        String resolvedTitle = resolveProductTitle(product);

        if (existingShopifyProductId != null) {
            log.info("[ShopifyProductService] SHOPIFY PRODUCT ALREADY EXISTS: Product {} (ID: {}) in Shopify as {}. Updating...",
                    productCode, productId, existingShopifyProductId);

            // Compute effective stock for update
            int updateStock = computeEffectiveStock(product);

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
                    updateStock
            );

            log.info("[ShopifyProductService] SHOPIFY PRODUCT UPDATED: {}", existingShopifyProductId);
            log.info("[ShopifyProductService] SHOPIFY SYNC COMPLETED for productCode: {}", productCode);

            Map<String, Object> data = new HashMap<>();
            data.put("productCode", productCode);
            data.put("productId", productId);
            data.put("shopifyProductId", existingShopifyProductId);
            data.put("price", customerPrice);
            data.put("basePrice", basePrice);
            data.put("productType", productType);
            data.put("tags", product.getTags());
            data.put("updated", true);
            
            return new ShopifyProductSyncResponse(true, "Product already exists in Shopify and was updated successfully", true, data);
        }

        // STEP 6 - Compute effective stock
        int effectiveStock = computeEffectiveStock(product);
        log.info("[ShopifyProductService] Product {} effective stock={}", productCode, effectiveStock);

        // STEP 7 - Create Shopify product with full product information
        Map<String, String> createResult = shopifyGraphQLClient.createProduct(
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
                effectiveStock
        );

        String shopifyProductId = createResult.get("productId");
        String shopifyVariantId = createResult.get("variantId");
        
        log.info("[ShopifyProductService] SHOPIFY PRODUCT CREATED: {} and variant: {}", shopifyProductId, shopifyVariantId);

        // STEP 8 - Update variant price and SKU if standalone variant and no multi-variations
        if (shopifyVariantId != null && !shopifyVariantId.trim().isEmpty() && (product.getVariations() == null || product.getVariations().isEmpty())) {
            shopifyGraphQLClient.updateVariantDetails(shopifyProductId, shopifyVariantId, customerPrice);
            log.info("[ShopifyProductService] Updated details for variant {}", shopifyVariantId);
        }

        log.info("[ShopifyProductService] SHOPIFY SYNC COMPLETED for productCode: {}", productCode);

        // STEP 8 - Return Response
        Map<String, Object> data = new HashMap<>();
        data.put("productCode", productCode);
        data.put("productId", productId);
        data.put("productName", product.getProductName());
        data.put("shopifyProductId", shopifyProductId);
        data.put("shopifyVariantId", shopifyVariantId);
        data.put("price", customerPrice);
        data.put("basePrice", basePrice);
        data.put("productType", productType);
        data.put("tags", product.getTags());

        return new ShopifyProductSyncResponse(true, "Product synced to Shopify successfully", false, data);
    }

    private int computeEffectiveStock(Product product) {
        int stock = 0;
        boolean hasQuantity = false;
        if (product.getVariations() != null && !product.getVariations().isEmpty()) {
            for (Map<String, Object> v : product.getVariations()) {
                if (v.containsKey("quantity") && v.get("quantity") != null) {
                    hasQuantity = true;
                    try { stock += Integer.parseInt(v.get("quantity").toString()); } catch (Exception ignored) {}
                }
            }
            if (!hasQuantity) {
                for (Map<String, Object> v : product.getVariations()) {
                    Object iq = v.get("initialQuantity");
                    if (iq != null) {
                        try { stock += Integer.parseInt(iq.toString()); } catch (Exception ignored) {}
                    }
                }
            }
        } else {
            if (product.getQuantity() != null) {
                try { stock = Integer.parseInt(product.getQuantity().toString()); } catch (Exception ignored) {}
            } else if (product.getInitialQuantity() != null) {
                try { stock = Integer.parseInt(product.getInitialQuantity().toString()); } catch (Exception ignored) {}
            }
        }
        return stock;
    }

    /**
     * Dedicated lightweight stock-only synchronization method.
     * Updates Shopify inventory levels without altering prices, descriptions, images, or metadata.
     */
    public boolean syncInventoryOnly(String tenantId, String shopifyProductId, Product product) {
        if (shopifyProductId == null || product == null) {
            log.warn("[ShopifyProductService] Cannot sync inventory: shopifyProductId or product is null");
            return false;
        }

        try {
            String locationId = shopifyGraphQLClient.getActiveLocationId();
            if (locationId == null) {
                log.warn("[ShopifyProductService] Active location ID not found for Shopify store. Skipping inventory sync.");
                return false;
            }

            var variants = shopifyGraphQLClient.getProductVariants(shopifyProductId);
            if (variants == null || variants.isEmpty()) {
                log.warn("[ShopifyProductService] No variants found for Shopify product: {}", shopifyProductId);
                return false;
            }

            List<Map<String, Object>> variations = product.getVariations();
            if (variations != null && !variations.isEmpty()) {
                // Multi-variant product: match each variation to a Shopify variant
                int idx = 1;
                for (Map<String, Object> v : variations) {
                    Object rawQty = v.get("quantity");
                    if (rawQty == null && v.containsKey("initialQuantity")) {
                        rawQty = v.get("initialQuantity");
                    }
                    int qty = ShopifyGraphQLClient.parseQuantity(rawQty);

                    // Build expected option values
                    List<Map<String, String>> optionValues = ShopifyGraphQLClient.buildOptionValues(v, idx);
                    Map<String, Object> matchedVariant = shopifyGraphQLClient.findMatchingVariant(variants, optionValues);

                    if (matchedVariant == null && idx - 1 < variants.size()) {
                        // Positional fallback if options match couldn't be resolved
                        matchedVariant = variants.get(idx - 1);
                    }

                    if (matchedVariant != null) {
                        @SuppressWarnings("unchecked")
                        Map<String, Object> invItem = (Map<String, Object>) matchedVariant.get("inventoryItem");
                        if (invItem != null && invItem.get("id") != null) {
                            String invItemId = (String) invItem.get("id");
                            shopifyGraphQLClient.enableInventoryTracking(invItemId);
                            shopifyGraphQLClient.activateInventoryAtLocation(invItemId, locationId);
                            shopifyGraphQLClient.setInventoryQuantity(invItemId, locationId, qty);
                            log.info("[ShopifyProductService] Inventory updated for variant idx={} (SKU={}-{}): qty={}", idx, product.getProductCode(), idx, qty);
                        }
                    }
                    idx++;
                }
            } else {
                // Standalone product: update the first/single variant
                int qty = computeEffectiveStock(product);
                Map<String, Object> firstVariant = variants.get(0);
                if (firstVariant != null) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> invItem = (Map<String, Object>) firstVariant.get("inventoryItem");
                    if (invItem != null && invItem.get("id") != null) {
                        String invItemId = (String) invItem.get("id");
                        shopifyGraphQLClient.enableInventoryTracking(invItemId);
                        shopifyGraphQLClient.activateInventoryAtLocation(invItemId, locationId);
                        shopifyGraphQLClient.setInventoryQuantity(invItemId, locationId, qty);
                        log.info("[ShopifyProductService] Inventory updated for standalone product {}: qty={}", product.getProductCode(), qty);
                    }
                }
            }
            return true;
        } catch (Exception e) {
            log.error("[ShopifyProductService] Failed to sync inventory for product {}: {}", product.getProductCode(), e.getMessage(), e);
            return false;
        }
    }

    /**
     * Resolves the user-facing product title for Shopify.
     * When a product document has a single distinctive variant (e.g., color or title/name),
     * appends the variant to the title so separate products sharing base name and productCode
     * are clearly distinguished in Shopify (e.g. "M earring - White", "M earring - Green").
     */
    public static String resolveProductTitle(Product product) {
        if (product == null || product.getProductName() == null) {
            return (product != null && product.getProductCode() != null) ? product.getProductCode() : "";
        }
        String baseName = product.getProductName().trim();
        List<Map<String, Object>> variations = product.getVariations();
        if (variations != null && variations.size() == 1) {
            Map<String, Object> singleVar = variations.get(0);
            String color = singleVar.get("color") != null ? singleVar.get("color").toString().trim() : "";
            String size = singleVar.get("size") != null ? singleVar.get("size").toString().trim() : "";
            String name = singleVar.get("name") != null ? singleVar.get("name").toString().trim() : "";
            if (name.isEmpty() && singleVar.get("title") != null) {
                name = singleVar.get("title").toString().trim();
            }

            String varName = null;
            if (!color.isEmpty() && !size.isEmpty()) {
                varName = capitalize(color) + " / " + size;
            } else if (!color.isEmpty()) {
                varName = capitalize(color);
            } else if (!size.isEmpty()) {
                varName = size;
            } else if (!name.isEmpty()) {
                varName = capitalize(name);
            }

            if (varName != null && !varName.isEmpty()) {
                String lowerVar = varName.toLowerCase();
                if (!lowerVar.equals("default") && !lowerVar.equals("default title") && !lowerVar.equals("standard")
                        && !lowerVar.equals("regular") && !lowerVar.equals("none")) {
                    if (!baseName.toLowerCase().contains(lowerVar)) {
                        return baseName + " - " + varName;
                    }
                }
            }
        }
        return baseName;
    }

    private static String capitalize(String str) {
        if (str == null || str.isEmpty()) return str;
        str = str.trim();
        if (str.isEmpty()) return str;
        return Character.toUpperCase(str.charAt(0)) + str.substring(1);
    }
}
