package com.kiyuziyu.api.service;

import com.google.cloud.Timestamp;
import com.google.cloud.firestore.DocumentReference;
import com.google.cloud.firestore.DocumentSnapshot;
import com.kiyuziyu.api.dto.*;
import com.kiyuziyu.api.exception.BadRequestException;
import com.kiyuziyu.api.exception.ConflictException;
import com.kiyuziyu.api.exception.NotFoundException;
import com.kiyuziyu.api.model.*;
import com.kiyuziyu.api.repository.ClientProductOverrideRepository;
import com.kiyuziyu.api.repository.OrderRepository;
import com.kiyuziyu.api.repository.ProductRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.concurrent.ExecutionException;

@Service
public class OrderService {

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private ClientProductOverrideRepository overrideRepository;

    public OrderResponse createOrder(String clientId, String idempotencyKey, OrderRequest request) throws ExecutionException, InterruptedException {
        String idempotencyId = clientId + "_" + idempotencyKey;

        // 1. Check idempotency
        OrderIdempotency existingIdempotency = orderRepository.findIdempotency(idempotencyId);
        if (existingIdempotency != null) {
            Order existingOrder = orderRepository.findById(existingIdempotency.getOrderId());
            if (existingOrder != null) {
                return mapToResponse(existingOrder);
            }
        }

        // 2. Pre-fetch master product references and overrides
        Map<String, DocumentReference> productRefs = new HashMap<>();
        Map<String, Product> productSnapshots = new HashMap<>();
        Map<String, ClientProductOverride> overrides = new HashMap<>();

        for (OrderItemRequest itemReq : request.getItems()) {
            String pCode = itemReq.getProductCode();
            Product masterProduct = productRepository.findById(pCode);
            if (masterProduct == null) {
                throw new NotFoundException("Product not found: " + pCode);
            }
            if (masterProduct.getCollectionId() == null || masterProduct.getSubcollectionId() == null) {
                throw new BadRequestException("Product data incomplete for: " + pCode);
            }
            DocumentReference ref = orderRepository.getProductRef(masterProduct.getCollectionId(), masterProduct.getSubcollectionId(), masterProduct.getId());
            productRefs.put(pCode, ref);
            productSnapshots.put(pCode, masterProduct);

            ClientProductOverride override = overrideRepository.findByClientAndProduct(clientId, pCode);
            if (override == null || !Boolean.TRUE.equals(override.getEnabled()) || override.getSellingPrice() == null) {
                throw new BadRequestException("Client not authorized for product or missing price override: " + pCode);
            }
            overrides.put(pCode, override);
        }

        // 3. Transaction
        Order createdOrder = orderRepository.runTransaction(transaction -> {
            
            // Check idempotency again inside transaction
            DocumentReference idemRef = orderRepository.getIdempotencyRef(idempotencyId);
            DocumentSnapshot idemSnap = transaction.get(idemRef).get();
            if (idemSnap.exists()) {
                throw new ConflictException("Idempotency key already processed. Retry the request."); // Spring MVC will handle this safely
            }

            // Check externalOrderId constraint
            DocumentReference extIdRef = orderRepository.getExternalIdRef(clientId, request.getExternalOrderId());
            DocumentSnapshot extIdSnap = transaction.get(extIdRef).get();
            if (extIdSnap.exists()) {
                throw new ConflictException("Order with this externalOrderId already exists for this client.");
            }

            String newOrderId = UUID.randomUUID().toString();
            Order newOrder = new Order();
            newOrder.setOrderId(newOrderId);
            newOrder.setExternalOrderId(request.getExternalOrderId());
            newOrder.setClientId(clientId);
            newOrder.setStatus("NEW");
            newOrder.setCreatedAt(Timestamp.now());
            newOrder.setUpdatedAt(Timestamp.now());

            List<OrderItem> orderItems = new ArrayList<>();
            BigDecimal orderTotal = BigDecimal.ZERO;

            for (OrderItemRequest itemReq : request.getItems()) {
                String pCode = itemReq.getProductCode();
                DocumentReference pRef = productRefs.get(pCode);
                DocumentSnapshot pSnap = transaction.get(pRef).get();
                if (!pSnap.exists()) {
                    throw new NotFoundException("Product missing during transaction: " + pCode);
                }

                ClientProductOverride override = overrides.get(pCode);

                // Verify selling price
                double authorizedPrice = override.getSellingPrice();
                if (Math.abs(authorizedPrice - itemReq.getSellingPrice()) > 0.01) {
                    throw new BadRequestException("Unauthorized selling price for product: " + pCode);
                }

                // Verify stock and decrement
                decrementStock(pSnap, itemReq, transaction, pRef);

                // Build Item Snapshot
                OrderItem orderItem = new OrderItem();
                orderItem.setProductId(pSnap.getId());
                orderItem.setProductCode(pCode);
                orderItem.setProductName(override.getCustomProductName() != null && !override.getCustomProductName().isEmpty() ? override.getCustomProductName() : pSnap.getString("productName"));
                
                Double basePrice = productSnapshots.get(pCode).getBasePrice();
                orderItem.setBasePrice(basePrice != null ? basePrice : 0.0);
                orderItem.setSellingPrice(authorizedPrice);
                orderItem.setQuantity(itemReq.getQuantity());
                
                BigDecimal itemLineTotal = BigDecimal.valueOf(authorizedPrice).multiply(BigDecimal.valueOf(itemReq.getQuantity()));
                orderItem.setLineTotal(itemLineTotal.setScale(2, RoundingMode.HALF_UP).doubleValue());
                orderItem.setColor(itemReq.getColor());
                orderItem.setSize(itemReq.getSize());
                orderItems.add(orderItem);

                orderTotal = orderTotal.add(itemLineTotal);
            }

            newOrder.setItems(orderItems);
            newOrder.setOrderTotal(orderTotal.setScale(2, RoundingMode.HALF_UP).doubleValue());
            
            Customer cust = new Customer();
            cust.setName(request.getCustomer().getName());
            cust.setEmail(request.getCustomer().getEmail());
            cust.setPhone(request.getCustomer().getPhone());
            newOrder.setCustomer(cust);

            ShippingAddress ship = new ShippingAddress();
            ship.setAddressLine1(request.getShippingAddress().getAddressLine1());
            ship.setAddressLine2(request.getShippingAddress().getAddressLine2());
            ship.setCity(request.getShippingAddress().getCity());
            ship.setState(request.getShippingAddress().getState());
            ship.setPostalCode(request.getShippingAddress().getPostalCode());
            ship.setCountry(request.getShippingAddress().getCountry());
            newOrder.setShippingAddress(ship);

            // Save order
            DocumentReference orderRef = orderRepository.getOrderRef(newOrderId);
            transaction.set(orderRef, newOrder);

            // Save idempotency
            OrderIdempotency newIdem = new OrderIdempotency();
            newIdem.setIdempotencyId(idempotencyId);
            newIdem.setOrderId(newOrderId);
            newIdem.setCreatedAt(Timestamp.now());
            transaction.set(idemRef, newIdem);

            // Save externalOrderId lock
            Map<String, Object> extLock = new HashMap<>();
            extLock.put("orderId", newOrderId);
            extLock.put("createdAt", Timestamp.now());
            transaction.set(extIdRef, extLock);

            return newOrder;
        });

        return mapToResponse(createdOrder);
    }

