package com.kiyuziyu.api.model;

public class TenantOrderItem {
    private String productId;
    private String productCode;
    private String productName;
    private String variantName;
    private Integer quantity;
    private Double basePrice;
    private Double sellingPrice;
    private Double profit;
    private Double purchasePrice;
    private Double adminProfit;
    private String collectionId;
    private String subcollectionId;
    private String sku;
    private String variantId;

    public TenantOrderItem() {}

    public String getProductId() { return productId; }
    public void setProductId(String productId) { this.productId = productId; }

    public String getProductCode() { return productCode; }
    public void setProductCode(String productCode) { this.productCode = productCode; }

    public String getProductName() { return productName; }
    public void setProductName(String productName) { this.productName = productName; }

    public String getVariantName() { return variantName; }
    public void setVariantName(String variantName) { this.variantName = variantName; }

    public String getSku() { return sku; }
    public void setSku(String sku) { this.sku = sku; }

    public String getVariantId() { return variantId; }
    public void setVariantId(String variantId) { this.variantId = variantId; }

    public Integer getQuantity() { return quantity; }
    public void setQuantity(Integer quantity) { this.quantity = quantity; }

    public Double getBasePrice() { return basePrice; }
    public void setBasePrice(Double basePrice) { this.basePrice = basePrice; }

    public Double getSellingPrice() { return sellingPrice; }
    public void setSellingPrice(Double sellingPrice) { this.sellingPrice = sellingPrice; }

    public Double getProfit() { return profit; }
    public void setProfit(Double profit) { this.profit = profit; }

    public Double getPurchasePrice() { return purchasePrice; }
    public void setPurchasePrice(Double purchasePrice) { this.purchasePrice = purchasePrice; }

    public Double getAdminProfit() { return adminProfit; }
    public void setAdminProfit(Double adminProfit) { this.adminProfit = adminProfit; }

    public String getCollectionId() { return collectionId; }
    public void setCollectionId(String collectionId) { this.collectionId = collectionId; }

    public String getSubcollectionId() { return subcollectionId; }
    public void setSubcollectionId(String subcollectionId) { this.subcollectionId = subcollectionId; }
}
