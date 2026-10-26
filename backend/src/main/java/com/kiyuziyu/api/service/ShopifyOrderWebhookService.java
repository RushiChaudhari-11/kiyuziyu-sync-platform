package com.kiyuziyu.api.service;

import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.Query;
import com.google.cloud.firestore.QueryDocumentSnapshot;
import com.kiyuziyu.api.model.Product;
import com.kiyuziyu.api.model.TenantOrder;
import com.kiyuziyu.api.model.TenantOrderItem;
import com.kiyuziyu.api.repository.ProductRepository;
import com.kiyuziyu.api.repository.TenantOrderRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class ShopifyOrderWebhookService {

    private static final Logger log = LoggerFactory.getLogger(ShopifyOrderWebhookService.class);

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private TenantOrderRepository tenantOrderRepository;

    @Autowired
    private com.kiyuziyu.api.repository.ShopifyConnectionRepository shopifyConnectionRepository;

    @Autowired(required = false)
    private com.kiyuziyu.api.repository.ShopifyProductMappingRepository shopifyProductMappingRepository;

    @Autowired(required = false)
    private com.kiyuziyu.api.integration.shopify.ShopifyGraphQLClient shopifyGraphQLClient;

    @Autowired
    private Firestore firestore;

    public void processOrderWebhook(String tenantId, Map<String, Object> payload) {
        processOrderWebhook(tenantId, null, payload);
    }

    public void processOrderWebhook(String tenantId, String shopDomain, Map<String, Object> payload) {
        try {
            String shopifyOrderId = String.valueOf(payload.get("id"));
            String orderNumber = String.valueOf(payload.get("order_number"));
            
            String resolvedTenantId = tenantId;
            String resolvedStoreId = null;
            com.kiyuziyu.api.model.ShopifyConnection conn = null;
            if (shopDomain != null && !shopDomain.trim().isEmpty()) {
                conn = shopifyConnectionRepository.findByShopifyStoreDomain(shopDomain.trim());
                if (conn != null) {
                    if (resolvedTenantId == null || resolvedTenantId.trim().isEmpty()) {
                        resolvedTenantId = conn.getTenantId();
                    }
                    resolvedStoreId = conn.getStoreId();
                    com.kiyuziyu.api.integration.shopify.ShopifyContextHolder.setContext(shopDomain.trim());
                }
            }
            if (resolvedTenantId == null || resolvedTenantId.trim().isEmpty()) {
                resolvedTenantId = tenantId != null ? tenantId : "default";
            }
            
            ExtractedOrderDetails details = extractOrderDetails(payload);

            List<Map<String, Object>> lineItems = (List<Map<String, Object>>) payload.get("line_items");
            if (lineItems == null || lineItems.isEmpty()) {
                log.info("[ShopifyOrderWebhook] No line items in order.");
                return;
            }

            // Check if order already exists in Firestore
            com.google.cloud.firestore.QuerySnapshot existingSnap = firestore.collection(TenantOrderRepository.COLLECTION_NAME)
                    .whereEqualTo("shopifyOrderId", shopifyOrderId)
                    .limit(1)
                    .get()
                    .get();

            boolean isRepairingExisting = false;
            com.google.cloud.firestore.DocumentSnapshot existingDoc = null;
            List<Map<String, Object>> alreadyStoredItems = null;

            if (!existingSnap.isEmpty()) {
                existingDoc = existingSnap.getDocuments().get(0);
                boolean hasItemsField = false;
                try {
                    hasItemsField = existingDoc.contains("items");
                } catch (Exception ignored) {}

                int storedCount = 0;
                if (hasItemsField) {
                    Object rawExistingItems = existingDoc.get("items");
                    if (rawExistingItems instanceof List) {
                        alreadyStoredItems = (List<Map<String, Object>>) rawExistingItems;
                        storedCount = alreadyStoredItems.size();
                    }
                }

                if (!hasItemsField || storedCount >= lineItems.size()) {
                    log.info("[ShopifyOrderWebhook] Order #{} (shopifyOrderId={}) already exists with complete items ({}). Updating customer/order fields...",
                            orderNumber, shopifyOrderId, storedCount);
                    Map<String, Object> updates = new java.util.HashMap<>();
                    if (isMeaningful(details.customerName)) updates.put("customerName", details.customerName);
                    if (isMeaningful(details.customerEmail)) updates.put("customerEmail", details.customerEmail);
                    if (isMeaningful(details.customerPhone)) updates.put("customerPhone", details.customerPhone);
                    if (isMeaningful(details.shippingAddressStr)) updates.put("shippingAddress", details.shippingAddressStr);
                    if (isMeaningful(details.billingAddressStr)) updates.put("billingAddress", details.billingAddressStr);
                    if (isMeaningful(details.currency)) updates.put("currency", details.currency);
                    if (isMeaningful(details.paymentMethod)) updates.put("paymentMethod", details.paymentMethod);
                    if (isMeaningful(details.shippingMethod)) updates.put("shippingMethod", details.shippingMethod);
                    if (isMeaningful(details.customerNote)) updates.put("customerNote", details.customerNote);

                    String financialStatus = payload.get("financial_status") != null ? String.valueOf(payload.get("financial_status")) : "";
                    if ("paid".equalsIgnoreCase(financialStatus)) {
                        updates.put("status", "Payment Done");
                    }

                    if (!updates.isEmpty()) {
                        updates.put("updatedAt", Instant.now().toString());
                        existingDoc.getReference().update(updates).get();
                        log.info("[ShopifyOrderWebhook] Successfully updated customer details on existing doc: {}", existingDoc.getId());
                    }
                    return;
                }

                log.warn("[ShopifyOrderWebhook] Order #{} (shopifyOrderId={}) exists but only has {} items, while incoming Shopify order has {} items. Repairing order and deducting missing inventory...",
                        orderNumber, shopifyOrderId, storedCount, lineItems.size());
                isRepairingExisting = true;
            }
            
            if (!tenantOrderRepository.acquireLock(resolvedTenantId, shopifyOrderId)) {
                log.info("[ShopifyOrderWebhook] Order #{} for tenant {} is currently being processed by another thread, skipping...", orderNumber, resolvedTenantId);
                return;
            }
            
            String internalOrderId = isRepairingExisting && existingDoc != null ? existingDoc.getId() : ("order_" + resolvedTenantId + "_" + shopifyOrderId);
            
            log.info("[ShopifyOrderWebhook] Processing order #{} for tenant {} (isRepairing={})", orderNumber, resolvedTenantId, isRepairingExisting);

            String customerName = details.customerName;
            String customerEmail = details.customerEmail;
            String customerPhone = details.customerPhone;
            String shippingAddressStr = details.shippingAddressStr;
            String billingAddressStr = details.billingAddressStr;
            String customerNoteStr = details.customerNote;
            String paymentMethodStr = details.paymentMethod;
            String shippingMethodStr = details.shippingMethod;

            List<TenantOrderItem> kiyuziyuItems = new ArrayList<>();
            double totalBase = 0.0;
            double totalSelling = 0.0;
            double totalPurchase = 0.0;
            double totalAdminProfitAmount = 0.0;

            Map<String, Product> productCache = new java.util.HashMap<>();
            Map<String, Boolean> productUpdated = new java.util.HashMap<>();
            boolean hasInvalidQuantity = false;
            boolean hasInvalidVariantSku = false;
            int recognizedCount = 0;

            // Phase 1: Validate all recognized line items first without mutating inventory
            List<ValidatedLineItem> validatedItems = new java.util.ArrayList<>();

            for (Map<String, Object> item : lineItems) {
                String sku = item.get("sku") != null ? String.valueOf(item.get("sku")).trim() : "";
                String shopifyProductId = item.get("product_id") != null ? String.valueOf(item.get("product_id")).trim() : "";
                if (shopifyProductId.contains("/")) {
                    shopifyProductId = shopifyProductId.substring(shopifyProductId.lastIndexOf('/') + 1);
                }
                String shopifyVariantId = item.get("variant_id") != null ? String.valueOf(item.get("variant_id")).trim() : "";
                if (shopifyVariantId.contains("/")) {
                    shopifyVariantId = shopifyVariantId.substring(shopifyVariantId.lastIndexOf('/') + 1);
                }
                String itemTitle = item.get("title") != null ? String.valueOf(item.get("title")).trim() : "";
                String variantTitle = item.get("variant_title") != null ? String.valueOf(item.get("variant_title")).trim() : "";

                Product kiyuziyuProduct = null;
                String productCode = null;

                // 1. Try resolving via ShopifyProductMapping using shopifyProductId
                if (shopifyProductMappingRepository != null && !shopifyProductId.isEmpty()) {
                    try {
                        com.kiyuziyu.api.model.ShopifyProductMapping mapping = shopifyProductMappingRepository.findByShopifyProductId(shopifyProductId);
                        if (mapping == null) {
                            mapping = shopifyProductMappingRepository.findByShopifyProductId("gid://shopify/Product/" + shopifyProductId);
                        }
                        if (mapping == null && resolvedTenantId != null && resolvedStoreId != null) {
                            mapping = shopifyProductMappingRepository.findByStoreAndShopifyProductId(resolvedTenantId, resolvedStoreId, shopifyProductId);
                            if (mapping == null) {
                                mapping = shopifyProductMappingRepository.findByStoreAndShopifyProductId(resolvedTenantId, resolvedStoreId, "gid://shopify/Product/" + shopifyProductId);
                            }
                        }
                        if (mapping != null && mapping.getProductId() != null) {
                            String mDocId = mapping.getProductId().trim();
                            kiyuziyuProduct = productCache.get(mDocId);
                            if (kiyuziyuProduct == null) {
                                kiyuziyuProduct = productRepository.findByDocumentId(mDocId);
                            }
                            if (kiyuziyuProduct == null) {
                                kiyuziyuProduct = productRepository.findById(mDocId);
                            }
                            if (kiyuziyuProduct != null) {
                                productCode = kiyuziyuProduct.getProductCode();
                            }
                        }
                    } catch (Exception ex) {
                        log.debug("[ShopifyOrderWebhook] Mapping lookup by shopifyProductId {} failed: {}", shopifyProductId, ex.getMessage());
                    }
                }

                // 1B. Try resolving directly from Shopify GraphQL via metafield / tags if mapping not found
                if (kiyuziyuProduct == null && shopifyGraphQLClient != null && !shopifyProductId.isEmpty()) {
                    try {
                        Map<String, String> sMeta = shopifyGraphQLClient.getFirebaseProductDetailsFromShopify(shopifyProductId);
                        if (sMeta != null) {
                            String sDocId = sMeta.get("productId");
                            String sCode = sMeta.get("productCode");
                            if (sDocId != null && !sDocId.isEmpty()) {
                                kiyuziyuProduct = productCache.get(sDocId);
                                if (kiyuziyuProduct == null) {
                                    kiyuziyuProduct = productRepository.findByDocumentId(sDocId);
                                }
                                if (kiyuziyuProduct == null) {
                                    kiyuziyuProduct = productRepository.findById(sDocId);
                                }
                            }
                            if (kiyuziyuProduct == null && sCode != null && !sCode.isEmpty()) {
                                kiyuziyuProduct = productCache.get(sCode);
                                if (kiyuziyuProduct == null) {
                                    kiyuziyuProduct = productRepository.findById(sCode);
                                }
                            }
                            if (kiyuziyuProduct != null) {
                                productCode = sCode != null ? sCode : kiyuziyuProduct.getProductCode();
                                // Cache and save mapping for future fast path
                                if (shopifyProductMappingRepository != null && resolvedTenantId != null && resolvedStoreId != null) {
                                    try {
                                        com.kiyuziyu.api.model.ShopifyProductMapping m = new com.kiyuziyu.api.model.ShopifyProductMapping(
                                                "map_" + resolvedStoreId + "_" + shopifyProductId,
                                                resolvedTenantId,
                                                resolvedStoreId,
                                                conn != null ? conn.getConnectionId() : "conn_" + resolvedStoreId,
                                                kiyuziyuProduct.getId(),
                                                productCode,
                                                "gid://shopify/Product/" + shopifyProductId,
                                                null,
                                                "MAPPED",
                                                Instant.now().toString(),
                                                Instant.now().toString()
                                        );
                                        shopifyProductMappingRepository.save(m);
                                    } catch (Exception ignored) {}
                                }
                            }
                        }
                    } catch (Exception ex) {
                        log.debug("[ShopifyOrderWebhook] Shopify GraphQL product metadata lookup failed for {}: {}", shopifyProductId, ex.getMessage());
                    }
                }

                // 2. Try resolving via candidate codes from SKU (checking mappings and master products)
                if (kiyuziyuProduct == null && !sku.isEmpty()) {
                    List<String> candidates = new ArrayList<>();
                    candidates.add(sku.trim());
                    com.kiyuziyu.api.util.ShopifySkuParser.SkuParseResult parsedSku = com.kiyuziyu.api.util.ShopifySkuParser.parse(sku);
                    if (parsedSku.hasVariantSuffix() && !parsedSku.getBaseProductCode().isEmpty()) {
                        candidates.add(parsedSku.getBaseProductCode());
                        String normBase = com.kiyuziyu.api.util.ShopifySkuParser.normalize(parsedSku.getBaseProductCode());
                        if (!candidates.contains(normBase)) candidates.add(normBase);
                    }

                    for (String candidate : candidates) {
                        // 2A. Fast mapping check by candidate code or SKU
                        if (shopifyProductMappingRepository != null) {
                            try {
                                com.kiyuziyu.api.model.ShopifyProductMapping m = shopifyProductMappingRepository.findBySkuOrProductCode(candidate);
                                if (m != null && m.getProductId() != null) {
                                    String mDocId = m.getProductId().trim();
                                    kiyuziyuProduct = productCache.get(mDocId);
                                    if (kiyuziyuProduct == null) {
                                        kiyuziyuProduct = productRepository.findByDocumentId(mDocId);
                                    }
                                    if (kiyuziyuProduct != null) {
                                        productCode = kiyuziyuProduct.getProductCode() != null ? kiyuziyuProduct.getProductCode() : m.getProductCode();
                                        break;
                                    }
                                }
                            } catch (Exception ignored) {}
                        }

                        // 2B. Direct product cache / repo check
                        kiyuziyuProduct = productCache.get(candidate);
                        if (kiyuziyuProduct == null) {
                            try { kiyuziyuProduct = productRepository.findByDocumentId(candidate); } catch (Exception ignored) {}
                        }
                        if (kiyuziyuProduct == null) {
                            try { kiyuziyuProduct = productRepository.findById(candidate); } catch (Exception ignored) {}
                        }
                        if (kiyuziyuProduct != null) {
                            productCode = kiyuziyuProduct.getProductCode() != null ? kiyuziyuProduct.getProductCode() : candidate;
                            break;
                        }
                    }
                }

                // 3. Try resolving via itemTitle if still null
                if (kiyuziyuProduct == null && !itemTitle.isEmpty()) {
                    List<String> titleCandidates = new ArrayList<>();
                    titleCandidates.add(itemTitle.trim());
                    String lowerTitle = itemTitle.toLowerCase().trim();
                    if (lowerTitle.startsWith("kiyu ziyu ")) {
                        titleCandidates.add(itemTitle.substring(10).trim());
                    } else if (lowerTitle.startsWith("kiyuziyu ")) {
                        titleCandidates.add(itemTitle.substring(9).trim());
                    }

                    for (String tc : titleCandidates) {
                        try {
                            kiyuziyuProduct = productRepository.findById(tc);
                            if (kiyuziyuProduct != null) {
                                productCode = kiyuziyuProduct.getProductCode();
                                break;
                            }
                        } catch (Exception ignored) {}
                    }
                }

                boolean isRecognized = (kiyuziyuProduct != null);
                if (isRecognized) {
                    recognizedCount++;
                }

                // 4. Fallback product representation so that no Shopify line item is EVER dropped from the order
                if (kiyuziyuProduct == null) {
                    log.info("[ShopifyOrderWebhook] Line item (SKU: '{}', shopifyProductId: '{}', title: '{}', variant: '{}') not matched in master catalog. Retaining in order as standalone line item.",
                            sku, shopifyProductId, itemTitle, variantTitle);
                    kiyuziyuProduct = new Product();
                    kiyuziyuProduct.setId("shopify_" + (!shopifyProductId.isEmpty() ? shopifyProductId : UUID.randomUUID().toString().replace("-", "")));
                    kiyuziyuProduct.setProductName(!itemTitle.isEmpty() ? itemTitle : "Product");
                    kiyuziyuProduct.setProductCode(!sku.isEmpty() ? sku : (!shopifyProductId.isEmpty() ? shopifyProductId : "ITEM"));
                    try {
                        kiyuziyuProduct.setBasePrice(Double.parseDouble(String.valueOf(item.get("price"))));
                    } catch (Exception ignored) {
                        kiyuziyuProduct.setBasePrice(0.0);
                    }
                    kiyuziyuProduct.setPurchaseRate(0.0);
                    productCode = kiyuziyuProduct.getProductCode();
                }

                // Ensure productCode is populated
                if (productCode == null || productCode.isEmpty()) {
                    productCode = kiyuziyuProduct.getProductCode() != null ? kiyuziyuProduct.getProductCode() : kiyuziyuProduct.getId();
                }

                // Unique product cache key (documentId first, fallback to productCode)
                String prodKey = (kiyuziyuProduct.getId() != null && !kiyuziyuProduct.getId().trim().isEmpty())
                        ? kiyuziyuProduct.getId().trim()
                        : productCode;

                if (productCache.containsKey(prodKey)) {
                    kiyuziyuProduct = productCache.get(prodKey);
                } else {
                    productCache.put(prodKey, kiyuziyuProduct);
                }

                // Identify variant index
                List<Map<String, Object>> vars = kiyuziyuProduct.getVariations();
                int matchedVariantIdx = -1;
                boolean hasInvalidVariantSkuForItem = false;

                if (vars != null && !vars.isEmpty()) {
                    // A) Match by shopifyVariantId
                    if (!shopifyVariantId.isEmpty()) {
                        for (int vi = 0; vi < vars.size(); vi++) {
                            Map<String, Object> v = vars.get(vi);
                            String vId = v.get("shopifyVariantId") != null ? String.valueOf(v.get("shopifyVariantId")).trim()
                                    : (v.get("variantId") != null ? String.valueOf(v.get("variantId")).trim()
                                    : (v.get("shopify_variant_id") != null ? String.valueOf(v.get("shopify_variant_id")).trim()
                                    : (v.get("id") != null ? String.valueOf(v.get("id")).trim() : "")));
                            if (vId.contains("/")) vId = vId.substring(vId.lastIndexOf('/') + 1);
                            if (!vId.isEmpty() && vId.equalsIgnoreCase(shopifyVariantId)) {
                                matchedVariantIdx = vi;
                                break;
                            }
                        }
                    }

                    // B) Match by direct variation SKU
                    if (matchedVariantIdx == -1 && !sku.isEmpty()) {
                        for (int vi = 0; vi < vars.size(); vi++) {
                            Map<String, Object> v = vars.get(vi);
                            String vSku = v.get("sku") != null ? String.valueOf(v.get("sku")).trim() : "";
                            if (!vSku.isEmpty() && vSku.equalsIgnoreCase(sku)) {
                                matchedVariantIdx = vi;
                                break;
                            }
                        }
                    }

                    // C) Match by safe suffix parser in SKU
                    if (matchedVariantIdx == -1 && !sku.isEmpty()) {
                        com.kiyuziyu.api.util.ShopifySkuParser.SkuParseResult parsedSku = com.kiyuziyu.api.util.ShopifySkuParser.parse(sku);
                        if (parsedSku.hasVariantSuffix()) {
                            if (parsedSku.getVariantIndex() >= 0 && parsedSku.getVariantIndex() < vars.size()) {
                                matchedVariantIdx = parsedSku.getVariantIndex();
                            } else {
                                log.warn("[ShopifyOrderWebhook] SKU '{}' has out-of-range variant index {} for product '{}' (variations={})",
                                        sku, parsedSku.getVariantIndex() + 1, productCode, vars.size());
                                hasInvalidVariantSkuForItem = true;
                            }
                        }
                    }

                    // D) Match by variantTitle / color / name / title / size comparing normalized strings
                    if (matchedVariantIdx == -1 && !hasInvalidVariantSkuForItem && !variantTitle.isEmpty() && !"Default Title".equalsIgnoreCase(variantTitle)) {
                        String cleanVT = com.kiyuziyu.api.util.ShopifySkuParser.normalize(variantTitle).toLowerCase();
                        for (int vi = 0; vi < vars.size(); vi++) {
                            Map<String, Object> v = vars.get(vi);
                            String vColor = v.get("color") != null ? com.kiyuziyu.api.util.ShopifySkuParser.normalize(String.valueOf(v.get("color"))).toLowerCase() : "";
                            String vName = v.get("name") != null ? com.kiyuziyu.api.util.ShopifySkuParser.normalize(String.valueOf(v.get("name"))).toLowerCase() : "";
                            String vTitle = v.get("title") != null ? com.kiyuziyu.api.util.ShopifySkuParser.normalize(String.valueOf(v.get("title"))).toLowerCase() : "";
                            String vSize = v.get("size") != null ? com.kiyuziyu.api.util.ShopifySkuParser.normalize(String.valueOf(v.get("size"))).toLowerCase() : "";
                            String vVarName = v.get("variantName") != null ? com.kiyuziyu.api.util.ShopifySkuParser.normalize(String.valueOf(v.get("variantName"))).toLowerCase() : "";

                            if ((!vVarName.isEmpty() && (cleanVT.equals(vVarName) || cleanVT.contains(vVarName) || vVarName.contains(cleanVT))) ||
                                (!vColor.isEmpty() && (cleanVT.equals(vColor) || cleanVT.contains(vColor) || vColor.contains(cleanVT))) ||
                                (!vName.isEmpty() && (cleanVT.equals(vName) || cleanVT.contains(vName) || vName.contains(cleanVT))) ||
                                (!vTitle.isEmpty() && (cleanVT.equals(vTitle) || cleanVT.contains(vTitle) || vTitle.contains(cleanVT))) ||
                                (!vSize.isEmpty() && (cleanVT.equals(vSize) || cleanVT.contains(vSize) || vSize.contains(cleanVT)))) {
                                matchedVariantIdx = vi;
                                break;
                            }
                        }
                    }

                    // E) Single variation defaults to index 0
                    if (matchedVariantIdx == -1 && !hasInvalidVariantSkuForItem && vars.size() == 1) {
                        matchedVariantIdx = 0;
                    }

                    // F) Multi-variant safe check: if still unmatched on multi-variant product, fail safe
                    if (matchedVariantIdx == -1 && !hasInvalidVariantSkuForItem && vars.size() > 1) {
                        log.warn("[ShopifyOrderWebhook] Multi-variant product '{}' (variations={}) cannot be safely matched for SKU '{}', variantTitle '{}'. Ambiguous variant mapping.",
                                productCode, vars.size(), sku, variantTitle);
                        hasInvalidVariantSkuForItem = true;
                    }
                } else {
                    matchedVariantIdx = -1; // Non-variant product
                }

                if (hasInvalidVariantSkuForItem) {
                    hasInvalidVariantSku = true;
                    break;
                }

                // Validate Shopify line-item quantity
                Object rawQtyObj = item.get("quantity");
                Integer validQty = parsePositiveQuantity(rawQtyObj);
                if (validQty == null || validQty <= 0) {
                    log.error("[ShopifyOrderWebhook] Recognized Kiyuziyu item (SKU '{}', productCode '{}') has invalid quantity '{}'. Rejecting entire order.",
                            sku, productCode, rawQtyObj);
                    hasInvalidQuantity = true;
                    break;
                }

                validatedItems.add(new ValidatedLineItem(item, kiyuziyuProduct, prodKey, productCode, matchedVariantIdx, validQty, isRecognized));
            }

            if (hasInvalidVariantSku || hasInvalidQuantity) {
                log.error("[ShopifyOrderWebhook] Order #{} failed line-item validation (invalid/ambiguous variant SKU or invalid quantity). Failing safely to prevent inventory desynchronization.", orderNumber);
                return;
            }

            if (recognizedCount == 0) {
                log.info("[ShopifyOrderWebhook] Order #{} has no recognized Kiyuziyu products. Ignoring order.", orderNumber);
                return;
            }

            // Phase 2: Build order items, update totals, and apply in-memory deductions
            for (ValidatedLineItem vi : validatedItems) {
                Map<String, Object> item = vi.rawItem;
                Product kiyuziyuProduct = vi.product;
                String prodKey = vi.prodKey;
                String productCode = vi.productCode;
                int matchedVariantIdx = vi.matchedVariantIdx;
                int qty = vi.quantity;
                String rawSku = item.get("sku") != null ? String.valueOf(item.get("sku")).trim() : "";
                String rawVariantId = item.get("variant_id") != null ? String.valueOf(item.get("variant_id")).trim() : "";
                if (rawVariantId.contains("/")) rawVariantId = rawVariantId.substring(rawVariantId.lastIndexOf('/') + 1);

                String prodName = (String) item.get("title");
                if (prodName == null || prodName.trim().isEmpty()) {
                    prodName = kiyuziyuProduct.getProductName();
                }

                String variantName = (String) item.get("variant_title");
                String lineSku = rawSku;

                if (matchedVariantIdx >= 0 && kiyuziyuProduct.getVariations() != null && matchedVariantIdx < kiyuziyuProduct.getVariations().size()) {
                    Map<String, Object> targetVar = kiyuziyuProduct.getVariations().get(matchedVariantIdx);
                    if (variantName == null || variantName.trim().isEmpty() || "Default Title".equalsIgnoreCase(variantName.trim())) {
                        String c = targetVar.get("color") != null ? String.valueOf(targetVar.get("color")).trim() : "";
                        String s = targetVar.get("size") != null ? String.valueOf(targetVar.get("size")).trim() : "";
                        String n = targetVar.get("name") != null ? String.valueOf(targetVar.get("name")).trim() : "";
                        if (n.isEmpty() && targetVar.get("title") != null) n = String.valueOf(targetVar.get("title")).trim();
                        if (n.isEmpty() && targetVar.get("variantName") != null) n = String.valueOf(targetVar.get("variantName")).trim();

                        List<String> parts = new ArrayList<>();
                        if (!c.isEmpty()) parts.add(c);
                        if (!s.isEmpty()) parts.add(s);
                        if (parts.isEmpty() && !n.isEmpty()) parts.add(n);
                        variantName = !parts.isEmpty() ? String.join(" / ", parts) : "Variant " + (matchedVariantIdx + 1);
                    }
                    if (lineSku.isEmpty()) {
                        if (targetVar.get("sku") != null && !String.valueOf(targetVar.get("sku")).trim().isEmpty()) {
                            lineSku = String.valueOf(targetVar.get("sku")).trim();
                        } else {
                            lineSku = productCode + (kiyuziyuProduct.getVariations().size() > 1 ? "-" + (matchedVariantIdx + 1) : "");
                        }
                    }
                    if (rawVariantId.isEmpty()) {
                        if (targetVar.get("variantId") != null) rawVariantId = String.valueOf(targetVar.get("variantId")).trim();
                        else if (targetVar.get("shopifyVariantId") != null) rawVariantId = String.valueOf(targetVar.get("shopifyVariantId")).trim();
                    }
                } else {
                    if (lineSku.isEmpty()) {
                        lineSku = productCode;
                    }
                }

                TenantOrderItem tItem = new TenantOrderItem();
                tItem.setProductId(kiyuziyuProduct.getId());
                tItem.setCollectionId(kiyuziyuProduct.getCollectionId());
                tItem.setSubcollectionId(kiyuziyuProduct.getSubcollectionId());
                tItem.setProductCode(productCode);
                tItem.setProductName(prodName);
                tItem.setVariantName(variantName);
                tItem.setSku(lineSku);
                if (!rawVariantId.isEmpty()) {
                    tItem.setVariantId(rawVariantId);
                }
                tItem.setQuantity(qty);

                Double sellingPrice = Double.parseDouble(String.valueOf(item.get("price")));
                Double basePrice = kiyuziyuProduct.getBasePrice() != null ? kiyuziyuProduct.getBasePrice() : 0.0;
                Double purchasePrice = kiyuziyuProduct.getEffectivePurchaseRate();
                Double profit = (sellingPrice - basePrice) * qty;
                Double adminProfit = (basePrice - purchasePrice) * qty;

                tItem.setBasePrice(basePrice);
                tItem.setSellingPrice(sellingPrice);
                tItem.setProfit(profit);
                tItem.setPurchasePrice(purchasePrice);
                tItem.setAdminProfit(adminProfit);

                kiyuziyuItems.add(tItem);

                totalBase += (basePrice * qty);
                totalSelling += (sellingPrice * qty);
                totalPurchase += (purchasePrice * qty);
                totalAdminProfitAmount += adminProfit;

                // ==========================================
                // INVENTORY DEDUCTION LOGIC (IN MEMORY)
                // ==========================================
                // Check if this item was already deducted in an existing order
                boolean isAlreadyInStored = false;
                if (isRepairingExisting && alreadyStoredItems != null) {
                    for (Map<String, Object> si : alreadyStoredItems) {
                        String sSku = si.get("sku") != null ? String.valueOf(si.get("sku")).trim() : "";
                        String sVarId = si.get("variantId") != null ? String.valueOf(si.get("variantId")).trim() : "";
                        String sPCode = si.get("productCode") != null ? String.valueOf(si.get("productCode")).trim() : "";
                        String sVName = si.get("variantName") != null ? String.valueOf(si.get("variantName")).trim() : "";

                        if (!rawVariantId.isEmpty() && !sVarId.isEmpty() && rawVariantId.equalsIgnoreCase(sVarId)) {
                            isAlreadyInStored = true;
                            break;
                        }
                        if (!lineSku.isEmpty() && !sSku.isEmpty() && lineSku.equalsIgnoreCase(sSku)) {
                            isAlreadyInStored = true;
                            break;
                        }
                        if (!productCode.isEmpty() && !sPCode.isEmpty() && productCode.equalsIgnoreCase(sPCode)) {
                            if ((variantName == null && sVName.isEmpty()) || (variantName != null && variantName.equalsIgnoreCase(sVName))) {
                                isAlreadyInStored = true;
                                break;
                            }
                        }
                    }
                }

                if (isAlreadyInStored) {
                    log.info("[ShopifyOrderWebhook] Item SKU {} / variantId {} already present in stored order. Skipping inventory re-deduction.",
                            lineSku, rawVariantId);
                    continue;
                }
                if (vi.isRecognized) {
                    try {
                        List<Map<String, Object>> variations = kiyuziyuProduct.getVariations();
                        if (variations != null && !variations.isEmpty()) {
                            if (matchedVariantIdx >= 0 && matchedVariantIdx < variations.size()) {
                                List<Map<String, Object>> mutableVariations = new java.util.ArrayList<>();
                                for (Map<String, Object> v : variations) {
                                    mutableVariations.add(new java.util.HashMap<>(v));
                                }

                                Map<String, Object> targetVariant = mutableVariations.get(matchedVariantIdx);
                                Object rawQty = targetVariant.get("quantity");
                                if (rawQty == null) rawQty = targetVariant.get("initialQuantity");

                                int currentQty = 0;
                                if (rawQty instanceof Number) currentQty = ((Number) rawQty).intValue();
                                else if (rawQty instanceof String) {
                                    try { currentQty = Integer.parseInt(((String) rawQty).trim()); } catch (Exception ignored) {}
                                }

                                int newQty = Math.max(0, currentQty - qty);
                                targetVariant.put("quantity", newQty);

                                // Set updated variations back on product
                                kiyuziyuProduct.setVariations(mutableVariations);

                                // Compute updated root quantity across variations
                                int totalStock = 0;
                                for (Map<String, Object> v : mutableVariations) {
                                    Object vq = v.get("quantity");
                                    if (vq == null) vq = v.get("initialQuantity");
                                    int vQty = 0;
                                    if (vq instanceof Number) vQty = ((Number) vq).intValue();
                                    else if (vq instanceof String) {
                                        try { vQty = Integer.parseInt(((String) vq).trim()); } catch (Exception ignored) {}
                                    }
                                    totalStock += vQty;
                                }
                                kiyuziyuProduct.setQuantity(totalStock);
                                productUpdated.put(prodKey, true);

                                log.info("[ShopifyOrderWebhook] Deducted memory inventory for variant idx={} (SKU={}): {} -> {}, totalStock={}",
                                        matchedVariantIdx, lineSku, currentQty, newQty, totalStock);
                            }
                        } else {
                            // Main product (no variations)
                            int currentQty = 0;
                            Object q = kiyuziyuProduct.getQuantity();
                            if (q == null) q = kiyuziyuProduct.getInitialQuantity();
                            if (q instanceof Number) currentQty = ((Number) q).intValue();
                            else if (q instanceof String) {
                                try { currentQty = Integer.parseInt(((String) q).trim()); } catch (Exception ignored) {}
                            }

                            int newQty = Math.max(0, currentQty - qty);
                            kiyuziyuProduct.setQuantity(newQty);
                            productUpdated.put(prodKey, true);
                            log.info("[ShopifyOrderWebhook] Deducted memory inventory for main product {}: {} -> {}",
                                    productCode, currentQty, newQty);
                        }
                    } catch (Exception e) {
                        log.warn("[ShopifyOrderWebhook] Failed to deduct inventory for SKU {}: {}", lineSku, e.getMessage());
                    }
                }
            }

            // ==========================================
            // PERSIST UPDATES TO FIRESTORE
            // ==========================================
            for (Map.Entry<String, Product> entry : productCache.entrySet()) {
                String pKey = entry.getKey();
                if (productUpdated.getOrDefault(pKey, false)) {
                    Product p = entry.getValue();
                    try {
                        Map<String, Object> updates = new java.util.HashMap<>();
                        if (p.getVariations() != null && !p.getVariations().isEmpty()) {
                            updates.put("variations", p.getVariations());
                            updates.put("quantity", p.getQuantity());
                        } else {
                            updates.put("quantity", p.getQuantity());
                        }
                        updates.put("updatedAt", Instant.now().toString());

                        String colId = p.getCollectionId();
                        String subId = p.getSubcollectionId();
                        String productId = p.getId();
                        String pCode = p.getProductCode();

                        boolean updated = false;

                        // Priority 1: Exact Firestore path: collections/{collectionId}/subcollections/{subcollectionId}/products/{productId}
                        if (colId != null && !colId.trim().isEmpty() &&
                            subId != null && !subId.trim().isEmpty() &&
                            productId != null && !productId.trim().isEmpty()) {
                            try {
                                com.google.cloud.firestore.DocumentReference docRef = firestore.collection("collections").document(colId.trim())
                                        .collection("subcollections").document(subId.trim())
                                        .collection("products").document(productId.trim());
                                RealtimeStockListener.suppressLoop(productId.trim());
                                if (pCode != null) RealtimeStockListener.suppressLoop(pCode.trim());
                                docRef.update(updates).get();
                                updated = true;
                                log.info("[ShopifyOrderWebhook] Successfully updated exact product at collections/{}/subcollections/{}/products/{}",
                                        colId, subId, productId);
                            } catch (Exception ex) {
                                log.warn("[ShopifyOrderWebhook] Direct path update failed for {}/{}/{}: {}", colId, subId, productId, ex.getMessage());
                            }
                        }

                        // Priority 1B: If colId/subId was missing, refetch master product to get exact path
                        if (!updated && productId != null && !productId.trim().isEmpty()) {
                            try {
                                Product refetched = productRepository.findByDocumentId(productId.trim());
                                if (refetched != null && refetched.getCollectionId() != null && refetched.getSubcollectionId() != null) {
                                    com.google.cloud.firestore.DocumentReference docRef = firestore.collection("collections").document(refetched.getCollectionId())
                                            .collection("subcollections").document(refetched.getSubcollectionId())
                                            .collection("products").document(productId.trim());
                                    RealtimeStockListener.suppressLoop(productId.trim());
                                    if (pCode != null) RealtimeStockListener.suppressLoop(pCode.trim());
                                    docRef.update(updates).get();
                                    updated = true;
                                    log.info("[ShopifyOrderWebhook] Successfully updated exact product via refetched path: collections/{}/subcollections/{}/products/{}",
                                            refetched.getCollectionId(), refetched.getSubcollectionId(), productId);
                                }
                            } catch (Exception ex) {
                                log.warn("[ShopifyOrderWebhook] Refetched direct path update failed: {}", ex.getMessage());
                            }
                        }

                        // Priority 2: Fallback query via collectionGroup
                        if (!updated) {
                            try {
                                Query query = null;
                                if (pCode != null && !pCode.trim().isEmpty()) {
                                    query = firestore.collectionGroup("products").whereEqualTo("productCode", pCode.trim());
                                }
                                if (query != null) {
                                    List<QueryDocumentSnapshot> docs = query.get().get().getDocuments();
                                    if (docs.isEmpty()) {
                                        query = firestore.collectionGroup("products").whereEqualTo("productCode", pCode.trim() + " ");
                                        docs = query.get().get().getDocuments();
                                    }
                                    if (docs.isEmpty()) {
                                        query = firestore.collectionGroup("products").whereEqualTo("productCode", pCode.trim() + "  ");
                                        docs = query.get().get().getDocuments();
                                    }
                                    if (!docs.isEmpty()) {
                                        for (QueryDocumentSnapshot doc : docs) {
                                            if (productId != null && !productId.trim().isEmpty() && !doc.getId().equals(productId.trim()) && docs.size() > 1) {
                                                continue;
                                            }
                                            RealtimeStockListener.suppressLoop(doc.getId());
                                            if (pCode != null) RealtimeStockListener.suppressLoop(pCode.trim());
                                            doc.getReference().update(updates).get();
                                            updated = true;
                                        }
                                        log.info("[ShopifyOrderWebhook] Updated product via collectionGroup for {}", pCode);
                                    }
                                }
                            } catch (Exception ex) {
                                log.warn("[ShopifyOrderWebhook] collectionGroup query failed for {}: {}", pCode, ex.getMessage());
                            }
                        }

                        // Priority 3: Fallback iteration across collections and subcollections
                        if (!updated && pCode != null && !pCode.trim().isEmpty()) {
                            try {
                                Iterable<com.google.cloud.firestore.DocumentReference> collections = firestore.collection("collections").listDocuments();
                                for (com.google.cloud.firestore.DocumentReference cRef : collections) {
                                    Iterable<com.google.cloud.firestore.DocumentReference> subcollections = cRef.collection("subcollections").listDocuments();
                                    for (com.google.cloud.firestore.DocumentReference sRef : subcollections) {
                                        Query q = sRef.collection("products").whereEqualTo("productCode", pCode.trim());
                                        List<QueryDocumentSnapshot> docs = q.get().get().getDocuments();
                                        if (!docs.isEmpty()) {
                                            for (QueryDocumentSnapshot doc : docs) {
                                                if (productId != null && !productId.trim().isEmpty() && !doc.getId().equals(productId.trim()) && docs.size() > 1) {
                                                    continue;
                                                }
                                                RealtimeStockListener.suppressLoop(doc.getId());
                                                RealtimeStockListener.suppressLoop(pCode.trim());
                                                doc.getReference().update(updates).get();
                                                updated = true;
                                            }
                                        }
                                        if (updated) break;
                                    }
                                    if (updated) break;
                                }
                            } catch (Exception ex) {
                                log.warn("[ShopifyOrderWebhook] Fallback iteration failed for {}: {}", pCode, ex.getMessage());
                            }
                        }
                    } catch (Exception ex) {
                        log.error("[ShopifyOrderWebhook] Failed to persist updates for product key {}: {}", pKey, ex.getMessage());
                    }
                }
            }

            if (kiyuziyuItems.isEmpty()) {
                log.info("[ShopifyOrderWebhook] Order #{} has no Kiyuziyu products. Ignoring.", orderNumber);
                return;
            }

            if (isRepairingExisting && existingDoc != null) {
                Map<String, Object> updates = new java.util.HashMap<>();
                updates.put("items", kiyuziyuItems);
                updates.put("totalBasePrice", totalBase);
                updates.put("totalSellingPrice", totalSelling);
                updates.put("totalProfit", totalSelling - totalBase);
                updates.put("totalPurchasePrice", totalPurchase);
                updates.put("totalAdminProfit", totalAdminProfitAmount);
                updates.put("updatedAt", Instant.now().toString());

                if (isMeaningful(customerName)) updates.put("customerName", customerName.trim());
                if (isMeaningful(customerEmail)) updates.put("customerEmail", customerEmail);
                if (isMeaningful(customerPhone)) updates.put("customerPhone", customerPhone);
                if (isMeaningful(shippingAddressStr)) updates.put("shippingAddress", shippingAddressStr);
                if (isMeaningful(billingAddressStr)) updates.put("billingAddress", billingAddressStr);
                if (isMeaningful(details.currency)) updates.put("currency", details.currency);
                if (isMeaningful(paymentMethodStr)) updates.put("paymentMethod", paymentMethodStr);
                if (isMeaningful(shippingMethodStr)) updates.put("shippingMethod", shippingMethodStr);
                if (isMeaningful(customerNoteStr)) updates.put("customerNote", customerNoteStr);

                String financialStatus = payload.get("financial_status") != null ? String.valueOf(payload.get("financial_status")) : "";
                if ("paid".equalsIgnoreCase(financialStatus)) {
                    updates.put("status", "Payment Done");
                }

                existingDoc.getReference().update(updates).get();
                log.info("[ShopifyOrderWebhook] Successfully repaired and updated existing Order doc: {} with complete items ({})",
                        existingDoc.getId(), kiyuziyuItems.size());
            } else {
                // Create and save TenantOrder
                TenantOrder order = new TenantOrder();
                order.setOrderId(internalOrderId);
                order.setTenantId(resolvedTenantId);
                if (resolvedStoreId != null) {
                    order.setStoreId(resolvedStoreId);
                }
                order.setShopifyOrderId(shopifyOrderId);
                order.setOrderNumber(orderNumber);
                order.setCustomerName(customerName.trim());
                order.setCustomerEmail(customerEmail);
                order.setTotalBasePrice(totalBase);
                order.setTotalSellingPrice(totalSelling);
                order.setTotalProfit(totalSelling - totalBase);
                order.setTotalPurchasePrice(totalPurchase);
                order.setTotalAdminProfit(totalAdminProfitAmount);
                order.setItems(kiyuziyuItems);
                order.setCustomerPhone(customerPhone);
                order.setShippingAddress(shippingAddressStr);
                order.setBillingAddress(billingAddressStr);
                order.setCustomerNote(customerNoteStr);
                order.setPaymentMethod(paymentMethodStr);
                order.setShippingMethod(shippingMethodStr);
                order.setCurrency(details.currency);

                String financialStatus = payload.get("financial_status") != null ? String.valueOf(payload.get("financial_status")) : "";
                String initialStatus = "paid".equalsIgnoreCase(financialStatus) ? "Payment Done" : "Pending Payment";
                order.setStatus(initialStatus);
                order.setCreatedAt(Instant.now().toString());

                tenantOrderRepository.save(order);
                log.info("[ShopifyOrderWebhook] Successfully saved Kiyuziyu Order {} with {} items.", order.getOrderId(), kiyuziyuItems.size());
            }

        } catch (Exception e) {
            log.error("[ShopifyOrderWebhook] Error processing order payload: {}", e.getMessage(), e);
        }
    }

    public void processOrderPaidWebhook(String tenantId, String shopDomain, Map<String, Object> payload) {
        if (payload == null) return;
        String shopifyOrderId = String.valueOf(payload.get("id"));
        String orderNumber = String.valueOf(payload.get("order_number"));
        log.info("[ShopifyOrderWebhook] Received orders/paid for order #{}, shopifyOrderId={}", orderNumber, shopifyOrderId);

        try {
            com.google.cloud.firestore.QuerySnapshot snap = firestore.collection(TenantOrderRepository.COLLECTION_NAME)
                    .whereEqualTo("shopifyOrderId", shopifyOrderId)
                    .limit(1)
                    .get()
                    .get();

            if (!snap.isEmpty()) {
                com.google.cloud.firestore.DocumentReference docRef = snap.getDocuments().get(0).getReference();
                Map<String, Object> updates = new java.util.HashMap<>();
                updates.put("status", "Payment Done");
                updates.put("updatedAt", Instant.now().toString());

                ExtractedOrderDetails details = extractOrderDetails(payload);
                if (isMeaningful(details.customerName)) updates.put("customerName", details.customerName);
                if (isMeaningful(details.customerEmail)) updates.put("customerEmail", details.customerEmail);
                if (isMeaningful(details.customerPhone)) updates.put("customerPhone", details.customerPhone);
                if (isMeaningful(details.shippingAddressStr)) updates.put("shippingAddress", details.shippingAddressStr);
                if (isMeaningful(details.billingAddressStr)) updates.put("billingAddress", details.billingAddressStr);
                if (isMeaningful(details.currency)) updates.put("currency", details.currency);
                if (isMeaningful(details.paymentMethod)) updates.put("paymentMethod", details.paymentMethod);
                if (isMeaningful(details.shippingMethod)) updates.put("shippingMethod", details.shippingMethod);
                if (isMeaningful(details.customerNote)) updates.put("customerNote", details.customerNote);

                docRef.update(updates).get();
                log.info("[ShopifyOrderWebhook] Updated order #{} status to 'Payment Done' and synced customer details", orderNumber);
            } else {
                // If order was not received via orders/create yet, ingest it directly with 'Payment Done' status
                processOrderWebhook(tenantId, shopDomain, payload);
            }
        } catch (Exception e) {
            log.error("[ShopifyOrderWebhook] Error processing orders/paid: {}", e.getMessage(), e);
        }
    }

    public static class ExtractedOrderDetails {
        public String customerName = "";
        public String customerEmail = "";
        public String customerPhone = "";
        public String shippingAddressStr = "";
        public String billingAddressStr = "";
        public String currency = "INR";
        public String paymentMethod = "";
        public String shippingMethod = "";
        public String customerNote = "";
    }

    @SuppressWarnings("unchecked")
    public ExtractedOrderDetails extractOrderDetails(Map<String, Object> payload) {
        ExtractedOrderDetails d = new ExtractedOrderDetails();
        if (payload == null) return d;

        Map<String, Object> customer = payload.get("customer") instanceof Map ? (Map<String, Object>) payload.get("customer") : null;
        Map<String, Object> shippingAddress = payload.get("shipping_address") instanceof Map ? (Map<String, Object>) payload.get("shipping_address") : null;
        Map<String, Object> billingAddress = payload.get("billing_address") instanceof Map ? (Map<String, Object>) payload.get("billing_address") : null;

        // 1. Email: Check payload email, customer email, contact_email
        String email = null;
        if (payload.get("email") != null && !String.valueOf(payload.get("email")).trim().isEmpty()) {
            email = String.valueOf(payload.get("email")).trim();
        } else if (customer != null && customer.get("email") != null && !String.valueOf(customer.get("email")).trim().isEmpty()) {
            email = String.valueOf(customer.get("email")).trim();
        } else if (payload.get("contact_email") != null && !String.valueOf(payload.get("contact_email")).trim().isEmpty()) {
            email = String.valueOf(payload.get("contact_email")).trim();
        }
        d.customerEmail = email != null ? email : "";

        // 2. Phone: Check top-level phone, customer phone, shipping phone, billing phone, default_address phone
        String phone = null;
        if (payload.get("phone") != null && !String.valueOf(payload.get("phone")).trim().isEmpty()) {
            phone = String.valueOf(payload.get("phone")).trim();
        } else if (customer != null && customer.get("phone") != null && !String.valueOf(customer.get("phone")).trim().isEmpty()) {
            phone = String.valueOf(customer.get("phone")).trim();
        } else if (shippingAddress != null && shippingAddress.get("phone") != null && !String.valueOf(shippingAddress.get("phone")).trim().isEmpty()) {
            phone = String.valueOf(shippingAddress.get("phone")).trim();
        } else if (billingAddress != null && billingAddress.get("phone") != null && !String.valueOf(billingAddress.get("phone")).trim().isEmpty()) {
            phone = String.valueOf(billingAddress.get("phone")).trim();
        } else if (customer != null && customer.get("default_address") instanceof Map) {
            Map<String, Object> defAddr = (Map<String, Object>) customer.get("default_address");
            if (defAddr.get("phone") != null && !String.valueOf(defAddr.get("phone")).trim().isEmpty()) {
                phone = String.valueOf(defAddr.get("phone")).trim();
            }
        }
        d.customerPhone = phone != null ? phone : "";

        // 3. Customer Name:
        // Priority:
        // A) customer first_name + last_name
        // B) customer name
        // C) shipping_address name or first_name + last_name
        // D) billing_address name or first_name + last_name
        // E) customer default_address name or first_name + last_name
        String name = "";
        if (customer != null) {
            String fName = customer.get("first_name") != null ? String.valueOf(customer.get("first_name")).trim() : "";
            String lName = customer.get("last_name") != null ? String.valueOf(customer.get("last_name")).trim() : "";
            name = (fName + " " + lName).trim();
            if (name.isEmpty() && customer.get("name") != null) {
                name = String.valueOf(customer.get("name")).trim();
            }
        }
        if (name.isEmpty() || "Unknown".equalsIgnoreCase(name) || "Test Customer".equalsIgnoreCase(name)) {
            if (shippingAddress != null) {
                if (shippingAddress.get("name") != null && !String.valueOf(shippingAddress.get("name")).trim().isEmpty()) {
                    name = String.valueOf(shippingAddress.get("name")).trim();
                } else {
                    String sf = shippingAddress.get("first_name") != null ? String.valueOf(shippingAddress.get("first_name")).trim() : "";
                    String sl = shippingAddress.get("last_name") != null ? String.valueOf(shippingAddress.get("last_name")).trim() : "";
                    name = (sf + " " + sl).trim();
                }
            }
        }
        if (name.isEmpty() || "Unknown".equalsIgnoreCase(name) || "Test Customer".equalsIgnoreCase(name)) {
            if (billingAddress != null) {
                if (billingAddress.get("name") != null && !String.valueOf(billingAddress.get("name")).trim().isEmpty()) {
                    name = String.valueOf(billingAddress.get("name")).trim();
                } else {
                    String bf = billingAddress.get("first_name") != null ? String.valueOf(billingAddress.get("first_name")).trim() : "";
                    String bl = billingAddress.get("last_name") != null ? String.valueOf(billingAddress.get("last_name")).trim() : "";
                    name = (bf + " " + bl).trim();
                }
            }
        }
        if ("Unknown".equalsIgnoreCase(name) || "Test Customer".equalsIgnoreCase(name)) {
            name = "";
        }
        d.customerName = name;

        // 4. Addresses
        d.shippingAddressStr = formatAddress(shippingAddress != null ? shippingAddress : billingAddress);
        d.billingAddressStr = formatAddress(billingAddress != null ? billingAddress : shippingAddress);

        // 5. Currency
        if (payload.get("currency") != null && !String.valueOf(payload.get("currency")).trim().isEmpty()) {
            d.currency = String.valueOf(payload.get("currency")).trim();
        } else if (payload.get("presentment_currency") != null && !String.valueOf(payload.get("presentment_currency")).trim().isEmpty()) {
            d.currency = String.valueOf(payload.get("presentment_currency")).trim();
        } else {
            d.currency = "INR";
        }

        // 6. Payment method
        if (payload.get("gateway") != null && !String.valueOf(payload.get("gateway")).trim().isEmpty()) {
            d.paymentMethod = String.valueOf(payload.get("gateway")).trim();
        } else if (payload.get("payment_gateway_names") instanceof List) {
            List<?> gateways = (List<?>) payload.get("payment_gateway_names");
            if (!gateways.isEmpty() && gateways.get(0) != null) {
                d.paymentMethod = String.valueOf(gateways.get(0)).trim();
            }
        }

        // 7. Shipping method
        if (payload.get("shipping_lines") instanceof List) {
            List<?> lines = (List<?>) payload.get("shipping_lines");
            if (!lines.isEmpty() && lines.get(0) instanceof Map) {
                Map<?, ?> firstLine = (Map<?, ?>) lines.get(0);
                if (firstLine.get("title") != null) {
                    d.shippingMethod = String.valueOf(firstLine.get("title")).trim();
                }
            }
        }

        // 8. Note
        if (payload.get("note") != null) {
            d.customerNote = String.valueOf(payload.get("note")).trim();
        }

        return d;
    }

    private String formatAddress(Map<String, Object> addr) {
        if (addr == null) return "";
        List<String> parts = new ArrayList<>();
        String name = null;
        if (addr.get("name") != null && !String.valueOf(addr.get("name")).trim().isEmpty()) {
            name = String.valueOf(addr.get("name")).trim();
        } else {
            String f = addr.get("first_name") != null ? String.valueOf(addr.get("first_name")).trim() : "";
            String l = addr.get("last_name") != null ? String.valueOf(addr.get("last_name")).trim() : "";
            name = (f + " " + l).trim();
        }
        if (name != null && !name.isEmpty() && !"null".equalsIgnoreCase(name)) {
            parts.add(name);
        }
        addAddressPart(parts, addr.get("company"));
        addAddressPart(parts, addr.get("address1"));
        addAddressPart(parts, addr.get("address2"));
        addAddressPart(parts, addr.get("city"));
        addAddressPart(parts, addr.get("province"));
        addAddressPart(parts, addr.get("zip"));
        addAddressPart(parts, addr.get("country"));
        return String.join(", ", parts);
    }

    private void addAddressPart(List<String> parts, Object val) {
        if (val == null) return;
        String s = String.valueOf(val).trim();
        if (!s.isEmpty() && !"null".equalsIgnoreCase(s)) {
            parts.add(s);
        }
    }

    private boolean isMeaningful(String val) {
        if (val == null) return false;
        String s = val.trim();
        if (s.isEmpty() || "null".equalsIgnoreCase(s) || "undefined".equalsIgnoreCase(s)) return false;
        if ("Unknown".equalsIgnoreCase(s) || "Test Customer".equalsIgnoreCase(s)) return false;
        if (s.contains("customer1022@example.com") || s.contains("test@example.com")) return false;
        return true;
    }

    Integer parsePositiveQuantity(Object raw) {
        if (raw == null) return null;
        if (raw instanceof Number) {
            Number num = (Number) raw;
            if (raw instanceof Double) {
                Double d = (Double) raw;
                if (d.isNaN() || d.isInfinite()) return null;
            } else if (raw instanceof Float) {
                Float f = (Float) raw;
                if (f.isNaN() || f.isInfinite()) return null;
            }

            double d = num.doubleValue();
            if (Double.isNaN(d) || Double.isInfinite(d) || d != Math.floor(d)) {
                return null;
            }

            // Reject numeric values outside positive 32-bit signed integer range [1, Integer.MAX_VALUE]
            if (d < 1.0 || d > (double) Integer.MAX_VALUE) {
                return null;
            }

            // Check exact 64-bit integer value to prevent overflow for Long / BigInteger
            long l = num.longValue();
            if (l <= 0 || l > Integer.MAX_VALUE) {
                return null;
            }

            return (int) l;
        } else if (raw instanceof String) {
            String s = ((String) raw).trim();
            if (s.isEmpty()) return null;
            // Reject fractional or scientific notation string representations
            if (s.contains(".") || s.contains("e") || s.contains("E")) {
                return null;
            }
            try {
                long l = Long.parseLong(s);
                if (l <= 0 || l > Integer.MAX_VALUE) {
                    return null;
                }
                return (int) l;
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
    }

    private static class ValidatedLineItem {
        final Map<String, Object> rawItem;
        final Product product;
        final String prodKey;
        final String productCode;
        final int matchedVariantIdx;
        final int quantity;
        final boolean isRecognized;

        ValidatedLineItem(Map<String, Object> rawItem, Product product, String prodKey, String productCode, int matchedVariantIdx, int quantity, boolean isRecognized) {
            this.rawItem = rawItem;
            this.product = product;
            this.prodKey = prodKey;
            this.productCode = productCode;
            this.matchedVariantIdx = matchedVariantIdx;
            this.quantity = quantity;
            this.isRecognized = isRecognized;
        }
    }
}
