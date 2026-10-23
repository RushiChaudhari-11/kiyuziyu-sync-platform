
package com.kiyuziyu.api.model;

import java.util.ArrayList;
import java.util.List;

public class SyncJob {

    private String jobId;
    private String tenantId;
    private String storeId;
    private String connectionId;
    private String jobType;
    private String status;
    private List<String> productIds = new ArrayList<>();
    private int totalItems;
    private int processedItems;
    private int successItems;
    private int failedItems;
    private String startedAt;
    private String completedAt;
    private String errorMessage;
    private String createdAt;
    private String updatedAt;

    public SyncJob() {
        this.productIds = new ArrayList<>();
    }

    public SyncJob(String jobId, String tenantId, String storeId,
                   String connectionId, String jobType, String status,
                   List<String> productIds, int totalItems,
                   int processedItems, int successItems, int failedItems,
                   String startedAt, String completedAt, String errorMessage,
                   String createdAt, String updatedAt) {

        this.jobId = jobId;
        this.tenantId = tenantId;
        this.storeId = storeId;
        this.connectionId = connectionId;
        this.jobType = jobType;
        this.status = status;
        this.productIds = productIds != null
                ? new ArrayList<>(productIds)
                : new ArrayList<>();
        this.totalItems = totalItems;
        this.processedItems = processedItems;
        this.successItems = successItems;
        this.failedItems = failedItems;
        this.startedAt = startedAt;
        this.completedAt = completedAt;
        this.errorMessage = errorMessage;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public String getJobId() { return jobId; }
    public void setJobId(String jobId) { this.jobId = jobId; }

    public String getTenantId() { return tenantId; }
    public void setTenantId(String tenantId) { this.tenantId = tenantId; }

    public String getStoreId() { return storeId; }
    public void setStoreId(String storeId) { this.storeId = storeId; }

    public String getConnectionId() { return connectionId; }
    public void setConnectionId(String connectionId) { this.connectionId = connectionId; }

    public String getJobType() { return jobType; }
    public void setJobType(String jobType) { this.jobType = jobType; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public List<String> getProductIds() { return productIds; }

    public void setProductIds(List<String> productIds) {
        this.productIds = productIds != null
                ? new ArrayList<>(productIds)
                : new ArrayList<>();
    }

    public int getTotalItems() { return totalItems; }
    public void setTotalItems(int totalItems) { this.totalItems = totalItems; }

    public int getProcessedItems() { return processedItems; }
    public void setProcessedItems(int processedItems) {
        this.processedItems = processedItems;
    }

    public int getSuccessItems() { return successItems; }
    public void setSuccessItems(int successItems) {
        this.successItems = successItems;
    }

    public int getFailedItems() { return failedItems; }
    public void setFailedItems(int failedItems) {
        this.failedItems = failedItems;
    }

    public String getStartedAt() { return startedAt; }
    public void setStartedAt(String startedAt) { this.startedAt = startedAt; }

    public String getCompletedAt() { return completedAt; }
    public void setCompletedAt(String completedAt) {
        this.completedAt = completedAt;
    }

    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) {
        this.errorMessage = errorMessage;
    }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }

    public String getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(String updatedAt) { this.updatedAt = updatedAt; }
}
