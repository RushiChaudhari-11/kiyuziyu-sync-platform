package com.kiyuziyu.api.service;

import com.google.firebase.auth.FirebaseToken;
import com.kiyuziyu.api.dto.PagedResult;
import com.kiyuziyu.api.dto.ProductResponse;
import com.kiyuziyu.api.dto.shopifymapping.ShopifyProductMappingResponse;
import com.kiyuziyu.api.dto.syncjob.CreateProductSyncJobRequest;
import com.kiyuziyu.api.dto.syncjob.CreateSyncJobAcceptedResponse;
import com.kiyuziyu.api.dto.syncjob.SyncJobResponse;
import com.kiyuziyu.api.exception.NotFoundException;
import com.kiyuziyu.api.model.ApiUser;
import com.kiyuziyu.api.model.Store;
import com.kiyuziyu.api.model.SyncJob;
import com.kiyuziyu.api.repository.ApiUserRepository;
import com.kiyuziyu.api.repository.ProductRepository;
import com.kiyuziyu.api.repository.StoreRepository;
import com.kiyuziyu.api.repository.SyncJobRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutionException;

@Service
public class TenantProductService {

    @Autowired
    private ApiUserRepository apiUserRepository;

    @Autowired
    private StoreRepository storeRepository;

    @Autowired
    private ProductService productService;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private ShopifyProductMappingService shopifyProductMappingService;

    @Autowired
    private SyncJobRepository syncJobRepository;

    @Autowired
    private SyncJobService syncJobService;

    public String resolveTenantId(FirebaseToken token) throws ExecutionException, InterruptedException {
        String uid = token.getUid();
        ApiUser user = apiUserRepository.findById(uid);
        if (user == null || user.getTenantId() == null || user.getTenantId().trim().isEmpty()) {
            throw new NotFoundException("User does not belong to any tenant");
        }
        return user.getTenantId().trim();
    }

    private Store getOrCreatePrimaryTenantStore(String tenantId) throws ExecutionException, InterruptedException {
        List<Store> stores = storeRepository.findAllByTenantId(tenantId);
        if (stores != null && !stores.isEmpty()) {
            return stores.get(0);
        }
        throw new NotFoundException("No store found for tenant: " + tenantId);
    }

    public PagedResult<ProductResponse> getTenantProducts(FirebaseToken token, String collectionId, String search, int limit, int offset) throws ExecutionException, InterruptedException {
        String tenantId = resolveTenantId(token);
        
        // Return products from the master catalog.
        if (search != null && !search.trim().isEmpty()) {
            return productService.searchProducts(tenantId, search, limit, offset);
        } else if (collectionId != null && !collectionId.isEmpty()) {
            return productService.getProductsByCollection(tenantId, collectionId, limit, offset);
        } else {
            return productService.getAllProducts(tenantId, limit, offset);
        }
    }

    public List<Map<String, Object>> getCollections() throws ExecutionException, InterruptedException {
        return productRepository.findAllCollections();
    }

