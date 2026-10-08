package com.kiyuziyu.api.service;

import com.kiyuziyu.api.dto.shopify.ShopifyProductSyncResponse;
import com.kiyuziyu.api.model.*;
import com.kiyuziyu.api.repository.ProductRepository;
import com.kiyuziyu.api.repository.ShopifyProductMappingRepository;
import com.kiyuziyu.api.repository.SyncJobRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import javax.annotation.PostConstruct;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.DocumentChange;

@Service
public class SyncJobProcessor {

    private static final Logger log = LoggerFactory.getLogger(SyncJobProcessor.class);

    @Autowired
    private SyncJobRepository syncJobRepository;

    @Autowired
    private com.kiyuziyu.api.repository.ShopifyConnectionRepository shopifyConnectionRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private ShopifyProductService shopifyProductService;

    @Autowired
    private ShopifyProductMappingRepository shopifyProductMappingRepository;

    @Autowired
    private Firestore firestore;

    @PostConstruct
    public void initJobListener() {
        log.info("[SyncJobProcessor] Initializing Firestore listener for QUEUED apiSyncJobs...");
        firestore.collection(SyncJobRepository.COLLECTION_NAME)
                .whereEqualTo("status", SyncJobStatus.QUEUED.name())
                .addSnapshotListener((snapshots, e) -> {
                    if (e != null) {
                        log.error("[SyncJobProcessor] Listen failed: {}", e.getMessage(), e);
                        return;
                    }
                    if (snapshots != null) {
                        for (DocumentChange dc : snapshots.getDocumentChanges()) {
                            if (dc.getType() == DocumentChange.Type.ADDED) {
                                SyncJob job = dc.getDocument().toObject(SyncJob.class);
                                if (SyncJobStatus.QUEUED.name().equals(job.getStatus())) {
                                    log.info("[SyncJobProcessor] Picked up new QUEUED job from Firestore: {}", job.getJobId());
                                    processJobAsync(job.getJobId(), job.getTenantId(), job.getStoreId(), job.getConnectionId(), job.getProductIds());
                                }
                            }
                        }
                    }
                });
    }

