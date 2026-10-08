package com.kiyuziyu.api.dto.user;

import com.google.cloud.Timestamp;
import com.kiyuziyu.api.model.ApiUser;

public class UserResponse {

    private String uid;
    private String email;
    private Boolean emailVerified;
    private String name;
    private String role;
    private String status;
    private String tenantId;
    private String createdAt;
    private String updatedAt;

    public UserResponse() {
    }

    public static UserResponse from(ApiUser user) {
        if (user == null) return null;
        UserResponse dto = new UserResponse();
        dto.setUid(user.getUid());
        dto.setEmail(user.getEmail());
        dto.setEmailVerified(user.getEmailVerified());
        dto.setName(user.getName());
        dto.setRole(user.getRole());
        dto.setStatus(user.getStatus());
        dto.setTenantId(user.getTenantId());
        dto.setCreatedAt(formatTimestamp(user.getCreatedAt()));
        dto.setUpdatedAt(formatTimestamp(user.getUpdatedAt()));
        return dto;
    }

    private static String formatTimestamp(Timestamp ts) {
        if (ts == null) return null;
        return ts.toDate().toInstant().toString();
    }

    public String getUid() {
        return uid;
    }

    public void setUid(String uid) {
        this.uid = uid;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public Boolean getEmailVerified() {
        return emailVerified;
    }

    public void setEmailVerified(Boolean emailVerified) {
        this.emailVerified = emailVerified;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
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

    public String getTenantId() {
        return tenantId;
    }

    public void setTenantId(String tenantId) {
        this.tenantId = tenantId;
    }
}
