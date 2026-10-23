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
            if (shopDomain != null && !shopDomain.trim().isEmpty()) {
                com.kiyuziyu.api.model.ShopifyConnection conn = shopifyConnectionRepository.findByShopifyStoreDomain(shopDomain.trim());
                if (conn != null) {
                    if (resolvedTenantId == null || resolvedTenantId.trim().isEmpty()) {
                        resolvedTenantId = conn.getTenantId();
                    }
                    resolvedStoreId = conn.getStoreId();
                }
            }
            if (resolvedTenantId == null || resolvedTenantId.trim().isEmpty()) {
                resolvedTenantId = tenantId != null ? tenantId : "default";
            }
            
            ExtractedOrderDetails details = extractOrderDetails(payload);

            // Check if order already exists in Firestore
            com.google.cloud.firestore.QuerySnapshot existingSnap = firestore.collection(TenantOrderRepository.COLLECTION_NAME)
                    .whereEqualTo("shopifyOrderId", shopifyOrderId)
                    .limit(1)
                    .get()
                    .get();

            if (!existingSnap.isEmpty()) {
                com.google.cloud.firestore.DocumentSnapshot doc = existingSnap.getDocuments().get(0);
                log.info("[ShopifyOrderWebhook] Order #{} (shopifyOrderId={}) already exists. Updating customer/order fields without re-deducting inventory...", orderNumber, shopifyOrderId);
                
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
                    doc.getReference().update(updates).get();
                    log.info("[ShopifyOrderWebhook] Successfully updated customer details on existing doc: {}", doc.getId());
                }
                return;
            }
            
            if (!tenantOrderRepository.acquireLock(resolvedTenantId, shopifyOrderId)) {
                log.info("[ShopifyOrderWebhook] Order #{} for tenant {} is currently being processed by another thread, skipping...", orderNumber, resolvedTenantId);
                return;
            }
            
            String internalOrderId = "order_" + resolvedTenantId + "_" + shopifyOrderId;
            
            log.info("[ShopifyOrderWebhook] Processing new order #{} for tenant {}", orderNumber, resolvedTenantId);

            String customerName = details.customerName;
            String customerEmail = details.customerEmail;
            String customerPhone = details.customerPhone;
            String shippingAddressStr = details.shippingAddressStr;
            String billingAddressStr = details.billingAddressStr;
            String customerNoteStr = details.customerNote;
            String paymentMethodStr = details.paymentMethod;
            String shippingMethodStr = details.shippingMethod;

            List<Map<String, Object>> lineItems = (List<Map<String, Object>>) payload.get("line_items");
            if (lineItems == null || lineItems.isEmpty()) {
                log.info("[ShopifyOrderWebhook] No line items in order.");
                return;
            }

            List<TenantOrderItem> kiyuziyuItems = new ArrayList<>();
            double totalBase = 0.0;
            double totalSelling = 0.0;
            double totalPurchase = 0.0;
            double totalAdminProfitAmount = 0.0;

            Map<String, Product> productCache = new java.util.HashMap<>();
            Map<String, Boolean> productUpdated = new java.util.HashMap<>();
            boolean hasInvalidVariantSku = false;
            boolean hasInvalidQuantity = false;

            // Phase 1: Validate all recognized line items first without mutating inventory
            List<ValidatedLineItem> validatedItems = new java.util.ArrayList<>();

            for (Map<String, Object> item : lineItems) {
                String sku = (String) item.get("sku");
                if (sku == null || sku.trim().isEmpty()) {
                    continue; // Skip non-Kiyuziyu items (No SKU)
                }

                String skuClean = sku.trim();
                Product kiyuziyuProduct = null;
                String productCode = null;
                int matchedVariantIdx = -1;

                // 1. Direct check: exact SKU matches productCode
                Product directProduct = productCache.get(skuClean);
                if (directProduct == null) {
                    try {
                        directProduct = productRepository.findById(skuClean);
                    } catch (Exception ignored) {}
                }
                if (directProduct != null) {
                    List<Map<String, Object>> vars = directProduct.getVariations();
                    if (vars == null || vars.isEmpty()) {
                        kiyuziyuProduct = directProduct;
                        productCode = skuClean;
                        matchedVariantIdx = -1;
                    } else if (vars.size() == 1) {
                        kiyuziyuProduct = directProduct;
                        productCode = skuClean;
                        matchedVariantIdx = 0;
                    } else {
                        // Multi-variant product was referenced by bare productCode without variant index
                        log.warn("[ShopifyOrderWebhook] SKU '{}' matches multi-variant product '{}' (variations={}) but is missing variant index.",
                                skuClean, skuClean, vars.size());
                        hasInvalidVariantSku = true;
                        break;
                    }
                }

                // 2. Multi-variant convention check: <productCode>-<1-based idx>
                if (kiyuziyuProduct == null && skuClean.contains("-")) {
                    int lastDash = skuClean.lastIndexOf('-');
                    String candidateCode = skuClean.substring(0, lastDash).trim();
                    String suffix = skuClean.substring(lastDash + 1).trim();

                    Product candidateProduct = productCache.get(candidateCode);
                    if (candidateProduct == null) {
                        try {
                            candidateProduct = productRepository.findById(candidateCode);
                        } catch (Exception ignored) {}
                    }

                    if (candidateProduct != null) {
                        List<Map<String, Object>> vars = candidateProduct.getVariations();
                        if (vars != null && !vars.isEmpty()) {
                            try {
                                int idx = Integer.parseInt(suffix);
                                if (idx >= 1 && idx <= vars.size()) {
                                    kiyuziyuProduct = candidateProduct;
                                    productCode = candidateCode;
                                    matchedVariantIdx = idx - 1;
                                } else {
                                    // Variant index is out of range
                                    log.warn("[ShopifyOrderWebhook] SKU '{}' has out-of-range variant index {} for product '{}' (total variations={}).",
                                            skuClean, idx, candidateCode, vars.size());
                                    hasInvalidVariantSku = true;
                                    break;
                                }
                            } catch (NumberFormatException e) {
                                // Malformed variant index
                                log.warn("[ShopifyOrderWebhook] SKU '{}' has malformed variant index '{}' for multi-variant product '{}'.",
                                        skuClean, suffix, candidateCode);
                                    hasInvalidVariantSku = true;
                                    break;
                            }
                        }
                    }
                }

                // If kiyuziyuProduct is still null, it is an unknown SKU (e.g. unknown product or non-matching prefix)
                if (kiyuziyuProduct == null) {
                    log.warn("[ShopifyOrderWebhook] Unknown or unrecognized SKU: {}", sku);
                    continue; // Preserve existing behavior for genuinely unrelated SKUs
                }

                // Validate Shopify line-item quantity safely for recognized Kiyuziyu item (Requirements 1 & 2)
                Object rawQtyObj = item.get("quantity");
                Integer validQty = parsePositiveQuantity(rawQtyObj);
                if (validQty == null || validQty <= 0) {
                    log.error("[ShopifyOrderWebhook] Recognized Kiyuziyu item (SKU '{}', productCode '{}') has invalid/non-positive/overflow quantity '{}'. Rejecting entire order.",
                            sku, productCode, rawQtyObj);
                    hasInvalidQuantity = true;
                    break;
                }

                productCache.put(productCode, kiyuziyuProduct);
                validatedItems.add(new ValidatedLineItem(item, kiyuziyuProduct, productCode, matchedVariantIdx, validQty));
            }

            // Fail safely if any variant SKU was missing, malformed, or out of range,
            // or if any recognized Kiyuziyu line item had an invalid/non-positive/overflow quantity (Requirement 1).
            // Do not update inventory and do not create partial orders.
            if (hasInvalidVariantSku || hasInvalidQuantity) {
                log.error("[ShopifyOrderWebhook] Order #{} failed line-item validation (invalid variant SKU or recognized item quantity). Failing safely to prevent inventory desynchronization.", orderNumber);
                return;
            }

            // Phase 2: All recognized line items are valid. Now build order items, update totals, and apply in-memory deductions.
            for (ValidatedLineItem vi : validatedItems) {
                Map<String, Object> item = vi.rawItem;
                Product kiyuziyuProduct = vi.product;
                String productCode = vi.productCode;
                int matchedVariantIdx = vi.matchedVariantIdx;
                int qty = vi.quantity;
                String sku = (String) item.get("sku");

                // It's a Kiyuziyu Product
                TenantOrderItem tItem = new TenantOrderItem();
                tItem.setProductId(kiyuziyuProduct.getId());
                tItem.setCollectionId(kiyuziyuProduct.getCollectionId());
                tItem.setSubcollectionId(kiyuziyuProduct.getSubcollectionId());
                tItem.setProductCode(productCode);
                tItem.setProductName((String) item.get("title"));
                tItem.setVariantName((String) item.get("variant_title"));
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
                try {
                    List<Map<String, Object>> variations = kiyuziyuProduct.getVariations();
                    if (variations != null && !variations.isEmpty()) {
                        if (matchedVariantIdx >= 0 && matchedVariantIdx < variations.size()) {
                            // Create a mutable copy of the variations list and maps
                            List<Map<String, Object>> mutableVariations = new java.util.ArrayList<>();
                            for (int i = 0; i < variations.size(); i++) {
                                mutableVariations.add(new java.util.HashMap<>(variations.get(i)));
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

                            // Set the updated mutable list back to the product
                            kiyuziyuProduct.setVariations(mutableVariations);

                            // Compute updated total root quantity as sum of current variant quantities
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

                            productUpdated.put(productCode, true);
                            log.info("[ShopifyOrderWebhook] Deducted memory inventory for variant idx={} (SKU={}): {} -> {}, totalStock={}",
                                    matchedVariantIdx, sku, currentQty, newQty, totalStock);
                        } else {
                            log.warn("[ShopifyOrderWebhook] Ambiguous or unrecognized variant mapping for SKU '{}' (productCode='{}', variationsCount={}).",
                                    sku, productCode, variations.size());
                            hasInvalidVariantSku = true;
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
                        productUpdated.put(productCode, true);
                        log.info("[ShopifyOrderWebhook] Deducted memory inventory for main product {}: {} -> {}",
                                productCode, currentQty, newQty);
                    }
                } catch (Exception e) {
                    log.warn("[ShopifyOrderWebhook] Failed to deduct inventory for SKU {}: {}", sku, e.getMessage());
                }
                // ==========================================
            }

            // ==========================================
            // BATCH UPDATE FIRESTORE
            // ==========================================
            for (Map.Entry<String, Product> entry : productCache.entrySet()) {
                String productCode = entry.getKey();
                if (productUpdated.getOrDefault(productCode, false)) {
                    Product p = entry.getValue();
                    try {
                        Map<String, Object> updates = new java.util.HashMap<>();
                        if (p.getVariations() != null && !p.getVariations().isEmpty()) {
                            updates.put("variations", p.getVariations());
                            updates.put("quantity", p.getQuantity());
                        } else {
                            updates.put("quantity", p.getQuantity());
                        }
                        
                        Query query = firestore.collectionGroup("products").whereEqualTo("productCode", productCode);
                        List<QueryDocumentSnapshot> docs = query.get().get().getDocuments();
                        if (!docs.isEmpty()) {
                            for (QueryDocumentSnapshot doc : docs) {
                                RealtimeStockListener.suppressLoop(doc.getId());
                                RealtimeStockListener.suppressLoop(productCode);
                                doc.getReference().update(updates).get();
                            }
                            log.info("Batch Firebase inventory updated for {}", productCode);
                        }
                    } catch (Exception ex) {
                        log.warn("CollectionGroup query failed for {}. Falling back to iteration...", productCode);
                        Iterable<com.google.cloud.firestore.DocumentReference> collections = firestore.collection("collections").listDocuments();
                        boolean found = false;
                        for (com.google.cloud.firestore.DocumentReference colRef : collections) {
                            Iterable<com.google.cloud.firestore.DocumentReference> subcollections = colRef.collection("subcollections").listDocuments();
                            for (com.google.cloud.firestore.DocumentReference subRef : subcollections) {
                                Query q = subRef.collection("products").whereEqualTo("productCode", productCode);
                                List<QueryDocumentSnapshot> docs = q.get().get().getDocuments();
                                if (!docs.isEmpty()) {
                                    Map<String, Object> fallbackUpdates = new java.util.HashMap<>();
                                    if (p.getVariations() != null && !p.getVariations().isEmpty()) {
                                        fallbackUpdates.put("variations", p.getVariations());
                                        fallbackUpdates.put("quantity", p.getQuantity());
                                    } else {
                                        fallbackUpdates.put("quantity", p.getQuantity());
                                    }
                                    for (QueryDocumentSnapshot doc : docs) {
                                        RealtimeStockListener.suppressLoop(doc.getId());
                                        RealtimeStockListener.suppressLoop(productCode);
                                        doc.getReference().update(fallbackUpdates).get();
                                    }
                                    log.info("Batch Firebase inventory updated for {} via fallback", productCode);
                                    found = true;
                                }
                            }
                            if (found) break;
                        }
                    }
                }
            }

            if (kiyuziyuItems.isEmpty()) {
                log.info("[ShopifyOrderWebhook] Order #{} has no Kiyuziyu products. Ignoring.", orderNumber);
                return;
            }

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
        final String productCode;
        final int matchedVariantIdx;
        final int quantity;

        ValidatedLineItem(Map<String, Object> rawItem, Product product, String productCode, int matchedVariantIdx, int quantity) {
            this.rawItem = rawItem;
            this.product = product;
            this.productCode = productCode;
            this.matchedVariantIdx = matchedVariantIdx;
            this.quantity = quantity;
        }
    }
}
