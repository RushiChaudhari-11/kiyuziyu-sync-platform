package com.kiyuziyu.api.model;

import java.util.List;

public class TenantOrder {
    private String orderId;
    private String tenantId;
    private String storeId;
    private String shopifyOrderId;
    private String orderNumber;
    private String customerName;
    private String customerEmail;
    private Double totalBasePrice;
    private Double totalSellingPrice;
    private Double totalProfit;
    private Double totalPurchasePrice;
    private Double totalAdminProfit;
    private List<TenantOrderItem> items;
    private String status; // e.g. "NEW", "PROCESSING", "COMPLETED"
    private String createdAt;

    public TenantOrder() {}

    public String getOrderId() { return orderId; }
    public void setOrderId(String orderId) { this.orderId = orderId; }

    public String getTenantId() { return tenantId; }
    public void setTenantId(String tenantId) { this.tenantId = tenantId; }

    public String getStoreId() { return storeId; }
    public void setStoreId(String storeId) { this.storeId = storeId; }

    public String getShopifyOrderId() { return shopifyOrderId; }
    public void setShopifyOrderId(String shopifyOrderId) { this.shopifyOrderId = shopifyOrderId; }

    public String getOrderNumber() { return orderNumber; }
    public void setOrderNumber(String orderNumber) { this.orderNumber = orderNumber; }

    public String getCustomerName() { return customerName; }
    public void setCustomerName(String customerName) { this.customerName = customerName; }

    public String getCustomerEmail() { return customerEmail; }
    public void setCustomerEmail(String customerEmail) { this.customerEmail = customerEmail; }

    public Double getTotalBasePrice() { return totalBasePrice; }
    public void setTotalBasePrice(Double totalBasePrice) { this.totalBasePrice = totalBasePrice; }

    public Double getTotalSellingPrice() { return totalSellingPrice; }
    public void setTotalSellingPrice(Double totalSellingPrice) { this.totalSellingPrice = totalSellingPrice; }

    public Double getTotalProfit() { return totalProfit; }
    public void setTotalProfit(Double totalProfit) { this.totalProfit = totalProfit; }

    public Double getTotalPurchasePrice() { return totalPurchasePrice; }
    public void setTotalPurchasePrice(Double totalPurchasePrice) { this.totalPurchasePrice = totalPurchasePrice; }

    public Double getTotalAdminProfit() { return totalAdminProfit; }
    public void setTotalAdminProfit(Double totalAdminProfit) { this.totalAdminProfit = totalAdminProfit; }

    public List<TenantOrderItem> getItems() { return items; }
    public void setItems(List<TenantOrderItem> items) { this.items = items; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
}
