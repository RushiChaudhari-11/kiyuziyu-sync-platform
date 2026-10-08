package com.kiyuziyu.api.service;

import com.google.firebase.auth.FirebaseToken;
import com.kiyuziyu.api.dto.store.CreateStoreRequest;
import com.kiyuziyu.api.dto.store.StoreResponse;
import com.kiyuziyu.api.exception.ConflictException;
import com.kiyuziyu.api.model.Store;
import com.kiyuziyu.api.model.StorePlatform;
import com.kiyuziyu.api.model.StoreStatus;
import com.kiyuziyu.api.repository.StoreRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.concurrent.ExecutionException;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class StoreServiceTest {

    @Mock
    private StoreRepository storeRepository;

    @Mock
    private TenantService tenantService;

    @InjectMocks
    private StoreService storeService;

    @Test
    void testCreateStoreSuccessAndEnforceRules() throws ExecutionException, InterruptedException {
        FirebaseToken mockToken = Mockito.mock(FirebaseToken.class);

        // Resolves tenantId strictly from user context
        when(tenantService.resolveTenantIdForUser(mockToken)).thenReturn("tenant_123");
        when(storeRepository.existsByCode("tenant_123", "MAIN")).thenReturn(false);

        CreateStoreRequest request = new CreateStoreRequest("Kiyuziyu Main Store", "main", "SHOPIFY");

        StoreResponse response = storeService.createStore(mockToken, request);

        ArgumentCaptor<Store> captor = ArgumentCaptor.forClass(Store.class);
        verify(storeRepository, times(1)).save(eq("tenant_123"), captor.capture());
        Store saved = captor.getValue();

        // 1. storeId generated server-side
        assertNotNull(saved.getStoreId());
        assertTrue(saved.getStoreId().startsWith("store_"));

        // 2. Bound strictly to resolved tenantId
        assertEquals("tenant_123", saved.getTenantId());

        // 3. Uppercase code
        assertEquals("MAIN", saved.getCode());
        assertEquals("Kiyuziyu Main Store", saved.getName());

        // 4. Platform SHOPIFY
        assertEquals(StorePlatform.SHOPIFY.name(), saved.getPlatform());

        // 5. Default status ACTIVE
        assertEquals(StoreStatus.ACTIVE.name(), saved.getStatus());
        assertNotNull(saved.getCreatedAt());
        assertNotNull(saved.getUpdatedAt());

        // 6. Response verification
        assertNotNull(response);
        assertEquals(saved.getStoreId(), response.getStoreId());
        assertEquals("tenant_123", response.getTenantId());
        assertEquals("MAIN", response.getCode());
    }

    @Test
    void testCreateStoreDuplicateCodeWithinTenantThrowsConflict() throws ExecutionException, InterruptedException {
        FirebaseToken mockToken = Mockito.mock(FirebaseToken.class);
        when(tenantService.resolveTenantIdForUser(mockToken)).thenReturn("tenant_123");
        when(storeRepository.existsByCode("tenant_123", "DUP")).thenReturn(true);

        CreateStoreRequest request = new CreateStoreRequest("Duplicate Store", "dup", "GENERIC");

        assertThrows(ConflictException.class, () -> storeService.createStore(mockToken, request));
        verify(storeRepository, never()).save(any(), any());
    }

    @Test
    void testGetStoresForCurrentTenantEnforcesIsolation() throws ExecutionException, InterruptedException {
        FirebaseToken mockToken = Mockito.mock(FirebaseToken.class);
        when(tenantService.resolveTenantIdForUser(mockToken)).thenReturn("tenant_tenantA");

        Store s1 = new Store("store_1", "tenant_tenantA", "Store A1", "A1", "GENERIC");
        Store s2 = new Store("store_2", "tenant_tenantA", "Store A2", "A2", "SHOPIFY");

        when(storeRepository.findAllByTenantId("tenant_tenantA")).thenReturn(List.of(s1, s2));

        List<StoreResponse> results = storeService.getStoresForCurrentTenant(mockToken);

        assertEquals(2, results.size());
        assertEquals("store_1", results.get(0).getStoreId());
        assertEquals("tenant_tenantA", results.get(0).getTenantId());
        assertEquals("store_2", results.get(1).getStoreId());
        assertEquals("tenant_tenantA", results.get(1).getTenantId());
    }
}
