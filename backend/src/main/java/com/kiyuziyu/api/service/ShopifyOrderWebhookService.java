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
    private Firestore firestore;

    public void processOrderWebhook(String tenantId, Map<String, Object> payload) {
        try {
            String shopifyOrderId = String.valueOf(payload.get("id"));
            String orderNumber = String.valueOf(payload.get("order_number"));
            
            if (tenantOrderRepository.existsByShopifyOrderId(tenantId, shopifyOrderId)) {
                log.info("[ShopifyOrderWebhook] Order #{} for tenant {} already processed, skipping...", orderNumber, tenantId);
                return;
            }
            
            log.info("[ShopifyOrderWebhook] Processing order #{} for tenant {}", orderNumber, tenantId);

            Map<String, Object> customer = (Map<String, Object>) payload.get("customer");
            String customerName = "Unknown";
            String customerEmail = "";
            if (customer != null) {
                String fName = (String) customer.get("first_name");
                String lName = (String) customer.get("last_name");
                customerName = (fName != null ? fName : "") + " " + (lName != null ? lName : "");
                customerEmail = (String) customer.get("email");
            }

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

            for (Map<String, Object> item : lineItems) {
                String sku = (String) item.get("sku");
                if (sku == null || sku.trim().isEmpty()) {
                    continue; // Skip non-Kiyuziyu items (No SKU)
                }

                // Extract base product code from SKU (e.g. PRD123-1 -> PRD123)
                String productCode = sku.split("-")[0];
                Product kiyuziyuProduct = null;
                
                try {
                    kiyuziyuProduct = productRepository.findById(productCode);
                } catch (Exception e) {
                    log.warn("Product not found for SKU: {}", sku);
                }

                if (kiyuziyuProduct != null) {
                    // It's a Kiyuziyu Product
                    TenantOrderItem tItem = new TenantOrderItem();
                    tItem.setProductId(kiyuziyuProduct.getId());
                    tItem.setProductCode(productCode);
                    tItem.setProductName((String) item.get("title"));
                    tItem.setVariantName((String) item.get("variant_title"));
                    
                    Integer qty = (Integer) item.get("quantity");
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
                    // INVENTORY DEDUCTION LOGIC
                    // ==========================================
                    try {
                        boolean isUpdated = false;
                        if (sku.contains("-")) {
                            int variantIdx = Integer.parseInt(sku.split("-")[1]) - 1;
                            List<Map<String, Object>> variations = kiyuziyuProduct.getVariations();
                            if (variations != null && variantIdx >= 0 && variantIdx < variations.size()) {
                                // Create a mutable copy of the variations list and the target variant map
                                List<Map<String, Object>> mutableVariations = new java.util.ArrayList<>();
                                for (int i = 0; i < variations.size(); i++) {
                                    Map<String, Object> copy = new java.util.HashMap<>(variations.get(i));
                                    mutableVariations.add(copy);
                                }
                                
                                Map<String, Object> targetVariant = mutableVariations.get(variantIdx);
                                Object rawQty = targetVariant.get("quantity");
                                if (rawQty == null) rawQty = targetVariant.get("initialQuantity");
                                
                                int currentQty = 0;
                                if (rawQty instanceof Number) currentQty = ((Number) rawQty).intValue();
                                else if (rawQty instanceof String) currentQty = Integer.parseInt((String) rawQty);
                                
                                int newQty = Math.max(0, currentQty - qty);
                                targetVariant.put("quantity", newQty);
                                
                                // Set the new mutable list back to the product
                                kiyuziyuProduct.setVariations(mutableVariations);
                                
                                isUpdated = true;
                                log.info("Deducted inventory for variant {}: {} -> {}", sku, currentQty, newQty);
                            }
                        } else {
                            // Main product (no variations)
                            int currentQty = 0;
                            try { 
                                Object q = kiyuziyuProduct.getQuantity();
                                if (q != null) currentQty = Integer.parseInt(String.valueOf(q)); 
                            } catch (Exception e) {}
                            int newQty = Math.max(0, currentQty - qty);
                            kiyuziyuProduct.setQuantity(newQty);
                            isUpdated = true;
                            log.info("Deducted inventory for main product {}: {} -> {}", productCode, currentQty, newQty);
                        }
                        
                        // Update directly in Firestore
                        if (isUpdated) {
                            try {
                                Query query = firestore.collectionGroup("products").whereEqualTo("productCode", productCode).limit(1);
                                List<QueryDocumentSnapshot> docs = query.get().get().getDocuments();
                                if (!docs.isEmpty()) {
                                    docs.get(0).getReference().update(
                                            "variations", kiyuziyuProduct.getVariations(),
                                            "quantity", kiyuziyuProduct.getQuantity()
                                    ).get();
                                    log.info("Firebase inventory updated for {}", productCode);
                                }
                            } catch (Exception ex) {
                                log.warn("CollectionGroup query failed for {}. Falling back to iteration...", productCode);
                                Iterable<com.google.cloud.firestore.DocumentReference> collections = firestore.collection("collections").listDocuments();
                                boolean found = false;
                                for (com.google.cloud.firestore.DocumentReference colRef : collections) {
                                    Iterable<com.google.cloud.firestore.DocumentReference> subcollections = colRef.collection("subcollections").listDocuments();
                                    for (com.google.cloud.firestore.DocumentReference subRef : subcollections) {
                                        Query q = subRef.collection("products").whereEqualTo("productCode", productCode).limit(1);
                                        List<QueryDocumentSnapshot> docs = q.get().get().getDocuments();
                                        if (!docs.isEmpty()) {
                                            docs.get(0).getReference().update(
                                                    "variations", kiyuziyuProduct.getVariations(),
                                                    "quantity", kiyuziyuProduct.getQuantity()
                                            ).get();
                                            log.info("Firebase inventory updated for {} via fallback", productCode);
                                            found = true;
                                            break;
                                        }
                                    }
                                    if (found) break;
                                }
                            }
                        }
                    } catch (Exception e) {
                        log.warn("Failed to deduct inventory for SKU {}: {}", sku, e.getMessage());
                    }
                    // ==========================================
                }
            }

            if (kiyuziyuItems.isEmpty()) {
                log.info("[ShopifyOrderWebhook] Order #{} has no Kiyuziyu products. Ignoring.", orderNumber);
                return;
            }

            // Create and save TenantOrder
            TenantOrder order = new TenantOrder();
            order.setOrderId(UUID.randomUUID().toString());
            order.setTenantId(tenantId);
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
            order.setStatus("NEW");
            order.setCreatedAt(Instant.now().toString());

            tenantOrderRepository.save(order);
            log.info("[ShopifyOrderWebhook] Successfully saved Kiyuziyu Order {} with {} items.", order.getOrderId(), kiyuziyuItems.size());

        } catch (Exception e) {
            log.error("[ShopifyOrderWebhook] Error processing order payload: {}", e.getMessage(), e);
        }
    }
}
