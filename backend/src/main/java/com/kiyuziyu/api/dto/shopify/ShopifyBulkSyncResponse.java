package com.kiyuziyu.api.dto.shopify;

import java.util.List;

public class ShopifyBulkSyncResponse {
    private boolean success;
    private String message;
    private int page;
    private int limit;
    private int totalProcessed;
    private int created;
    private int alreadyExists;
    private int updated;
    private int conflict;
    private int failed;
    private List<ShopifyBulkSyncItem> results;

    public boolean isSuccess() {
        return success;
    }

    public void setSuccess(boolean success) {
        this.success = success;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public int getPage() {
        return page;
    }

    public void setPage(int page) {
        this.page = page;
    }

    public int getLimit() {
        return limit;
    }

    public void setLimit(int limit) {
        this.limit = limit;
    }

    public int getTotalProcessed() {
        return totalProcessed;
    }

    public void setTotalProcessed(int totalProcessed) {
        this.totalProcessed = totalProcessed;
    }

    public int getCreated() {
        return created;
    }

    public void setCreated(int created) {
        this.created = created;
    }

    public int getAlreadyExists() {
        return alreadyExists;
    }

    public void setAlreadyExists(int alreadyExists) {
        this.alreadyExists = alreadyExists;
    }

    public int getUpdated() {
        return updated;
    }

    public void setUpdated(int updated) {
        this.updated = updated;
    }

    public int getConflict() {
        return conflict;
    }

    public void setConflict(int conflict) {
        this.conflict = conflict;
    }

    public int getFailed() {
        return failed;
    }

    public void setFailed(int failed) {
        this.failed = failed;
    }

    public List<ShopifyBulkSyncItem> getResults() {
        return results;
    }

    public void setResults(List<ShopifyBulkSyncItem> results) {
        this.results = results;
    }
}
