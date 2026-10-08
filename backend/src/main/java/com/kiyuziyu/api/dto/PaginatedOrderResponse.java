package com.kiyuziyu.api.dto;

import java.util.List;

public class PaginatedOrderResponse {
    private boolean success;
    private List<OrderResponse> data;
    private int page;
    private int limit;
    private int total;
    private boolean hasNext;

    public PaginatedOrderResponse() {}

    public PaginatedOrderResponse(boolean success, List<OrderResponse> data, int page, int limit, int total, boolean hasNext) {
        this.success = success;
        this.data = data;
        this.page = page;
        this.limit = limit;
        this.total = total;
        this.hasNext = hasNext;
    }

    public boolean isSuccess() { return success; }
    public void setSuccess(boolean success) { this.success = success; }
    public List<OrderResponse> getData() { return data; }
    public void setData(List<OrderResponse> data) { this.data = data; }
    public int getPage() { return page; }
    public void setPage(int page) { this.page = page; }
    public int getLimit() { return limit; }
    public void setLimit(int limit) { this.limit = limit; }
    public int getTotal() { return total; }
    public void setTotal(int total) { this.total = total; }
    public boolean isHasNext() { return hasNext; }
    public void setHasNext(boolean hasNext) { this.hasNext = hasNext; }
}
