package com.kiyuziyu.api.dto.tenant;

public class CreateTenantRequest {

    private String name;
    private String code;

    public CreateTenantRequest() {
    }

    public CreateTenantRequest(String name, String code) {
        this.name = name;
        this.code = code;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }
}
