package com.kiyuziyu.api.service;

import com.google.cloud.firestore.DocumentChange;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.QueryDocumentSnapshot;
import com.kiyuziyu.api.model.ShopifyConnection;
import com.kiyuziyu.api.model.ShopifyProductMapping;
import com.kiyuziyu.api.model.SyncJob;
import com.kiyuziyu.api.model.SyncJobStatus;
import com.kiyuziyu.api.model.SyncJobType;
import com.kiyuziyu.api.repository.ShopifyConnectionRepository;
import com.kiyuziyu.api.repository.ShopifyProductMappingRepository;
import com.kiyuziyu.api.repository.SyncJobRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.time.Instant;
import java.util.*;

@Service
public class RealtimeStockListener {

    private static final Logger log = LoggerFactory.getLogger(RealtimeStockListener.class);

    @Autowired
    private Firestore firestore;

    @Autowired
    private ShopifyProductMappingRepository mappingRepository;

    @Autowired
    private ShopifyConnectionRepository shopifyConnectionRepository;

    @Autowired
    private SyncJobRepository syncJobRepository;

    @Autowired
    private SyncJobProcessor syncJobProcessor;

    @PostConstruct
    public void initStockListener() {
        log.info("[RealtimeStockListener] Initializing Firestore listener for product stock updates...");
        
        // Listen to all products subcollections for real-time stock/variation updates
        firestore.collectionGroup("products").addSnapshotListener((snapshots, e) -> {
            if (e != null) {
                log.error("[RealtimeStockListener] Listen failed: {}", e.getMessage(), e);
                return;
            }

            if (snapshots != null) {
                for (DocumentChange dc : snapshots.getDocumentChanges()) {
                    if (dc.getType() == DocumentChange.Type.MODIFIED) {
                        try {
                            log.info("[RealtimeStockListener] Detected MODIFIED document in products collectionGroup: {}", dc.getDocument().getId());
                            handleProductUpdate(dc.getDocument());
                        } catch (Exception ex) {
                            log.error("[RealtimeStockListener] Error processing product update: {}", ex.getMessage(), ex);
                        }
                    }
                }
            }
        });
    }

    private void handleProductUpdate(QueryDocumentSnapshot document) throws Exception {
        String productId = document.getId();
        String productCode = document.getString("productCode");
        
        log.info("[RealtimeStockListener] Handling stock update for productId={}, productCode={}", productId, productCode);

        // Get all tenants who have mapped this product
        List<ShopifyProductMapping> mappings = getMappingsForProduct(productId, productCode);
        
        if (mappings.isEmpty()) {
            log.info("[RealtimeStockListener] No mappings found for productId={}, productCode={}. Checking connected stores...", productId, productCode);
            // Fallback: check all currently connected Shopify stores
            List<ShopifyConnection> connections = shopifyConnectionRepository.findAllConnected();
            for (ShopifyConnection conn : connections) {
                String tenantId = conn.getTenantId();
                String storeId = conn.getStoreId();
                if (tenantId != null && storeId != null) {
                    ShopifyProductMapping m = new ShopifyProductMapping();
                    m.setTenantId(tenantId);
                    m.setStoreId(storeId);
                    m.setConnectionId(conn.getConnectionId());
                    m.setProductId(productId);
                    m.setProductCode(productCode);
                    mappings.add(m);
                }
            }
        }

        if (mappings.isEmpty()) {
            log.info("[RealtimeStockListener] No active Shopify stores found. Nothing to sync.");
            return;
        }

        log.info("[RealtimeStockListener] Product {} (code={}) was modified. Triggering sync for {} store targets...",
                productId, productCode, mappings.size());

        for (ShopifyProductMapping mapping : mappings) {
            String tenantId = mapping.getTenantId();
            String storeId = mapping.getStoreId();
            String connectionId = mapping.getConnectionId();

            if (tenantId == null || storeId == null || connectionId == null) {
                continue;
            }

            // Check if already queued or running
            List<SyncJob> activeJobs = syncJobRepository.findActiveJobsForStore(tenantId, storeId);
            boolean alreadyQueued = activeJobs.stream()
                    .anyMatch(j -> j.getProductIds() != null && (j.getProductIds().contains(productId) || (productCode != null && j.getProductIds().contains(productCode))));

            if (alreadyQueued) {
                log.info("[RealtimeStockListener] Sync already active/queued for tenant {}, store {}, product {}", tenantId, storeId, productId);
                continue;
            }

            // Queue a new sync job
            String jobId = "job_auto_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
            String now = Instant.now().toString();

            List<String> pIds = Collections.singletonList(productId);

            SyncJob job = new SyncJob(
                    jobId,
                    tenantId,
                    storeId,
                    connectionId,
                    SyncJobType.PRODUCT_SYNC.name(),
                    SyncJobStatus.QUEUED.name(),
                    pIds,
                    1,
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
            log.info("[RealtimeStockListener] Saved auto-sync job {} for tenant {}, product {}. Executing async...", jobId, tenantId, productId);
            
            // Execute directly via async executor without waiting for another listener
            syncJobProcessor.processJobAsync(jobId, tenantId, storeId, connectionId, pIds);
        }
    }

    private List<ShopifyProductMapping> getMappingsForProduct(String productId, String productCode) {
        List<ShopifyProductMapping> list = new ArrayList<>();
        try {
            // 1. Query by exact productId (documentId)
            var snap1 = firestore.collection(ShopifyProductMappingRepository.COLLECTION_NAME)
                    .whereEqualTo("productId", productId)
                    .get().get();
            
            for (var doc : snap1.getDocuments()) {
                ShopifyProductMapping m = doc.toObject(ShopifyProductMapping.class);
                if (m != null && isMappedStatus(m.getStatus())) {
                    list.add(m);
                }
            }

            // 2. Query by productCode if available and distinct
            if (productCode != null && !productCode.trim().isEmpty() && !productCode.trim().equals(productId)) {
                var snap2 = firestore.collection(ShopifyProductMappingRepository.COLLECTION_NAME)
                        .whereEqualTo("productCode", productCode.trim())
                        .get().get();
                for (var doc : snap2.getDocuments()) {
                    ShopifyProductMapping m = doc.toObject(ShopifyProductMapping.class);
                    if (m != null && isMappedStatus(m.getStatus()) && list.stream().noneMatch(x -> x.getMappingId() != null && x.getMappingId().equals(m.getMappingId()))) {
                        list.add(m);
                    }
                }
            }
        } catch (Exception e) {
            log.warn("[RealtimeStockListener] Failed to get mappings for product {}: {}", productId, e.getMessage());
        }
        return list;
    }

    private boolean isMappedStatus(String status) {
        return status == null || "MAPPED".equalsIgnoreCase(status) || "SYNCED".equalsIgnoreCase(status) || "PARTIAL".equalsIgnoreCase(status);
    }
}
