package com.kiyuziyu.api.dto.admin;

public class AdminCreateTenantRequest {
    private String name;
    private String email;
    private String password;
    private String role;
    private Boolean createApiClient;
    private String apiKey;

    public AdminCreateTenantRequest() {}

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
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
}