    public OrderResponse getOrderById(String clientId, String orderId) throws ExecutionException, InterruptedException {
        Order order = orderRepository.findById(orderId);
        if (order == null || !order.getClientId().equals(clientId)) {
            throw new NotFoundException("Order not found");
        }
        return mapToResponse(order);
    }

    public PaginatedOrderResponse getOrders(String clientId, int page, int limit) throws ExecutionException, InterruptedException {
        int offset = (page - 1) * limit;
        List<Order> orders = orderRepository.findByClientId(clientId, limit + 1, offset); // Fetch 1 extra to check hasNext
        
        boolean hasNext = orders.size() > limit;
        if (hasNext) {
            orders.remove(orders.size() - 1);
        }

        List<OrderResponse> responseList = new ArrayList<>();
        for (Order o : orders) {
            responseList.add(mapToResponse(o));
        }

        return new PaginatedOrderResponse(true, responseList, page, limit, responseList.size(), hasNext);
    }

    public OrderResponse updateOrderStatus(String clientId, String orderId, String newStatus) throws ExecutionException, InterruptedException {
        List<String> validStatuses = Arrays.asList("NEW", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED");
        if (!validStatuses.contains(newStatus)) {
            throw new BadRequestException("Invalid status: " + newStatus);
        }

        Order order = orderRepository.runTransaction(transaction -> {
            DocumentReference orderRef = orderRepository.getOrderRef(orderId);
            DocumentSnapshot snap = transaction.get(orderRef).get();
            if (!snap.exists()) {
                throw new NotFoundException("Order not found");
            }
            
            Order o = snap.toObject(Order.class);
            if (!o.getClientId().equals(clientId)) {
                throw new NotFoundException("Order not found");
            }

            // Transition rules
            String current = o.getStatus();
            boolean valid = false;
            if (newStatus.equals("CANCELLED")) {
                valid = current.equals("NEW") || current.equals("CONFIRMED") || current.equals("PROCESSING");
            } else if (current.equals("NEW") && newStatus.equals("CONFIRMED")) valid = true;
            else if (current.equals("CONFIRMED") && newStatus.equals("PROCESSING")) valid = true;
            else if (current.equals("PROCESSING") && newStatus.equals("SHIPPED")) valid = true;
            else if (current.equals("SHIPPED") && newStatus.equals("DELIVERED")) valid = true;

            if (!valid) {
                throw new ConflictException("Invalid status transition from " + current + " to " + newStatus);
            }

            if (newStatus.equals("CANCELLED")) {
                throw new ConflictException("Use the explicit /cancel endpoint to cancel orders");
            }

            o.setStatus(newStatus);
            o.setUpdatedAt(Timestamp.now());
            transaction.set(orderRef, o);
            return o;
        });

        return mapToResponse(order);
    }

    public OrderResponse cancelOrder(String clientId, String orderId) throws ExecutionException, InterruptedException {
        // Pre-fetch the order to get the product codes
        Order preOrder = orderRepository.findById(orderId);
        if (preOrder == null || !preOrder.getClientId().equals(clientId)) {
            throw new NotFoundException("Order not found");
        }

        Map<String, DocumentReference> productRefs = new HashMap<>();
        for (OrderItem item : preOrder.getItems()) {
            Product p = productRepository.findById(item.getProductCode());
            if (p != null) {
                DocumentReference pRef = orderRepository.getProductRef(p.getCollectionId(), p.getSubcollectionId(), p.getId());
                productRefs.put(item.getProductCode(), pRef);
            }
        }

        Order order = orderRepository.runTransaction(transaction -> {
            DocumentReference orderRef = orderRepository.getOrderRef(orderId);
            DocumentSnapshot snap = transaction.get(orderRef).get();
            if (!snap.exists()) {
                throw new NotFoundException("Order not found");
            }
            
            Order o = snap.toObject(Order.class);
            if (!o.getClientId().equals(clientId)) {
                throw new NotFoundException("Order not found");
            }

            String current = o.getStatus();
            if (current.equals("CANCELLED")) {
                throw new ConflictException("Order is already cancelled");
            }
            if (current.equals("SHIPPED") || current.equals("DELIVERED")) {
                throw new ConflictException("Cannot cancel order in status: " + current);
            }

            // 1. Fetch products and increment stock
            for (OrderItem item : o.getItems()) {
                DocumentReference pRef = productRefs.get(item.getProductCode());
                if (pRef != null) {
                    DocumentSnapshot pSnap = transaction.get(pRef).get();
                    if (pSnap.exists()) {
                        incrementStock(pSnap, item, transaction, pRef);
                    }
                }
            }

            o.setStatus("CANCELLED");
            o.setUpdatedAt(Timestamp.now());
            transaction.set(orderRef, o);
            return o;
        });

        return mapToResponse(order);
    }

    // --- STOCK LOGIC ---

    @SuppressWarnings("unchecked")
    private void decrementStock(DocumentSnapshot pSnap, OrderItemRequest itemReq, com.google.cloud.firestore.Transaction transaction, DocumentReference pRef) {
        int reqQty = itemReq.getQuantity();

        List<Map<String, Object>> variations = (List<Map<String, Object>>) pSnap.get("variations");
        if (variations != null && !variations.isEmpty()) {
            boolean found = false;
            
            // Must match color and size exactly
            for (Map<String, Object> var : variations) {
                String vColor = (String) var.get("color");
                String vSize = (String) var.get("size");
                
                boolean colorMatch = normalizeString(vColor).equals(normalizeString(itemReq.getColor()));
                boolean sizeMatch = normalizeString(vSize).equals(normalizeString(itemReq.getSize()));
                
                if (colorMatch && sizeMatch) {
                    long currentStock = getAsLong(var.get("quantity"));
                    if (currentStock < reqQty) throw new ConflictException("Insufficient stock for product variation");
                    var.put("quantity", currentStock - reqQty);
                    found = true;
                    break;
                }
            }
            
            if (!found) {
                throw new BadRequestException("Variation not explicitly identified or mismatched for product: " + pSnap.getId());
            }
            transaction.update(pRef, "variations", variations);
        } else {
            long currentStock = getAsLong(pSnap.get("quantity"));
            if (currentStock < reqQty) throw new ConflictException("Insufficient stock for product: " + pSnap.getId());
            transaction.update(pRef, "quantity", currentStock - reqQty);
        }
    }

    @SuppressWarnings("unchecked")
    private void incrementStock(DocumentSnapshot pSnap, OrderItem item, com.google.cloud.firestore.Transaction transaction, DocumentReference pRef) {
        int returnQty = item.getQuantity();

        List<Map<String, Object>> variations = (List<Map<String, Object>>) pSnap.get("variations");
        if (variations != null && !variations.isEmpty()) {
            boolean found = false;
            
            for (Map<String, Object> var : variations) {
                String vColor = (String) var.get("color");
                String vSize = (String) var.get("size");
                
                boolean colorMatch = normalizeString(vColor).equals(normalizeString(item.getColor()));
                boolean sizeMatch = normalizeString(vSize).equals(normalizeString(item.getSize()));
                
                if (colorMatch && sizeMatch) {
                    long currentStock = getAsLong(var.get("quantity"));
                    var.put("quantity", currentStock + returnQty);
                    found = true;
                    break;
                }
            }
            
            if (found) {
                transaction.update(pRef, "variations", variations);
            }
        } else {
            long currentStock = getAsLong(pSnap.get("quantity"));
            transaction.update(pRef, "quantity", currentStock + returnQty);
        }
    }

    private String normalizeString(String val) {
        return (val == null) ? "" : val.trim();
    }

    private long getAsLong(Object value) {
        if (value instanceof Number) {
            return ((Number) value).longValue();
        } else if (value instanceof String) {
            try {
                return Long.parseLong((String) value);
            } catch (NumberFormatException e) {
                return 0L;
            }
        }
        return 0L;
    }

    // --- MAPPING LOGIC ---

    private OrderResponse mapToResponse(Order order) {
        OrderResponse res = new OrderResponse();
        res.setOrderId(order.getOrderId());
        res.setExternalOrderId(order.getExternalOrderId());
        res.setClientId(order.getClientId());
        res.setClientName(order.getClientName());
        res.setSourceWebsite(order.getSourceWebsite());
        res.setStatus(order.getStatus());
        res.setOrderTotal(order.getOrderTotal());
        res.setCustomer(order.getCustomer());
        res.setShippingAddress(order.getShippingAddress());
        res.setCreatedAt(order.getCreatedAt());
        res.setUpdatedAt(order.getUpdatedAt());

        List<OrderItemResponse> itemResponses = new ArrayList<>();
        for (OrderItem item : order.getItems()) {
            OrderItemResponse ir = new OrderItemResponse();
            ir.setProductId(item.getProductId());
            ir.setProductCode(item.getProductCode());
            ir.setProductName(item.getProductName());
            ir.setBasePrice(item.getBasePrice());
            ir.setSellingPrice(item.getSellingPrice());
            ir.setQuantity(item.getQuantity());
            ir.setLineTotal(item.getLineTotal());
            ir.setColor(item.getColor());
            ir.setSize(item.getSize());
            itemResponses.add(ir);
        }
        res.setItems(itemResponses);

        return res;
    }
}
