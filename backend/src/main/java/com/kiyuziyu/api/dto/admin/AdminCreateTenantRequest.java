package com.kiyuziyu.api.dto.admin;

public class AdminCreateTenantRequest {
    private String name;
    private String businessName;
    private String fullName;
    private String email;
    private String password;
    private String role;
    private Boolean createApiClient;
    private String apiKey;
    private String subscriptionType; // "MONTHLY" (1-Monthly) or "YEARLY" (2-Yearly)
    private String subscriptionStartDate;
    private String subscriptionEndDate;
    private Double subscriptionAmount;
    private Double amount; // alias for subscriptionAmount

    public AdminCreateTenantRequest() {}

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getBusinessName() {
        return businessName;
    }

    public void setBusinessName(String businessName) {
        this.businessName = businessName;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public Boolean getCreateApiClient() {
        return createApiClient;
    }

    public void setCreateApiClient(Boolean createApiClient) {
        this.createApiClient = createApiClient;
    }

    public String getApiKey() {
        return apiKey;
    }

    public void setApiKey(String apiKey) {
        this.apiKey = apiKey;
    }

    public String getSubscriptionType() {
        return subscriptionType;
    }

    public void setSubscriptionType(String subscriptionType) {
        this.subscriptionType = subscriptionType;
    }

    public String getSubscriptionStartDate() {
        return subscriptionStartDate;
    }

    public void setSubscriptionStartDate(String subscriptionStartDate) {
        this.subscriptionStartDate = subscriptionStartDate;
    }

    public String getSubscriptionEndDate() {
        return subscriptionEndDate;
    }

    public void setSubscriptionEndDate(String subscriptionEndDate) {
        this.subscriptionEndDate = subscriptionEndDate;
    }

    public Double getSubscriptionAmount() {
        return subscriptionAmount != null ? subscriptionAmount : amount;
    }

    public void setSubscriptionAmount(Double subscriptionAmount) {
        this.subscriptionAmount = subscriptionAmount;
    }

    public Double getAmount() {
        return amount != null ? amount : subscriptionAmount;
    }

    public void setAmount(Double amount) {
        this.amount = amount;
    }
}
