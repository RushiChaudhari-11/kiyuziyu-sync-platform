package com.kiyuziyu.api.service;

import com.google.firebase.auth.FirebaseToken;
import com.kiyuziyu.api.dto.syncjob.CreateProductSyncJobRequest;
import com.kiyuziyu.api.dto.syncjob.CreateSyncJobAcceptedResponse;
import com.kiyuziyu.api.dto.syncjob.SyncJobResponse;
import com.kiyuziyu.api.exception.BadRequestException;
import com.kiyuziyu.api.exception.ConflictException;
import com.kiyuziyu.api.exception.ForbiddenException;
import com.kiyuziyu.api.exception.NotFoundException;
import com.kiyuziyu.api.model.*;
import com.kiyuziyu.api.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.ExecutionException;

@Service
public class SyncJobService {

    private static final Logger log = LoggerFactory.getLogger(SyncJobService.class);

    @Autowired
    private ApiUserRepository apiUserRepository;

    @Autowired
    private StoreRepository storeRepository;

    @Autowired
    private ShopifyConnectionRepository shopifyConnectionRepository;

    @Autowired
    private OwnerProductRepository ownerProductRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private SyncJobRepository syncJobRepository;

    @Autowired
    private SyncJobProcessor syncJobProcessor;

    /**
     * Resolve user's tenant and verify store belongs to tenant.
     */
    public StoreContext resolveAndAuthorizeStore(FirebaseToken token, String storeId)
            throws ExecutionException, InterruptedException {
        String uid = token.getUid();
        ApiUser user = apiUserRepository.findById(uid);
        if (user == null || user.getTenantId() == null || user.getTenantId().trim().isEmpty()) {
            log.warn("[SyncJobService] User UID={} has no associated tenant", uid);
            throw new NotFoundException("User does not belong to any tenant");
        }

        String tenantId = user.getTenantId().trim();

        // Check if store exists under user's tenant
        Store store = storeRepository.findById(tenantId, storeId);
        if (store == null) {
            // Check if store exists globally under a different tenant
            Store crossTenantStore = storeRepository.findByStoreId(storeId);
            if (crossTenantStore != null) {
                log.warn("[SyncJobService] Cross-tenant access denied: User tenant={}, Store tenant={}",
                        tenantId, crossTenantStore.getTenantId());
                throw new ForbiddenException("Store does not belong to user's tenant");
            }
            throw new NotFoundException("Store not found: " + storeId);
        }

        return new StoreContext(tenantId, storeId, store);
    }

