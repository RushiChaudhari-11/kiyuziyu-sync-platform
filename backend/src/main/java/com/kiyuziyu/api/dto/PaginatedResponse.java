package com.kiyuziyu.api.dto;

import java.util.List;

public class PaginatedResponse<T> {
    private boolean success;
    private List<T> data;
    private int totalCount;
    private int page;
    private int limit;

    public PaginatedResponse() {
    }

    public PaginatedResponse(boolean success, List<T> data, int totalCount, int page, int limit) {
        this.success = success;
        this.data = data;
        this.totalCount = totalCount;
        this.page = page;
        this.limit = limit;
    }

    public boolean isSuccess() {
        return success;
    }

    public void setSuccess(boolean success) {
        this.success = success;
    }

    public List<T> getData() {
        return data;
    }

    public void setData(List<T> data) {
        this.data = data;
    }

    public int getTotalCount() {
        return totalCount;
    }

    public void setTotalCount(int totalCount) {
        this.totalCount = totalCount;
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
}