    public List<Map<String, Object>> getSyncStatus(FirebaseToken token) throws ExecutionException, InterruptedException {
        String tenantId = resolveTenantId(token);
        Store store = getOrCreatePrimaryTenantStore(tenantId);
        String storeId = store.getStoreId();

        List<ShopifyProductMappingResponse> mappings = shopifyProductMappingService.getAllMappings(token, storeId);
        List<SyncJob> jobs = syncJobRepository.findAllByStore(tenantId, storeId);

        List<Map<String, Object>> result = new ArrayList<>();

        // Step 1: Build base status from mappings (MAPPED => SYNCED)
        // Key: productId -> status
        Map<String, String> statusMap = new HashMap<>();
        // Key: productId -> updatedAt timestamp of that mapping (for comparison)
        Map<String, String> mappingTimestampMap = new HashMap<>();

        for (ShopifyProductMappingResponse mapping : mappings) {
            String pId = mapping.getProductId();
            if (pId == null) continue;
            // MAPPED in the mapping table means successfully synced to Shopify
            String displayStatus = "MAPPED".equals(mapping.getStatus()) ? "SYNCED" : mapping.getStatus();
            statusMap.put(pId, displayStatus);
            mappingTimestampMap.put(pId, mapping.getUpdatedAt() != null ? mapping.getUpdatedAt() : "");
        }

        // Step 2: Build latest-job-per-product map by comparing updatedAt timestamps.
        // The repository returns jobs sorted descending by createdAt, but we explicitly compare
        // updatedAt to be safe (job.updatedAt reflects the final completion time).
        Map<String, SyncJob> latestJobPerProduct = new HashMap<>();
        for (SyncJob job : jobs) {
            if (job.getProductIds() == null) continue;
            for (String pId : job.getProductIds()) {
                if (pId == null) continue;
                SyncJob existing = latestJobPerProduct.get(pId);
                if (existing == null) {
                    latestJobPerProduct.put(pId, job);
                } else {
                    String existingTs = existing.getUpdatedAt() != null ? existing.getUpdatedAt() : "";
                    String candidateTs = job.getUpdatedAt() != null ? job.getUpdatedAt() : "";
                    if (candidateTs.compareTo(existingTs) > 0) {
                        latestJobPerProduct.put(pId, job);
                    }
                }
            }
        }

        // Step 3: Apply latest job status only where appropriate.
        for (Map.Entry<String, SyncJob> entry : latestJobPerProduct.entrySet()) {
            String pId = entry.getKey();
            SyncJob latestJob = entry.getValue();
            String jobTs = latestJob.getUpdatedAt() != null ? latestJob.getUpdatedAt() : "";
            String currentMappingTs = mappingTimestampMap.getOrDefault(pId, "");
            // A job is considered "newer" if its updatedAt is after the mapping's updatedAt
            boolean jobIsNewer = jobTs.compareTo(currentMappingTs) > 0;

            String jobStatus = latestJob.getStatus();
            if ("QUEUED".equals(jobStatus) || "RUNNING".equals(jobStatus) || "PROCESSING".equals(jobStatus)) {
                // Active/in-progress jobs always take precedence regardless of timestamp
                statusMap.put(pId, "SYNCING");
            } else if ("COMPLETED".equals(jobStatus)
                    && latestJob.getFailedItems() == 0
                    && latestJob.getSuccessItems() > 0) {
                // Successful completion => always SYNCED
                statusMap.put(pId, "SYNCED");
            } else if ("FAILED".equals(jobStatus)) {
                // Only mark FAILED if this failed job is newer than the current SYNCED mapping.
                // If a SYNCED mapping exists and is newer, keep SYNCED.
                if (jobIsNewer || !statusMap.containsKey(pId)) {
                    statusMap.put(pId, "FAILED");
                }
                // else: mapping is newer -> keep SYNCED
            } else if ("PARTIAL".equals(jobStatus)) {
                if (jobIsNewer || !statusMap.containsKey(pId)) {
                    statusMap.put(pId, "PARTIAL");
                }
            }
        }

        for (Map.Entry<String, String> entry : statusMap.entrySet()) {
            Map<String, Object> map = new HashMap<>();
            map.put("productId", entry.getKey());
            map.put("status", entry.getValue());
            result.add(map);
        }

        return result;
    }

    @Autowired
    private com.kiyuziyu.api.repository.OwnerProductRepository ownerProductRepository;

    public CreateSyncJobAcceptedResponse syncProducts(FirebaseToken token, CreateProductSyncJobRequest request) throws ExecutionException, InterruptedException {
        String tenantId = resolveTenantId(token);
        Store store = getOrCreatePrimaryTenantStore(tenantId);
        String storeId = store.getStoreId();

        // Implicitly select products for the tenant's store if not already selected
        if (request.getProductIds() != null) {
            for (String productId : request.getProductIds()) {
                if (productId != null && !productId.trim().isEmpty()) {
                    if (ownerProductRepository.findByTenantStoreAndProduct(tenantId, storeId, productId) == null) {
                        com.kiyuziyu.api.model.OwnerProduct op = new com.kiyuziyu.api.model.OwnerProduct();
                        op.setSelectionId(java.util.UUID.randomUUID().toString());
                        op.setTenantId(tenantId);
                        op.setStoreId(storeId);
                        op.setProductId(productId);
                        op.setProductCode("AUTO_SELECTED");
                        op.setEnabled(true);
                        op.setCreatedAt(java.time.Instant.now().toString());
                        op.setUpdatedAt(java.time.Instant.now().toString());
                        ownerProductRepository.save(op);
                    }
                }
            }
        }

        return syncJobService.createProductSyncJob(token, storeId, request);
    }

    @Autowired
    private com.kiyuziyu.api.repository.ClientProductOverrideRepository overrideRepository;

    public void updateProductPrice(String tenantId, String productCode, Double sellingPrice) throws ExecutionException, InterruptedException {
        com.kiyuziyu.api.model.ClientProductOverride override = null;
        try {
            override = overrideRepository.findByClientAndProduct(tenantId, productCode);
        } catch (Exception ignored) {}

        if (override == null) {
            override = new com.kiyuziyu.api.model.ClientProductOverride();
            override.setClientId(tenantId);
            override.setProductCode(productCode);
            override.setProductId(productCode);
            override.setEnabled(true);
        }

        override.setSellingPrice(sellingPrice);
        overrideRepository.save(override);
    }
}