    /**
     * POST /api/v1/tenants/me/stores/{storeId}/sync-jobs/product-sync
     * Create product sync job and trigger async execution.
     */
    public CreateSyncJobAcceptedResponse createProductSyncJob(FirebaseToken token, String storeId, CreateProductSyncJobRequest request)
            throws ExecutionException, InterruptedException {
        if (request == null || request.getProductIds() == null || request.getProductIds().isEmpty()) {
            throw new BadRequestException("Field 'productIds' must not be empty");
        }

        StoreContext ctx = resolveAndAuthorizeStore(token, storeId);

        // 1. Verify active Shopify connection exists for this store
        ShopifyConnection connection = shopifyConnectionRepository.findByStoreId(ctx.tenantId, ctx.storeId);
        if (connection == null) {
            log.warn("[SyncJobService] Shopify connection not found for store: {}", ctx.storeId);
            throw new NotFoundException("Shopify connection not found for store: " + ctx.storeId);
        }

        // 2. Verify all requested products are selected for this store and exist in master catalog
        List<String> validProductIds = new ArrayList<>();
        for (String rawId : request.getProductIds()) {
            if (rawId == null || rawId.trim().isEmpty()) {
                continue;
            }
            String productId = rawId.trim();

            // Check owner selection
            OwnerProduct ownerProduct = ownerProductRepository.findByTenantStoreAndProduct(ctx.tenantId, ctx.storeId, productId);
            if (ownerProduct == null) {
                log.warn("[SyncJobService] Product not selected for store: productId={}, storeId={}", productId, ctx.storeId);
                throw new NotFoundException("Product not selected for store: " + productId);
            }

            // Check master catalog
            Product masterProduct = productRepository.findByDocumentId(productId);
            if (masterProduct == null) {
                masterProduct = productRepository.findById(productId);
            }
            if (masterProduct == null) {
                log.warn("[SyncJobService] Master product not found: productId={}", productId);
                throw new NotFoundException("Master product not found: " + productId);
            }

            validProductIds.add(productId);
        }

        if (validProductIds.isEmpty()) {
            throw new BadRequestException("No valid product IDs provided for synchronization");
        }

        // 3. Duplicate/Running Job Protection
        List<SyncJob> activeJobs = syncJobRepository.findActiveJobsForStore(ctx.tenantId, ctx.storeId);
        Set<String> requestedSet = new HashSet<>(validProductIds);
        for (SyncJob activeJob : activeJobs) {
            Set<String> activeSet = new HashSet<>(activeJob.getProductIds() != null ? activeJob.getProductIds() : Collections.emptyList());
            if (activeSet.equals(requestedSet)) {
                log.warn("[SyncJobService] Active job {} already exists for store {} with identical product set",
                        activeJob.getJobId(), ctx.storeId);
                throw new ConflictException("An active sync job is already queued or running for this store with the requested product set: " + activeJob.getJobId());
            }
        }

        // 4. Create SyncJob record
        String jobId = "job_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        String now = Instant.now().toString();

        SyncJob job = new SyncJob(
                jobId,
                ctx.tenantId,
                ctx.storeId,
                connection.getConnectionId(),
                SyncJobType.PRODUCT_SYNC.name(),
                SyncJobStatus.QUEUED.name(),
                validProductIds,
                validProductIds.size(),
                0,
                0,
                0,
                null,
                null,
                null,
                now,
                now
        );

        syncJobRepository.save(job);
        log.info("[SyncJobService] Created sync job {} with status QUEUED for store {}", jobId, ctx.storeId);

        // 5. Async processing is handled by SyncJobProcessor's Firestore listener

        // 6. Return 202 Accepted response
        return new CreateSyncJobAcceptedResponse(jobId, SyncJobStatus.QUEUED.name(), SyncJobType.PRODUCT_SYNC.name());
    }

    /**
     * GET /api/v1/tenants/me/stores/{storeId}/sync-jobs/{jobId}
     * Get job status for authenticated store.
     */
    public SyncJobResponse getJobStatus(FirebaseToken token, String storeId, String jobId)
            throws ExecutionException, InterruptedException {
        if (jobId == null || jobId.trim().isEmpty()) {
            throw new BadRequestException("Job ID is required");
        }

        StoreContext ctx = resolveAndAuthorizeStore(token, storeId);

        SyncJob job = syncJobRepository.findById(jobId.trim());
        if (job == null) {
            log.warn("[SyncJobService] Job not found: jobId={}", jobId);
            throw new NotFoundException("Sync job not found: " + jobId);
        }

        // Verify isolation
        if (!ctx.tenantId.equals(job.getTenantId()) || !ctx.storeId.equals(job.getStoreId())) {
            log.warn("[SyncJobService] Cross-tenant access attempted for job {}: userTenant={}, jobTenant={}",
                    jobId, ctx.tenantId, job.getTenantId());
            throw new ForbiddenException("Job does not belong to authenticated tenant/store");
        }

        return new SyncJobResponse(job);
    }

    /**
     * GET /api/v1/tenants/me/stores/{storeId}/sync-jobs
     * List all sync jobs for authenticated store.
     */
    public List<SyncJobResponse> listJobsForStore(FirebaseToken token, String storeId)
            throws ExecutionException, InterruptedException {
        StoreContext ctx = resolveAndAuthorizeStore(token, storeId);

        List<SyncJob> jobs = syncJobRepository.findAllByStore(ctx.tenantId, ctx.storeId);
        List<SyncJobResponse> responses = new ArrayList<>();
        for (SyncJob job : jobs) {
            responses.add(new SyncJobResponse(job));
        }
        return responses;
    }

    public static class StoreContext {
        public final String tenantId;
        public final String storeId;
        public final Store store;

        public StoreContext(String tenantId, String storeId, Store store) {
            this.tenantId = tenantId;
            this.storeId = storeId;
            this.store = store;
        }
    }
}
