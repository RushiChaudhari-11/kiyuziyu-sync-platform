package com.kiyuziyu.api.dto.ownerproduct;

public class UpdateOwnerProductRequest {
    private Boolean enabled;

    public UpdateOwnerProductRequest() {
    }

    public UpdateOwnerProductRequest(Boolean enabled) {
        this.enabled = enabled;
    }

    public Boolean getEnabled() {
        return enabled;
    }

    public void setEnabled(Boolean enabled) {
        this.enabled = enabled;
    }
}
