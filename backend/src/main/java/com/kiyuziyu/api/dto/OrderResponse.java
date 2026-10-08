package com.kiyuziyu.api.dto;

import com.google.cloud.Timestamp;
import com.kiyuziyu.api.model.Customer;
import com.kiyuziyu.api.model.ShippingAddress;
import java.util.List;

public class OrderResponse {
    private String orderId;
    private String externalOrderId;
    private String clientId;
    private String clientName;
    private String sourceWebsite;
    private String status;
    private List<OrderItemResponse> items;
    private Double orderTotal;
    private Customer customer;
    private ShippingAddress shippingAddress;
    private Timestamp createdAt;
    private Timestamp updatedAt;

    // Getters and Setters
    public String getOrderId() { return orderId; }
    public void setOrderId(String orderId) { this.orderId = orderId; }
    public String getExternalOrderId() { return externalOrderId; }
    public void setExternalOrderId(String externalOrderId) { this.externalOrderId = externalOrderId; }
    public String getClientId() { return clientId; }
    public void setClientId(String clientId) { this.clientId = clientId; }
    public String getClientName() { return clientName; }
    public void setClientName(String clientName) { this.clientName = clientName; }
    public String getSourceWebsite() { return sourceWebsite; }
    public void setSourceWebsite(String sourceWebsite) { this.sourceWebsite = sourceWebsite; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public List<OrderItemResponse> getItems() { return items; }
    public void setItems(List<OrderItemResponse> items) { this.items = items; }
    public Double getOrderTotal() { return orderTotal; }
    public void setOrderTotal(Double orderTotal) { this.orderTotal = orderTotal; }
    public Customer getCustomer() { return customer; }
    public void setCustomer(Customer customer) { this.customer = customer; }
    public ShippingAddress getShippingAddress() { return shippingAddress; }
    public void setShippingAddress(ShippingAddress shippingAddress) { this.shippingAddress = shippingAddress; }
    public Timestamp getCreatedAt() { return createdAt; }
    public void setCreatedAt(Timestamp createdAt) { this.createdAt = createdAt; }
    public Timestamp getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Timestamp updatedAt) { this.updatedAt = updatedAt; }
}
