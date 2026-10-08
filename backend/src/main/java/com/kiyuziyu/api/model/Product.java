package com.kiyuziyu.api.model;

import java.util.List;
import java.util.Map;

public class Product {
    private String id;
    private String productName;
    private String productCode;
    private Object quantity;
    private Object initialQuantity;
    private String image;
    private List<Object> images;
    private List<String> tags;
    private List<Map<String, Object>> variations;
    private Object purchaseRate;

    // Computed or fetched from subcollection
    private String collectionId;
    private String subcollectionId;
    private String description;
    private Double basePrice;

    // Raw Firestore document data for parent documents
    private Map<String, Object> collectionData;
    private Map<String, Object> subcollectionData;

    public Product() {
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getProductName() {
        return productName;
    }

    public void setProductName(String productName) {
        this.productName = productName;
    }

    public String getProductCode() {
        return productCode;
    }

    public void setProductCode(String productCode) {
        this.productCode = productCode;
    }

    public Object getQuantity() {
        return quantity;
    }

    public void setQuantity(Object quantity) {
        this.quantity = quantity;
    }

    public Object getInitialQuantity() {
        return initialQuantity;
    }

    public void setInitialQuantity(Object initialQuantity) {
        this.initialQuantity = initialQuantity;
    }

    public String getImage() {
        return image;
    }

    public void setImage(String image) {
        this.image = image;
    }

    public List<Object> getImages() {
        return images;
    }

    public void setImages(List<Object> images) {
        this.images = images;
    }

    public List<String> getTags() {
        return tags;
    }

    public void setTags(List<String> tags) {
        this.tags = tags;
    }

    public List<Map<String, Object>> getVariations() {
        return variations;
    }

    public void setVariations(List<Map<String, Object>> variations) {
        this.variations = variations;
    }

    public Object getPurchaseRate() {
        return purchaseRate;
    }

    public void setPurchaseRate(Object purchaseRate) {
        this.purchaseRate = purchaseRate;
    }

    public Double getEffectivePurchaseRate() {
        Object rate = purchaseRate;
        if (rate == null && subcollectionData != null && subcollectionData.containsKey("purchaseRate")) {
            rate = subcollectionData.get("purchaseRate");
        }
        if (rate == null) return 0.0;
        if (rate instanceof Number) return ((Number) rate).doubleValue();
        if (rate instanceof String) {
            try { return Double.parseDouble((String) rate); } catch (Exception e) { return 0.0; }
        }
        return 0.0;
    }

    public String getCollectionId() {
        return collectionId;
    }

    public void setCollectionId(String collectionId) {
        this.collectionId = collectionId;
    }

    public String getSubcollectionId() {
        return subcollectionId;
    }

    public void setSubcollectionId(String subcollectionId) {
        this.subcollectionId = subcollectionId;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public Double getBasePrice() {
        return basePrice;
    }

    public void setBasePrice(Double basePrice) {
        this.basePrice = basePrice;
    }

    public Map<String, Object> getCollectionData() {
        return collectionData;
    }

    public void setCollectionData(Map<String, Object> collectionData) {
        this.collectionData = collectionData;
    }

    public Map<String, Object> getSubcollectionData() {
        return subcollectionData;
    }

    public void setSubcollectionData(Map<String, Object> subcollectionData) {
        this.subcollectionData = subcollectionData;
    }
}
