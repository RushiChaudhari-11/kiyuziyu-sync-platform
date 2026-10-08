package com.kiyuziyu.api.dto.syncjob;

import com.kiyuziyu.api.model.SyncJob;

public class SyncJobResponse {

    private String jobId;
    private String tenantId;
    private String storeId;
    private String connectionId;
    private String jobType;
    private String status;
    private int totalItems;
    private int processedItems;
    private int successItems;
    private int failedItems;
    private String startedAt;
    private String completedAt;
    private String errorMessage;
    private String createdAt;
    private String updatedAt;

    public SyncJobResponse() {
    }

    public SyncJobResponse(SyncJob job) {
        if (job != null) {
            this.jobId = job.getJobId();
            this.tenantId = job.getTenantId();
            this.storeId = job.getStoreId();
            this.connectionId = job.getConnectionId();
            this.jobType = job.getJobType();
            this.status = job.getStatus();
            this.totalItems = job.getTotalItems();
            this.processedItems = job.getProcessedItems();
            this.successItems = job.getSuccessItems();
            this.failedItems = job.getFailedItems();
            this.startedAt = job.getStartedAt();
            this.completedAt = job.getCompletedAt();
            this.errorMessage = job.getErrorMessage();
            this.createdAt = job.getCreatedAt();
            this.updatedAt = job.getUpdatedAt();
        }
    }

    public String getJobId() {
        return jobId;
    }

    public void setJobId(String jobId) {
        this.jobId = jobId;
    }

    public String getTenantId() {
        return tenantId;
    }

    public void setTenantId(String tenantId) {
        this.tenantId = tenantId;
    }

    public String getStoreId() {
        return storeId;
    }

    public void setStoreId(String storeId) {
        this.storeId = storeId;
    }

    public String getConnectionId() {
        return connectionId;
    }

    public void setConnectionId(String connectionId) {
        this.connectionId = connectionId;
    }

    public String getJobType() {
        return jobType;
    }

    public void setJobType(String jobType) {
        this.jobType = jobType;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public int getTotalItems() {
        return totalItems;
    }

    public void setTotalItems(int totalItems) {
        this.totalItems = totalItems;
    }

    public int getProcessedItems() {
        return processedItems;
    }

    public void setProcessedItems(int processedItems) {
        this.processedItems = processedItems;
    }

    public int getSuccessItems() {
        return successItems;
    }

    public void setSuccessItems(int successItems) {
        this.successItems = successItems;
    }

    public int getFailedItems() {
        return failedItems;
    }

    public void setFailedItems(int failedItems) {
        this.failedItems = failedItems;
    }

    public String getStartedAt() {
        return startedAt;
    }

    public void setStartedAt(String startedAt) {
        this.startedAt = startedAt;
    }

    public String getCompletedAt() {
        return completedAt;
    }

    public void setCompletedAt(String completedAt) {
        this.completedAt = completedAt;
    }

    public String getErrorMessage() {
        return errorMessage;
    }

    public void setErrorMessage(String errorMessage) {
        this.errorMessage = errorMessage;
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(String createdAt) {
        this.createdAt = createdAt;
    }

    public String getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(String updatedAt) {
        this.updatedAt = updatedAt;
    }
}
