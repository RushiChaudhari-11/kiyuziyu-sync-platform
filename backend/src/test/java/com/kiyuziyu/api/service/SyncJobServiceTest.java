package com.kiyuziyu.api.service;

import com.google.firebase.auth.FirebaseToken;
import com.kiyuziyu.api.dto.shopify.ShopifyProductSyncResponse;
import com.kiyuziyu.api.dto.syncjob.CreateProductSyncJobRequest;
import com.kiyuziyu.api.dto.syncjob.CreateSyncJobAcceptedResponse;
import com.kiyuziyu.api.dto.syncjob.SyncJobResponse;
import com.kiyuziyu.api.exception.BadRequestException;
import com.kiyuziyu.api.exception.ConflictException;
import com.kiyuziyu.api.exception.ForbiddenException;
import com.kiyuziyu.api.exception.NotFoundException;
import com.kiyuziyu.api.model.*;
import com.kiyuziyu.api.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.*;
import java.util.concurrent.ExecutionException;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SyncJobServiceTest {

    @Mock
    private ApiUserRepository apiUserRepository;

    @Mock
    private StoreRepository storeRepository;

    @Mock
    private ShopifyConnectionRepository shopifyConnectionRepository;

    @Mock
    private OwnerProductRepository ownerProductRepository;

    @Mock
    private ProductRepository productRepository;

    @Mock
    private SyncJobRepository syncJobRepository;

    @Mock
    private SyncJobProcessor syncJobProcessor;

    @Mock
    private ShopifyProductService shopifyProductService;

    @Mock
    private ShopifyProductMappingRepository shopifyProductMappingRepository;

    @InjectMocks
    private SyncJobService syncJobService;

    private SyncJobProcessor testSyncJobProcessor;

    private FirebaseToken mockToken;
    private ApiUser mockUser;
    private Store mockStore;
    private ShopifyConnection mockConnection;
    private OwnerProduct mockOwnerProduct;
    private Product mockMasterProduct;

    @BeforeEach
    void setUp() {
        mockToken = mock(FirebaseToken.class);
        when(mockToken.getUid()).thenReturn("firebase_uid_owner");

        mockUser = new ApiUser();
        mockUser.setUid("firebase_uid_owner");
        mockUser.setTenantId("tenant_da7590066509");

        mockStore = new Store();
        mockStore.setStoreId("store_5fcd29b2b01c");
        mockStore.setTenantId("tenant_da7590066509");
        mockStore.setName("Kiyuziyu Main Store");
        mockStore.setCode("MAIN");
        mockStore.setPlatform("SHOPIFY");

        mockConnection = new ShopifyConnection("sc_141e517b19ea", "tenant_da7590066509", "store_5fcd29b2b01c",
                "example.myshopify.com", null, ShopifyConnectionStatus.CONNECTED.name(), "2026-09-23T00:00:00Z", "2026-09-23T00:00:00Z");

        mockOwnerProduct = new OwnerProduct("op_123", "tenant_da7590066509", "store_5fcd29b2b01c",
                "prod_705", "705", true, "2026-09-23T00:00:00Z", "2026-09-23T00:00:00Z");

        mockMasterProduct = new Product();
        mockMasterProduct.setId("prod_705");
        mockMasterProduct.setProductCode("705");
        mockMasterProduct.setProductName("Gold Ring 705");
        mockMasterProduct.setBasePrice(499.0);

        try {
            when(apiUserRepository.findById("firebase_uid_owner")).thenReturn(mockUser);
            when(storeRepository.findById("tenant_da7590066509", "store_5fcd29b2b01c")).thenReturn(mockStore);
            when(shopifyConnectionRepository.findByStoreId("tenant_da7590066509", "store_5fcd29b2b01c")).thenReturn(mockConnection);
            when(ownerProductRepository.findByTenantStoreAndProduct("tenant_da7590066509", "store_5fcd29b2b01c", "prod_705")).thenReturn(mockOwnerProduct);
            when(productRepository.findByDocumentId("prod_705")).thenReturn(mockMasterProduct);
            when(productRepository.findById("prod_705")).thenReturn(mockMasterProduct);
            when(syncJobRepository.findActiveJobsForStore("tenant_da7590066509", "store_5fcd29b2b01c")).thenReturn(new ArrayList<>());
        } catch (Exception e) {
            fail("Setup mock configuration failed: " + e.getMessage());
        }

        // Initialize processor for standalone unit testing
        testSyncJobProcessor = new SyncJobProcessor();
        try {
            java.lang.reflect.Field repoField = SyncJobProcessor.class.getDeclaredField("syncJobRepository");
            repoField.setAccessible(true);
            repoField.set(testSyncJobProcessor, syncJobRepository);

            java.lang.reflect.Field prodField = SyncJobProcessor.class.getDeclaredField("productRepository");
            prodField.setAccessible(true);
            prodField.set(testSyncJobProcessor, productRepository);

            java.lang.reflect.Field shopifyField = SyncJobProcessor.class.getDeclaredField("shopifyProductService");
            shopifyField.setAccessible(true);
            shopifyField.set(testSyncJobProcessor, shopifyProductService);

            java.lang.reflect.Field mappingField = SyncJobProcessor.class.getDeclaredField("shopifyProductMappingRepository");
            mappingField.setAccessible(true);
            mappingField.set(testSyncJobProcessor, shopifyProductMappingRepository);
        } catch (Exception e) {
            fail("Setup testSyncJobProcessor failed: " + e.getMessage());
        }
    }

    @Test
    void createProductSyncJob_success_returnsQueued202() throws ExecutionException, InterruptedException {
        CreateProductSyncJobRequest request = new CreateProductSyncJobRequest(Collections.singletonList("prod_705"));

        CreateSyncJobAcceptedResponse resp = syncJobService.createProductSyncJob(mockToken, "store_5fcd29b2b01c", request);

        assertNotNull(resp);
        assertNotNull(resp.getJobId());
        assertTrue(resp.getJobId().startsWith("job_"));
        assertEquals(SyncJobStatus.QUEUED.name(), resp.getStatus());
        assertEquals(SyncJobType.PRODUCT_SYNC.name(), resp.getJobType());

        ArgumentCaptor<SyncJob> captor = ArgumentCaptor.forClass(SyncJob.class);
        verify(syncJobRepository).save(captor.capture());
        SyncJob saved = captor.getValue();
        assertEquals("tenant_da7590066509", saved.getTenantId());
        assertEquals("store_5fcd29b2b01c", saved.getStoreId());
        assertEquals("sc_141e517b19ea", saved.getConnectionId());
        assertEquals(1, saved.getTotalItems());
        assertEquals(0, saved.getProcessedItems());
        assertEquals(SyncJobStatus.QUEUED.name(), saved.getStatus());
    }

    @Test
    void createProductSyncJob_duplicateActiveJob_throws409Conflict() throws ExecutionException, InterruptedException {
        SyncJob activeJob = new SyncJob();
        activeJob.setJobId("job_active_123");
        activeJob.setStatus(SyncJobStatus.RUNNING.name());
        activeJob.setProductIds(Collections.singletonList("prod_705"));

        when(syncJobRepository.findActiveJobsForStore("tenant_da7590066509", "store_5fcd29b2b01c"))
                .thenReturn(Collections.singletonList(activeJob));

        CreateProductSyncJobRequest request = new CreateProductSyncJobRequest(Collections.singletonList("prod_705"));

        assertThrows(ConflictException.class, () ->
                syncJobService.createProductSyncJob(mockToken, "store_5fcd29b2b01c", request));
    }

    @Test
    void createProductSyncJob_differentProducts_allowed() throws ExecutionException, InterruptedException {
        SyncJob activeJob = new SyncJob();
        activeJob.setJobId("job_active_123");
        activeJob.setStatus(SyncJobStatus.RUNNING.name());
        activeJob.setProductIds(Collections.singletonList("prod_other"));

        when(syncJobRepository.findActiveJobsForStore("tenant_da7590066509", "store_5fcd29b2b01c"))
                .thenReturn(Collections.singletonList(activeJob));

        CreateProductSyncJobRequest request = new CreateProductSyncJobRequest(Collections.singletonList("prod_705"));

        CreateSyncJobAcceptedResponse resp = syncJobService.createProductSyncJob(mockToken, "store_5fcd29b2b01c", request);
        assertNotNull(resp);
        assertEquals(SyncJobStatus.QUEUED.name(), resp.getStatus());
    }

    @Test
    void createProductSyncJob_missingStore_throws404NotFound() throws ExecutionException, InterruptedException {
        when(storeRepository.findById("tenant_da7590066509", "store_missing")).thenReturn(null);
        when(storeRepository.findByStoreId("store_missing")).thenReturn(null);

        CreateProductSyncJobRequest request = new CreateProductSyncJobRequest(Collections.singletonList("prod_705"));

        assertThrows(NotFoundException.class, () ->
                syncJobService.createProductSyncJob(mockToken, "store_missing", request));
    }

    @Test
    void createProductSyncJob_crossTenantStore_throws403Forbidden() throws ExecutionException, InterruptedException {
        Store crossStore = new Store();
        crossStore.setStoreId("store_other_tenant");
        crossStore.setTenantId("tenant_other");

        when(storeRepository.findById("tenant_da7590066509", "store_other_tenant")).thenReturn(null);
        when(storeRepository.findByStoreId("store_other_tenant")).thenReturn(crossStore);

        CreateProductSyncJobRequest request = new CreateProductSyncJobRequest(Collections.singletonList("prod_705"));

        assertThrows(ForbiddenException.class, () ->
                syncJobService.createProductSyncJob(mockToken, "store_other_tenant", request));
    }

    @Test
    void createProductSyncJob_missingShopifyConnection_throws404NotFound() throws ExecutionException, InterruptedException {
        when(shopifyConnectionRepository.findByStoreId("tenant_da7590066509", "store_5fcd29b2b01c")).thenReturn(null);

        CreateProductSyncJobRequest request = new CreateProductSyncJobRequest(Collections.singletonList("prod_705"));

        assertThrows(NotFoundException.class, () ->
                syncJobService.createProductSyncJob(mockToken, "store_5fcd29b2b01c", request));
    }

    @Test
    void createProductSyncJob_productNotSelected_throws404NotFound() throws ExecutionException, InterruptedException {
        when(ownerProductRepository.findByTenantStoreAndProduct("tenant_da7590066509", "store_5fcd29b2b01c", "prod_705")).thenReturn(null);

        CreateProductSyncJobRequest request = new CreateProductSyncJobRequest(Collections.singletonList("prod_705"));

        assertThrows(NotFoundException.class, () ->
                syncJobService.createProductSyncJob(mockToken, "store_5fcd29b2b01c", request));
    }

    @Test
    void createProductSyncJob_masterProductNotFound_throws404NotFound() throws ExecutionException, InterruptedException {
        when(productRepository.findByDocumentId("prod_705")).thenReturn(null);
        when(productRepository.findById("prod_705")).thenReturn(null);

        CreateProductSyncJobRequest request = new CreateProductSyncJobRequest(Collections.singletonList("prod_705"));

        assertThrows(NotFoundException.class, () ->
                syncJobService.createProductSyncJob(mockToken, "store_5fcd29b2b01c", request));
    }

    @Test
    void createProductSyncJob_emptyProductList_throws400BadRequest() {
        CreateProductSyncJobRequest request = new CreateProductSyncJobRequest(Collections.emptyList());

        assertThrows(BadRequestException.class, () ->
                syncJobService.createProductSyncJob(mockToken, "store_5fcd29b2b01c", request));
    }

    @Test
    void getJobStatus_success() throws ExecutionException, InterruptedException {
        SyncJob job = new SyncJob("job_123", "tenant_da7590066509", "store_5fcd29b2b01c", "sc_141e517b19ea",
                SyncJobType.PRODUCT_SYNC.name(), SyncJobStatus.RUNNING.name(), Collections.singletonList("prod_705"),
                1, 0, 0, 0, "2026-09-23T00:01:00Z", null, null, "2026-09-23T00:00:00Z", "2026-09-23T00:01:00Z");

        when(syncJobRepository.findById("job_123")).thenReturn(job);

        SyncJobResponse resp = syncJobService.getJobStatus(mockToken, "store_5fcd29b2b01c", "job_123");
        assertNotNull(resp);
        assertEquals("job_123", resp.getJobId());
        assertEquals(SyncJobStatus.RUNNING.name(), resp.getStatus());
        assertEquals(1, resp.getTotalItems());
    }

    @Test
    void getJobStatus_crossTenant_throws403Forbidden() throws ExecutionException, InterruptedException {
        SyncJob job = new SyncJob("job_cross", "tenant_other", "store_other", "sc_other",
                SyncJobType.PRODUCT_SYNC.name(), SyncJobStatus.COMPLETED.name(), Collections.singletonList("prod_705"),
                1, 1, 1, 0, null, null, null, "2026-09-23T00:00:00Z", "2026-09-23T00:00:00Z");

        when(syncJobRepository.findById("job_cross")).thenReturn(job);

        assertThrows(ForbiddenException.class, () ->
                syncJobService.getJobStatus(mockToken, "store_5fcd29b2b01c", "job_cross"));
    }

    @Test
    void getJobStatus_notFound_throws404NotFound() throws ExecutionException, InterruptedException {
        when(syncJobRepository.findById("job_none")).thenReturn(null);

        assertThrows(NotFoundException.class, () ->
                syncJobService.getJobStatus(mockToken, "store_5fcd29b2b01c", "job_none"));
    }

    @Test
    void listJobsForStore_success() throws ExecutionException, InterruptedException {
        SyncJob job = new SyncJob("job_123", "tenant_da7590066509", "store_5fcd29b2b01c", "sc_141e517b19ea",
                SyncJobType.PRODUCT_SYNC.name(), SyncJobStatus.COMPLETED.name(), Collections.singletonList("prod_705"),
                1, 1, 1, 0, null, null, null, "2026-09-23T00:00:00Z", "2026-09-23T00:00:00Z");

        when(syncJobRepository.findAllByStore("tenant_da7590066509", "store_5fcd29b2b01c"))
                .thenReturn(Collections.singletonList(job));

        List<SyncJobResponse> list = syncJobService.listJobsForStore(mockToken, "store_5fcd29b2b01c");
        assertNotNull(list);
        assertEquals(1, list.size());
        assertEquals("job_123", list.get(0).getJobId());
    }

    @Test
    void asyncProcessor_executesShopifyProductService_transitionsToCompleted() throws Exception {
        SyncJob job = new SyncJob("job_async_1", "tenant_da7590066509", "store_5fcd29b2b01c", "sc_141e517b19ea",
                SyncJobType.PRODUCT_SYNC.name(), SyncJobStatus.QUEUED.name(), Collections.singletonList("prod_705"),
                1, 0, 0, 0, null, null, null, "2026-09-23T00:00:00Z", "2026-09-23T00:00:00Z");

        job.setStartedAt("2026-09-23T00:00:00Z");
        when(syncJobRepository.findById("job_async_1")).thenReturn(job);
        when(syncJobRepository.claimJobForProcessing("job_async_1")).thenReturn(job);

        Map<String, Object> syncData = new HashMap<>();
        syncData.put("shopifyProductId", "gid://shopify/Product/12345");
        ShopifyProductSyncResponse syncResp = new ShopifyProductSyncResponse(true, "Synced", false, syncData);
        when(shopifyProductService.syncProduct(eq("tenant_da7590066509"), any(Product.class), any())).thenReturn(syncResp);

        testSyncJobProcessor.processJobAsync(job).get();

        assertEquals(SyncJobStatus.COMPLETED.name(), job.getStatus());
        assertEquals(1, job.getTotalItems());
        assertEquals(1, job.getProcessedItems());
        assertEquals(1, job.getSuccessItems());
        assertEquals(0, job.getFailedItems());
        assertNotNull(job.getStartedAt());
        assertNotNull(job.getCompletedAt());
        assertNull(job.getErrorMessage());

        verify(shopifyProductService).syncProduct(eq("tenant_da7590066509"), any(Product.class), any());
    }

    @Test
    void asyncProcessor_partialFailure_transitionsToPartial() throws Exception {
        Product prod2 = new Product();
        prod2.setId("prod_failed");
        prod2.setProductCode("FAIL_CODE");
        prod2.setProductName("Broken Product");

        when(productRepository.findByDocumentId("prod_failed")).thenReturn(prod2);
        when(productRepository.findById("prod_failed")).thenReturn(prod2);

        SyncJob job = new SyncJob("job_async_partial", "tenant_da7590066509", "store_5fcd29b2b01c", "sc_141e517b19ea",
                SyncJobType.PRODUCT_SYNC.name(), SyncJobStatus.QUEUED.name(), Arrays.asList("prod_705", "prod_failed"),
                2, 0, 0, 0, null, null, null, "2026-09-23T00:00:00Z", "2026-09-23T00:00:00Z");

        when(syncJobRepository.findById("job_async_partial")).thenReturn(job);
        when(syncJobRepository.claimJobForProcessing("job_async_partial")).thenReturn(job);

        ShopifyProductSyncResponse successResp = new ShopifyProductSyncResponse(true, "Synced", false, new HashMap<>());
        ShopifyProductSyncResponse failResp = new ShopifyProductSyncResponse(false, "Shopify rate limit exceeded", false, null);

        when(shopifyProductService.syncProduct(eq("tenant_da7590066509"), argThat(p -> p != null && "prod_705".equals(p.getId())), any())).thenReturn(successResp);
        when(shopifyProductService.syncProduct(eq("tenant_da7590066509"), argThat(p -> p != null && "prod_failed".equals(p.getId())), any())).thenReturn(failResp);

        testSyncJobProcessor.processJobAsync(job).get();

        assertEquals(SyncJobStatus.PARTIAL.name(), job.getStatus());
        assertEquals(2, job.getTotalItems());
        assertEquals(2, job.getProcessedItems());
        assertEquals(1, job.getSuccessItems());
        assertEquals(1, job.getFailedItems());
        assertNotNull(job.getErrorMessage());
    }

    @Test
    void asyncProcessor_completeFailure_transitionsToFailed() throws Exception {
        SyncJob job = new SyncJob("job_async_fail", "tenant_da7590066509", "store_5fcd29b2b01c", "sc_141e517b19ea",
                SyncJobType.PRODUCT_SYNC.name(), SyncJobStatus.QUEUED.name(), Collections.singletonList("prod_705"),
                1, 0, 0, 0, null, null, null, "2026-09-23T00:00:00Z", "2026-09-23T00:00:00Z");

        when(syncJobRepository.findById("job_async_fail")).thenReturn(job);
        when(syncJobRepository.claimJobForProcessing("job_async_fail")).thenReturn(job);

        ShopifyProductSyncResponse failResp = new ShopifyProductSyncResponse(false, "GraphQL connection timeout", false, null);
        when(shopifyProductService.syncProduct(eq("tenant_da7590066509"), any(Product.class), any())).thenReturn(failResp);

        testSyncJobProcessor.processJobAsync(job).get();

        assertEquals(SyncJobStatus.FAILED.name(), job.getStatus());
        assertEquals(1, job.getProcessedItems());
        assertEquals(0, job.getSuccessItems());
        assertEquals(1, job.getFailedItems());
        assertEquals("GraphQL connection timeout", job.getErrorMessage());
    }

    @Test
    void asyncProcessor_sanitizesCredentialsInErrorMessage() {
        String sensitiveError = "Failed with token shpat_1234567890abcdef and secret=xyz123";
        String sanitized = SyncJobProcessor.sanitizeErrorMessage(sensitiveError);

        assertFalse(sanitized.contains("shpat_1234567890abcdef"));
        assertFalse(sanitized.contains("xyz123"));
        assertTrue(sanitized.contains("[REDACTED]"));
    }

    @Test
    void asyncProcessor_nullJob_skipsGracefullyWithoutExecutingSync() throws Exception {
        // When processJobAsync receives null (safety guard)
        testSyncJobProcessor.processJobAsync(null).get();

        // Must not call syncProduct or save anything
        verify(shopifyProductService, never()).syncProduct(any(), any(), any());
        verify(syncJobRepository, never()).save(any());
    }
}
