package com.kiyuziyu.api.dto;

import jakarta.validation.constraints.NotBlank;

public class UpdateOrderStatusRequest {
    @NotBlank(message = "Status is required")
    private String status;

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
}
