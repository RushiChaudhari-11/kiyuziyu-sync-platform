package com.kiyuziyu.api.model;

import com.google.cloud.firestore.annotation.DocumentId;
import com.google.cloud.Timestamp;
import java.util.List;

public class ClientProductOverride {
    @DocumentId
    private String overrideId; // clientId_productId
    private String clientId;
    private String productId;
    private String productCode;
    
    // Custom fields
    private String customProductName;
    private String customDescription;
    private String customImage;
    private List<Object> customImages;
    private Double sellingPrice;
    
    private Boolean enabled;
    private Timestamp createdAt;
    private Timestamp updatedAt;

    // Getters and Setters
    public String getOverrideId() { return overrideId; }
    public void setOverrideId(String overrideId) { this.overrideId = overrideId; }
    public String getClientId() { return clientId; }
    public void setClientId(String clientId) { this.clientId = clientId; }
    public String getProductId() { return productId; }
    public void setProductId(String productId) { this.productId = productId; }
    public String getProductCode() { return productCode; }
    public void setProductCode(String productCode) { this.productCode = productCode; }
    public String getCustomProductName() { return customProductName; }
    public void setCustomProductName(String customProductName) { this.customProductName = customProductName; }
    public String getCustomDescription() { return customDescription; }
    public void setCustomDescription(String customDescription) { this.customDescription = customDescription; }
    public String getCustomImage() { return customImage; }
    public void setCustomImage(String customImage) { this.customImage = customImage; }
    public List<Object> getCustomImages() { return customImages; }
    public void setCustomImages(List<Object> customImages) { this.customImages = customImages; }
    public Double getSellingPrice() { return sellingPrice; }
    public void setSellingPrice(Double sellingPrice) { this.sellingPrice = sellingPrice; }
    public Boolean getEnabled() { return enabled; }
    public void setEnabled(Boolean enabled) { this.enabled = enabled; }
    public Timestamp getCreatedAt() { return createdAt; }
    public void setCreatedAt(Timestamp createdAt) { this.createdAt = createdAt; }
    public Timestamp getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Timestamp updatedAt) { this.updatedAt = updatedAt; }
}
