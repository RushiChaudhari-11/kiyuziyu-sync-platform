package com.kiyuziyu.api.controller;

import com.google.cloud.firestore.DocumentReference;
import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.kiyuziyu.api.integration.shopify.ShopifyContextHolder;
import com.kiyuziyu.api.model.Product;
import com.kiyuziyu.api.model.ShopifyConnection;
import com.kiyuziyu.api.model.ShopifyProductMapping;
import com.kiyuziyu.api.repository.ProductRepository;
import com.kiyuziyu.api.repository.ShopifyConnectionRepository;
import com.kiyuziyu.api.repository.ShopifyProductMappingRepository;
import com.kiyuziyu.api.service.RealtimeStockListener;
import com.kiyuziyu.api.service.ShopifyProductService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.*;

@RestController
@RequestMapping("/api/v1/tenants/orders")
@CrossOrigin(origins = "*")
public class TenantOrderController {

    private static final Logger log = LoggerFactory.getLogger(TenantOrderController.class);

    @Autowired
    private Firestore firestore;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private ShopifyProductMappingRepository shopifyProductMappingRepository;

    @Autowired
    private ShopifyConnectionRepository shopifyConnectionRepository;

    @Autowired
    private ShopifyProductService shopifyProductService;

    @Autowired
    private com.kiyuziyu.api.integration.shopify.ShopifyGraphQLClient shopifyGraphQLClient;

    @Autowired
    private com.kiyuziyu.api.service.ShopifyOrderWebhookService orderWebhookService;

    @Autowired
    private com.kiyuziyu.api.repository.TenantOrderRepository tenantOrderRepository;

