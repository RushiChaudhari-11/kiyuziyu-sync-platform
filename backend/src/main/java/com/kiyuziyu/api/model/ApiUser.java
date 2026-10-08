package com.kiyuziyu.api.model;

import com.google.cloud.Timestamp;
import com.google.cloud.firestore.annotation.DocumentId;

public class ApiUser {

    @DocumentId
    private String uid;
    private String email;
    private Boolean emailVerified;
    private String name;
    private String role;
    private String status;
    private String tenantId;
    private Timestamp createdAt;
    private Timestamp updatedAt;

    public ApiUser() {
    }

    public ApiUser(String uid, String email, Boolean emailVerified, String name) {
        this.uid = uid;
        this.email = email;
        this.emailVerified = emailVerified;
        this.name = name;
        this.role = UserRole.OWNER.name();
        this.status = UserStatus.ACTIVE.name();
        this.createdAt = Timestamp.now();
        this.updatedAt = Timestamp.now();
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

    public Timestamp getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Timestamp createdAt) {
        this.createdAt = createdAt;
    }

    public Timestamp getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Timestamp updatedAt) {
        this.updatedAt = updatedAt;
    }

    public String getTenantId() {
        return tenantId;
    }

    public void setTenantId(String tenantId) {
        this.tenantId = tenantId;
    }
}
