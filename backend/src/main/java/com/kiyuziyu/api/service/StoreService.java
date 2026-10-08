package com.kiyuziyu.api.service;

import com.google.cloud.Timestamp;
import com.google.firebase.auth.FirebaseToken;
import com.kiyuziyu.api.dto.store.CreateStoreRequest;
import com.kiyuziyu.api.dto.store.StoreResponse;
import com.kiyuziyu.api.exception.BadRequestException;
import com.kiyuziyu.api.exception.ConflictException;
import com.kiyuziyu.api.model.Store;
import com.kiyuziyu.api.model.StorePlatform;
import com.kiyuziyu.api.model.StoreStatus;
import com.kiyuziyu.api.repository.StoreRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutionException;

@Service
public class StoreService {

    private static final Logger log = LoggerFactory.getLogger(StoreService.class);

    @Autowired
    private StoreRepository storeRepository;

    @Autowired
    private TenantService tenantService;

    public StoreResponse createStore(FirebaseToken token, CreateStoreRequest request)
            throws ExecutionException, InterruptedException {
        // Resolve tenant from authenticated user's apiUsers record
        String tenantId = tenantService.resolveTenantIdForUser(token);

        if (request == null) {
            throw new BadRequestException("Request body is required");
        }

        if (request.getName() == null || request.getName().trim().isEmpty()) {
            throw new BadRequestException("Store name is required");
        }

        if (request.getCode() == null || request.getCode().trim().isEmpty()) {
            throw new BadRequestException("Store code is required");
        }

        String code = request.getCode().trim().toUpperCase();

        // Store code must be unique within tenant
        if (storeRepository.existsByCode(tenantId, code)) {
            throw new ConflictException("Store code already exists within this tenant: " + code);
        }

        String platform = StorePlatform.GENERIC.name();
        if (request.getPlatform() != null && !request.getPlatform().trim().isEmpty()) {
            String pUpper = request.getPlatform().trim().toUpperCase();
            try {
                platform = StorePlatform.valueOf(pUpper).name();
            } catch (IllegalArgumentException e) {
                throw new BadRequestException("Invalid platform: " + request.getPlatform() + ". Supported platforms: GENERIC, SHOPIFY");
            }
        }

        // Server-side generated storeId
        String storeId = "store_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);

        Store store = new Store();
        store.setStoreId(storeId);
        store.setTenantId(tenantId);
        store.setName(request.getName().trim());
        store.setCode(code);
        store.setPlatform(platform);
        store.setStatus(StoreStatus.ACTIVE.name());
        store.setCreatedAt(Timestamp.now());
        store.setUpdatedAt(Timestamp.now());

        storeRepository.save(tenantId, store);
        log.info("[StoreService] Created store: storeId={}, tenantId={}, code={}, platform={}", storeId, tenantId, code, platform);

        return StoreResponse.from(store);
    }

    public List<StoreResponse> getStoresForCurrentTenant(FirebaseToken token)
            throws ExecutionException, InterruptedException {
        String tenantId = tenantService.resolveTenantIdForUser(token);
        List<Store> stores = storeRepository.findAllByTenantId(tenantId);

        List<StoreResponse> responses = new ArrayList<>();
        for (Store s : stores) {
            responses.add(StoreResponse.from(s));
        }
        log.info("[StoreService] Found {} stores for tenantId={}", responses.size(), tenantId);
        return responses;
    }
}
