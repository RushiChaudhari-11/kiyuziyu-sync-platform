package com.kiyuziyu.api.dto;

import java.util.List;
import java.util.Map;

public class ProductResponse {
    private String productId;
    private String productCode;
    private String productName;
    private String description;
    private Double basePrice;
    private Double sellingPrice;
    private Integer stock;
    private Boolean availability;
    private String image;
    private List<Object> images;
    private List<String> tags;
    private String collectionId;
    private String subcollectionId;
    private Object quantity;
    private Object initialQuantity;
    private List<Map<String, Object>> variations;
    private Map<String, Object> collectionData;
    private Map<String, Object> subcollectionData;

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

    public ProductResponse() {
    }

    public String getProductId() {
        return productId;
    }

    public void setProductId(String productId) {
        this.productId = productId;
    }

    public String getProductCode() {
        return productCode;
    }

    public void setProductCode(String productCode) {
        this.productCode = productCode;
    }

    public String getProductName() {
        return productName;
    }

    public void setProductName(String productName) {
        this.productName = productName;
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

    public Double getSellingPrice() {
        return sellingPrice;
    }

    public void setSellingPrice(Double sellingPrice) {
        this.sellingPrice = sellingPrice;
    }

    public Integer getStock() {
        return stock;
    }

    public void setStock(Integer stock) {
        this.stock = stock;
    }

    public Boolean getAvailability() {
        return availability;
    }

    public void setAvailability(Boolean availability) {
        this.availability = availability;
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

    public List<Map<String, Object>> getVariations() {
        return variations;
    }

    public void setVariations(List<Map<String, Object>> variations) {
        this.variations = variations;
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
