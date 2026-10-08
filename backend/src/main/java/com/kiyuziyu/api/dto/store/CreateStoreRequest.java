package com.kiyuziyu.api.dto.store;

public class CreateStoreRequest {

    private String name;
    private String code;
    private String platform;

    public CreateStoreRequest() {
    }

    public CreateStoreRequest(String name, String code, String platform) {
        this.name = name;
        this.code = code;
        this.platform = platform;
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

    public String getPlatform() {
        return platform;
    }

    public void setPlatform(String platform) {
        this.platform = platform;
    }
}