    @PostMapping("/{orderId}/cancel-and-restore")
    public ResponseEntity<Map<String, Object>> cancelAndRestoreOrder(@PathVariable String orderId) {
        Map<String, Object> response = new HashMap<>();
        try {
            if (firestore == null || orderId == null || orderId.trim().isEmpty()) {
                response.put("success", false);
                response.put("message", "Invalid order ID or Firestore unavailable");
                return ResponseEntity.badRequest().body(response);
            }

            DocumentReference orderRef = firestore.collection("apiTenantOrders").document(orderId.trim());
            DocumentSnapshot orderSnap = orderRef.get().get();
            if (!orderSnap.exists()) {
                response.put("success", false);
                response.put("message", "Order not found");
                return ResponseEntity.status(404).body(response);
            }

            Map<String, Object> orderData = orderSnap.getData();
            Boolean alreadyRestored = orderData != null && Boolean.TRUE.equals(orderData.get("inventoryRestored"));

            int unitsRestored = 0;
            if (!alreadyRestored && orderData != null && orderData.get("items") instanceof List) {
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> items = (List<Map<String, Object>>) orderData.get("items");
                for (Map<String, Object> item : items) {
                    String productId = item.get("productId") != null ? String.valueOf(item.get("productId")) : null;
                    String productCode = item.get("productCode") != null ? String.valueOf(item.get("productCode")) : null;
                    String variantName = item.get("variantName") != null ? String.valueOf(item.get("variantName")) : null;
                    String collectionId = item.get("collectionId") != null ? String.valueOf(item.get("collectionId")) : null;
                    String subcollectionId = item.get("subcollectionId") != null ? String.valueOf(item.get("subcollectionId")) : null;
                    int qty = 1;
                    if (item.get("quantity") instanceof Number) {
                        qty = ((Number) item.get("quantity")).intValue();
                    }

                    String sku = item.get("sku") != null ? String.valueOf(item.get("sku")).trim() : null;
                    String variantId = item.get("variantId") != null ? String.valueOf(item.get("variantId")).trim() : null;

                    // Find product
                    Product p = null;
                    if (collectionId != null && subcollectionId != null && productId != null) {
                        // Direct path available
                    } else if (productId != null && !productId.trim().isEmpty()) {
                        p = productRepository.findByDocumentId(productId.trim());
                    } else if (productCode != null && !productCode.trim().isEmpty()) {
                        p = productRepository.findById(productCode.trim());
                    }

                    String colId = collectionId != null ? collectionId : (p != null ? p.getCollectionId() : null);
                    String subId = subcollectionId != null ? subcollectionId : (p != null ? p.getSubcollectionId() : null);
                    String pId = productId != null ? productId : (p != null ? p.getId() : null);

                    if (colId != null && subId != null && pId != null) {
                        DocumentReference pRef = firestore.collection("collections").document(colId)
                                .collection("subcollections").document(subId)
                                .collection("products").document(pId);
                        DocumentSnapshot pDoc = pRef.get().get();
                        if (pDoc.exists()) {
                            Map<String, Object> pData = pDoc.getData();
                            boolean updated = false;
                            Map<String, Object> updates = new HashMap<>();

                            if (pData != null && pData.get("variations") instanceof List) {
                                @SuppressWarnings("unchecked")
                                List<Map<String, Object>> variations = (List<Map<String, Object>>) pData.get("variations");
                                List<Map<String, Object>> newVariations = new ArrayList<>();
                                
                                int targetIdx = -1;
                                if (sku != null && sku.contains("-")) {
                                    try {
                                        int parsedIdx = Integer.parseInt(sku.substring(sku.lastIndexOf('-') + 1).trim()) - 1;
                                        if (parsedIdx >= 0 && parsedIdx < variations.size()) {
                                            targetIdx = parsedIdx;
                                        }
                                    } catch (Exception ignored) {}
                                }

                                int totalVarStock = 0;
                                for (int i = 0; i < variations.size(); i++) {
                                    Map<String, Object> v = variations.get(i);
                                    Map<String, Object> vCopy = new HashMap<>(v);
                                    String vColor = vCopy.get("color") != null ? String.valueOf(vCopy.get("color")).trim() : "";
                                    String vName = vCopy.get("name") != null ? String.valueOf(vCopy.get("name")).trim() : "";
                                    String vVariantName = vCopy.get("variantName") != null ? String.valueOf(vCopy.get("variantName")).trim() : "";
                                    String vTitle = vCopy.get("title") != null ? String.valueOf(vCopy.get("title")).trim() : "";
                                    String vSize = vCopy.get("size") != null ? String.valueOf(vCopy.get("size")).trim() : "";
                                    String vSku = vCopy.get("sku") != null ? String.valueOf(vCopy.get("sku")).trim() : "";
                                    String vVarId = vCopy.get("variantId") != null ? String.valueOf(vCopy.get("variantId")).trim() : (vCopy.get("shopifyVariantId") != null ? String.valueOf(vCopy.get("shopifyVariantId")).trim() : "");

                                    boolean isMatch = false;
                                    if (targetIdx == i) {
                                        isMatch = true;
                                    } else if (variantId != null && !variantId.isEmpty() && !vVarId.isEmpty() && variantId.equalsIgnoreCase(vVarId)) {
                                        isMatch = true;
                                    } else if (sku != null && !sku.isEmpty() && !vSku.isEmpty() && sku.equalsIgnoreCase(vSku)) {
                                        isMatch = true;
                                    } else if (variantName != null && !variantName.isEmpty()) {
                                        String vn = variantName.trim();
                                        if (vn.equalsIgnoreCase(vColor) ||
                                            vn.equalsIgnoreCase(vName) ||
                                            vn.equalsIgnoreCase(vVariantName) ||
                                            vn.equalsIgnoreCase(vTitle) ||
                                            vn.equalsIgnoreCase(vSize) ||
                                            (!vSize.isEmpty() && (vn.toLowerCase().contains(vSize.toLowerCase()) || vSize.toLowerCase().contains(vn.toLowerCase()))) ||
                                            (!vColor.isEmpty() && (vn.toLowerCase().contains(vColor.toLowerCase()) || vColor.toLowerCase().contains(vn.toLowerCase())))) {
                                            isMatch = true;
                                        }
                                    }

                                    int curQ = 0;
                                    if (vCopy.get("quantity") instanceof Number) curQ = ((Number) vCopy.get("quantity")).intValue();
                                    else if (vCopy.get("initialQuantity") instanceof Number) curQ = ((Number) vCopy.get("initialQuantity")).intValue();

                                    if (isMatch && !updated) {
                                        int newQ = curQ + qty;
                                        vCopy.put("quantity", newQ);
                                        updated = true;
                                        unitsRestored += qty;
                                        totalVarStock += newQ;
                                        log.info("[CancelOrder] Restored variant {} stock {} -> {}", (variantName != null ? variantName : "idx=" + i), curQ, newQ);
                                    } else {
                                        totalVarStock += curQ;
                                    }
                                    newVariations.add(vCopy);
                                }
                                if (updated) {
                                    updates.put("variations", newVariations);
                                    updates.put("quantity", totalVarStock);
                                }
                            }

                            if (!updated && pData != null && pData.containsKey("quantity")) {
                                int curQ = 0;
                                if (pData.get("quantity") instanceof Number) curQ = ((Number) pData.get("quantity")).intValue();
                                updates.put("quantity", curQ + qty);
                                updated = true;
                                unitsRestored += qty;
                            }

                            if (updated) {
                                RealtimeStockListener.suppressLoop(pId);
                                if (productCode != null) RealtimeStockListener.suppressLoop(productCode);
                                pRef.update(updates).get();
                                log.info("[CancelOrder] Successfully updated product {} in Firestore", pId);

                                // Synchronize restored inventory back to the merchant's Shopify store
                                try {
                                    String tenantId = orderData.get("tenantId") != null ? String.valueOf(orderData.get("tenantId")) : null;
                                    Product restoredProduct = productRepository.findByDocumentId(pId);
                                    if (restoredProduct == null) {
                                        restoredProduct = productRepository.findById(pId);
                                    }
                                    if (restoredProduct != null && tenantId != null) {
                                        List<ShopifyProductMapping> mappings = shopifyProductMappingRepository.findAllByTenant(tenantId);
                                        for (ShopifyProductMapping mapping : mappings) {
                                            if ((pId.equals(mapping.getProductId()) || (productCode != null && productCode.equals(mapping.getProductCode())))
                                                    && mapping.getShopifyProductId() != null && mapping.getConnectionId() != null) {
                                                ShopifyConnection conn = shopifyConnectionRepository.findById(mapping.getConnectionId());
                                                if (conn != null && conn.getShopifyStoreDomain() != null) {
                                                    ShopifyContextHolder.setContext(conn.getShopifyStoreDomain());
                                                    try {
                                                        shopifyProductService.syncInventoryOnly(tenantId, mapping.getShopifyProductId(), restoredProduct);
                                                        log.info("[CancelOrder] Successfully synced restored inventory to Shopify store {} for product {}",
                                                                conn.getShopifyStoreDomain(), pId);
                                                    } finally {
                                                        ShopifyContextHolder.clearContext();
                                                    }
                                                }
                                            }
                                        }
                                    }
                                } catch (Exception syncEx) {
                                    log.warn("[CancelOrder] Could not sync restored inventory to Shopify for product {}: {}", pId, syncEx.getMessage());
                                }
                            }
                        }
                    }
                }
            }

            // Update order doc
            Map<String, Object> orderUpdates = new HashMap<>();
            orderUpdates.put("status", "Cancelled");
            orderUpdates.put("inventoryRestored", true);
            orderUpdates.put("updatedAt", Instant.now().toString());
            orderRef.update(orderUpdates).get();

            response.put("success", true);
            response.put("restoredUnits", unitsRestored);
            response.put("message", "Order cancelled and inventory restored successfully");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Failed to cancel and restore order {}: {}", orderId, e.getMessage(), e);
            response.put("success", false);
            response.put("message", e.getMessage());
            return ResponseEntity.status(500).body(response);
        }
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> getTenantOrders(
            @RequestParam(value = "tenantId", required = false) String tenantId) {
        Map<String, Object> response = new HashMap<>();
        try {
            List<com.kiyuziyu.api.model.TenantOrder> orders;
            if (tenantId != null && !tenantId.trim().isEmpty()) {
                orders = tenantOrderRepository.findByTenantId(tenantId.trim());
            } else {
                orders = new ArrayList<>();
                com.google.cloud.firestore.QuerySnapshot snap = firestore.collection(com.kiyuziyu.api.repository.TenantOrderRepository.COLLECTION_NAME).get().get();
                for (com.google.cloud.firestore.QueryDocumentSnapshot doc : snap.getDocuments()) {
                    com.kiyuziyu.api.model.TenantOrder o = doc.toObject(com.kiyuziyu.api.model.TenantOrder.class);
                    if (o != null) {
                        if (o.getOrderId() == null) o.setOrderId(doc.getId());
                        orders.add(o);
                    }
                }
            }
            response.put("success", true);
            response.put("orders", orders);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Failed to get tenant orders: {}", e.getMessage(), e);
            response.put("success", false);
            response.put("message", e.getMessage());
            return ResponseEntity.status(500).body(response);
        }
    }

    @GetMapping("/{orderId}")
    public ResponseEntity<Map<String, Object>> getTenantOrderById(@PathVariable String orderId) {
        Map<String, Object> response = new HashMap<>();
        try {
            DocumentSnapshot doc = firestore.collection(com.kiyuziyu.api.repository.TenantOrderRepository.COLLECTION_NAME).document(orderId.trim()).get().get();
            if (!doc.exists()) {
                response.put("success", false);
                response.put("message", "Order not found");
                return ResponseEntity.status(404).body(response);
            }
            com.kiyuziyu.api.model.TenantOrder o = doc.toObject(com.kiyuziyu.api.model.TenantOrder.class);
            if (o != null && o.getOrderId() == null) o.setOrderId(doc.getId());
            response.put("success", true);
            response.put("order", o);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Failed to get order {}: {}", orderId, e.getMessage(), e);
            response.put("success", false);
            response.put("message", e.getMessage());
            return ResponseEntity.status(500).body(response);
        }
    }

    @PostMapping("/reconcile-shopify-orders")
    public ResponseEntity<Map<String, Object>> reconcileShopifyOrders(
            @RequestParam(value = "shop", required = false) String shopDomain) {
        Map<String, Object> response = new HashMap<>();
        String domain = shopDomain != null && !shopDomain.trim().isEmpty() ? shopDomain.trim() : "kiyuziyu-test-store.myshopify.com";
        ShopifyConnection connection = shopifyConnectionRepository.findByShopifyStoreDomain(domain);
        if (connection == null) {
            response.put("success", false);
            response.put("message", "Connection not found for domain: " + domain);
            return ResponseEntity.badRequest().body(response);
        }

        String tenantId = connection.getTenantId();
        ShopifyContextHolder.setContext(domain);
        try {
            List<Map<String, Object>> recentOrders = shopifyGraphQLClient.getRecentShopifyOrders(30);
            List<String> imported = new ArrayList<>();
            List<String> skipped = new ArrayList<>();

            for (Map<String, Object> node : recentOrders) {
                String rawId = (String) node.get("id");
                String numericId = rawId != null ? rawId.replaceAll("\\D+", "") : "";
                String name = (String) node.get("name");
                String orderNumber = name != null ? name.replace("#", "").trim() : numericId;



                Map<String, Object> payload = new HashMap<>();
                payload.put("id", numericId);
                payload.put("order_number", orderNumber);
                payload.put("created_at", node.get("createdAt"));
                payload.put("note", node.get("note"));

                String financialStatus = String.valueOf(node.get("displayFinancialStatus")).toLowerCase();
                payload.put("financial_status", financialStatus.contains("paid") ? "paid" : "pending");

                if (node.get("customer") instanceof Map) {
                    payload.put("customer", node.get("customer"));
                }
                if (node.get("shippingAddress") instanceof Map) {
                    payload.put("shipping_address", node.get("shippingAddress"));
                }
                if (node.get("billingAddress") instanceof Map) {
                    payload.put("billing_address", node.get("billingAddress"));
                }

                List<Map<String, Object>> lineItemsList = new ArrayList<>();
                if (node.get("lineItems") instanceof Map) {
                    Map<String, Object> liMap = (Map<String, Object>) node.get("lineItems");
                    if (liMap.get("edges") instanceof List) {
                        List<Map<String, Object>> edges = (List<Map<String, Object>>) liMap.get("edges");
                        for (Map<String, Object> edge : edges) {
                            if (edge.get("node") instanceof Map) {
                                Map<String, Object> liNode = (Map<String, Object>) edge.get("node");
                                Map<String, Object> item = new HashMap<>();
                                item.put("title", liNode.get("title"));
                                item.put("quantity", liNode.get("quantity"));
                                item.put("sku", liNode.get("sku"));

                                if (liNode.get("originalUnitPriceSet") instanceof Map) {
                                    Map<String, Object> priceSet = (Map<String, Object>) liNode.get("originalUnitPriceSet");
                                    if (priceSet.get("shopMoney") instanceof Map) {
                                        Map<String, Object> sm = (Map<String, Object>) priceSet.get("shopMoney");
                                        item.put("price", sm.get("amount"));
                                    }
                                }
                                if (liNode.get("variant") instanceof Map) {
                                    Map<String, Object> vNode = (Map<String, Object>) liNode.get("variant");
                                    item.put("variant_title", vNode.get("title"));
                                    if (vNode.get("id") != null) {
                                        item.put("variant_id", String.valueOf(vNode.get("id")).replaceAll("\\D+", ""));
                                    }
                                    if (item.get("sku") == null || ((String) item.get("sku")).trim().isEmpty()) {
                                        item.put("sku", vNode.get("sku"));
                                    }
                                }
                                if (liNode.get("product") instanceof Map) {
                                    Map<String, Object> pNode = (Map<String, Object>) liNode.get("product");
                                    if (pNode != null && pNode.get("id") != null) {
                                        item.put("product_id", String.valueOf(pNode.get("id")).replaceAll("\\D+", ""));
                                    }
                                }
                                lineItemsList.add(item);
                            }
                        }
                    }
                }
                payload.put("line_items", lineItemsList);

                orderWebhookService.processOrderWebhook(tenantId, domain, payload);
                imported.add(orderNumber);
            }

            response.put("success", true);
            response.put("importedCount", imported.size());
            response.put("importedOrders", imported);
            response.put("skippedCount", skipped.size());
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("[ReconcileOrders] Error reconciling Shopify orders: {}", e.getMessage(), e);
            response.put("success", false);
            response.put("message", e.getMessage());
            return ResponseEntity.status(500).body(response);
        } finally {
            ShopifyContextHolder.clearContext();
        }
    }
}