    @Async("syncJobTaskExecutor")
    public CompletableFuture<Void> processJobAsync(String jobId, String tenantId, String storeId, String connectionId, List<String> productIds) {
        log.info("[SyncJobProcessor] START background execution for jobId={}, tenantId={}, storeId={}, totalItems={}",
                jobId, tenantId, storeId, productIds != null ? productIds.size() : 0);

        SyncJob job = null;
        try {
            // 1. Transition QUEUED -> RUNNING Atomically via Transaction
            job = syncJobRepository.claimJobForProcessing(jobId);
            if (job == null) {
                log.info("[SyncJobProcessor] Job {} is already claimed by another process or not QUEUED. Skipping.", jobId);
                return CompletableFuture.completedFuture(null);
            }

            int successCount = 0;
            int failedCount = 0;
            int processedCount = 0;
            String firstErrorMessage = null;

            ShopifyConnection connection = null;
            try {
                connection = shopifyConnectionRepository.findById(connectionId);
                if (connection != null && connection.getShopifyStoreDomain() != null) {
                    com.kiyuziyu.api.integration.shopify.ShopifyContextHolder.setContext(
                            connection.getShopifyStoreDomain()
                    );
                }
            } catch (Exception e) {
                log.warn("[SyncJobProcessor] Failed to load ShopifyConnection {}: {}", connectionId, e.getMessage());
            }

            if (productIds != null) {
                for (String productId : productIds) {
                    processedCount++;
                    try {
                        Product product = productRepository.findByDocumentId(productId);
                        if (product == null) {
                            product = productRepository.findById(productId);
                        }

                        if (product == null) {
                            log.warn("[SyncJobProcessor] Product {} not found in catalog for job {}", productId, jobId);
                            failedCount++;
                            if (firstErrorMessage == null) {
                                firstErrorMessage = "Product " + productId + " not found in master catalog";
                            }
                            continue;
                        }

                        String productCode = product.getProductCode();
                        if (productCode == null || productCode.trim().isEmpty()) {
                            log.warn("[SyncJobProcessor] Product {} has no productCode", productId);
                            failedCount++;
                            if (firstErrorMessage == null) {
                                firstErrorMessage = "Product " + productId + " is missing productCode";
                            }
                            continue;
                        }

                        // Use mapping to avoid duplicate if GraphQL search fails
                        ShopifyProductMapping mapping = null;
                        try {
                            mapping = shopifyProductMappingRepository.findByStoreAndProduct(tenantId, storeId, productId);
                        } catch (Exception e) {
                            log.warn("[SyncJobProcessor] Failed to query mapping for product {}: {}", productId, e.getMessage());
                        }
                        String knownShopifyId = mapping != null ? mapping.getShopifyProductId() : null;

                        // Reusing existing ShopifyProductService with exact loaded master product
                        ShopifyProductSyncResponse syncResp = shopifyProductService.syncProduct(tenantId, product, knownShopifyId);

                        if (syncResp != null && syncResp.isSuccess()) {
                            successCount++;
                            log.info("[SyncJobProcessor] Successfully synced productId={} (code={}) for job {}", productId, productCode, jobId);

                            // Maintain mapping in apiShopifyProductMappings if shopifyProductId is available
                            if (syncResp.getData() != null && syncResp.getData().get("shopifyProductId") != null) {
                                String shopifyProductId = String.valueOf(syncResp.getData().get("shopifyProductId"));
                                maintainMapping(tenantId, storeId, connectionId, productId, productCode, shopifyProductId);
                            }
                        } else {
                            failedCount++;
                            String reason = syncResp != null ? syncResp.getMessage() : "Sync failed with null response";
                            log.warn("[SyncJobProcessor] Failed syncing productId={} (code={}) for job {}: {}", productId, productCode, jobId, reason);
                            if (firstErrorMessage == null) {
                                firstErrorMessage = sanitizeErrorMessage(reason);
                            }
                        }
                    } catch (Exception e) {
                        failedCount++;
                        log.error("[SyncJobProcessor] Exception syncing productId={} for job {}: {}", productId, jobId, e.getMessage(), e);
                        if (firstErrorMessage == null) {
                            firstErrorMessage = sanitizeErrorMessage(e.getMessage());
                        }
                    }

                    // Periodically update progress in Firestore
                    job.setProcessedItems(processedCount);
                    job.setSuccessItems(successCount);
                    job.setFailedItems(failedCount);
                    job.setUpdatedAt(Instant.now().toString());
                    try {
                        syncJobRepository.save(job);
                    } catch (Exception se) {
                        log.warn("[SyncJobProcessor] Failed saving intermediate progress for job {}: {}", jobId, se.getMessage());
                    }
                }
            }

            // 2. Determine final status
            job.setProcessedItems(processedCount);
            job.setSuccessItems(successCount);
            job.setFailedItems(failedCount);
            job.setCompletedAt(Instant.now().toString());
            job.setUpdatedAt(Instant.now().toString());

            if (failedCount == 0 && successCount > 0) {
                job.setStatus(SyncJobStatus.COMPLETED.name());
                job.setErrorMessage(null);
            } else if (successCount > 0 && failedCount > 0) {
                job.setStatus(SyncJobStatus.PARTIAL.name());
                job.setErrorMessage(firstErrorMessage != null ? firstErrorMessage : "Some products failed to sync");
            } else {
                job.setStatus(SyncJobStatus.FAILED.name());
                job.setErrorMessage(firstErrorMessage != null ? firstErrorMessage : "All products failed to sync");
            }

            syncJobRepository.save(job);
            log.info("[SyncJobProcessor] FINISHED execution for jobId={}, finalStatus={}, success={}, failed={}",
                    jobId, job.getStatus(), successCount, failedCount);

        } catch (Exception e) {
            log.error("[SyncJobProcessor] Fatal error processing job {}: {}", jobId, e.getMessage(), e);
            try {
                if (job != null) {
                    job.setStatus(SyncJobStatus.FAILED.name());
                    job.setErrorMessage(sanitizeErrorMessage(e.getMessage()));
                    job.setCompletedAt(Instant.now().toString());
                    job.setUpdatedAt(Instant.now().toString());
                    syncJobRepository.save(job);
                }
            } catch (Exception saveErr) {
                log.error("[SyncJobProcessor] Failed to persist fatal job failure for {}: {}", jobId, saveErr.getMessage(), saveErr);
            }
        } finally {
            com.kiyuziyu.api.integration.shopify.ShopifyContextHolder.clearContext();
        }

        return CompletableFuture.completedFuture(null);
    }

    private void maintainMapping(String tenantId, String storeId, String connectionId, String productId, String productCode, String shopifyProductId) {
        try {
            ShopifyProductMapping existing = shopifyProductMappingRepository.findByStoreAndProduct(tenantId, storeId, productId);
            if (existing == null) {
                String mappingId = "map_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
                String now = Instant.now().toString();
                ShopifyProductMapping mapping = new ShopifyProductMapping(
                        mappingId,
                        tenantId,
                        storeId,
                        connectionId,
                        productId,
                        productCode,
                        shopifyProductId,
                        null,
                        ShopifyProductMappingStatus.MAPPED.name(),
                        now,
                        now
                );
                shopifyProductMappingRepository.save(mapping);
            }
        } catch (Exception e) {
            log.warn("[SyncJobProcessor] Could not maintain ShopifyProductMapping for productId={}: {}", productId, e.getMessage());
        }
    }

    public static String sanitizeErrorMessage(String error) {
        if (error == null || error.trim().isEmpty()) {
            return "Unknown error occurred";
        }
        // Redact any access tokens, bearer tokens, or keys
        String sanitized = error.replaceAll("(?i)(shpat_[a-zA-Z0-9]+|Bearer\\s+[a-zA-Z0-9_\\-\\.]+|key=[a-zA-Z0-9_\\-]+|secret=[a-zA-Z0-9_\\-]+)", "[REDACTED]");
        if (sanitized.length() > 500) {
            sanitized = sanitized.substring(0, 500) + "...";
        }
        return sanitized;
    }
}
