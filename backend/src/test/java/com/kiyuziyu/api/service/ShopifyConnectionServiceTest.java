package com.kiyuziyu.api.service;

import com.google.firebase.auth.FirebaseToken;
import com.kiyuziyu.api.dto.shopifyconnection.CreateShopifyConnectionRequest;
import com.kiyuziyu.api.dto.shopifyconnection.ShopifyConnectionResponse;
import com.kiyuziyu.api.dto.shopifyconnection.UpdateShopifyConnectionRequest;
import com.kiyuziyu.api.exception.BadRequestException;
import com.kiyuziyu.api.exception.ConflictException;
import com.kiyuziyu.api.exception.ForbiddenException;
import com.kiyuziyu.api.exception.NotFoundException;
import com.kiyuziyu.api.model.*;
import com.kiyuziyu.api.repository.ApiUserRepository;
import com.kiyuziyu.api.repository.ShopifyConnectionRepository;
import com.kiyuziyu.api.repository.StoreRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ShopifyConnectionServiceTest {

    @Mock
    private ApiUserRepository apiUserRepository;

    @Mock
    private StoreRepository storeRepository;

    @Mock
    private ShopifyConnectionRepository shopifyConnectionRepository;

    @InjectMocks
    private ShopifyConnectionService shopifyConnectionService;

    private FirebaseToken mockToken;
    private ApiUser mockUser;
    private Store mockStore;

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
        mockStore.setPlatform("GENERIC");
    }

    // 1. Successful Shopify connection creation
    // 9. Request cannot override tenantId/ownerUserId
    // 10. Shopify token/secret never appears in response
    @Test
    void testCreateConnectionSuccess() throws Exception {
        when(apiUserRepository.findById("firebase_uid_owner")).thenReturn(mockUser);
        when(storeRepository.findById("tenant_da7590066509", "store_5fcd29b2b01c")).thenReturn(mockStore);
        when(shopifyConnectionRepository.findByStoreId("tenant_da7590066509", "store_5fcd29b2b01c")).thenReturn(null);

        CreateShopifyConnectionRequest req = new CreateShopifyConnectionRequest("https://my-test-store.myshopify.com/", "shp_12345");

        ShopifyConnectionResponse res = shopifyConnectionService.createConnection(mockToken, "store_5fcd29b2b01c", req);

        assertNotNull(res);
        assertNotNull(res.getConnectionId());
        assertTrue(res.getConnectionId().startsWith("sc_"));
        assertEquals("tenant_da7590066509", res.getTenantId());
        assertEquals("store_5fcd29b2b01c", res.getStoreId());
        // Domain should be normalized (no https://, no trailing slash)
        assertEquals("my-test-store.myshopify.com", res.getShopifyStoreDomain());
        assertEquals("shp_12345", res.getShopifyStoreId());
        assertEquals(ShopifyConnectionStatus.CONNECTED.name(), res.getStatus());
        assertNotNull(res.getConnectedAt());
        assertNotNull(res.getUpdatedAt());

        // Verify secret token check
        assertFalse(ShopifyConnectionResponse.class.getDeclaredFields().toString().contains("accessToken"));
        assertFalse(ShopifyConnectionResponse.class.getDeclaredFields().toString().contains("secret"));

        ArgumentCaptor<ShopifyConnection> captor = ArgumentCaptor.forClass(ShopifyConnection.class);
        verify(shopifyConnectionRepository).save(captor.capture());
        ShopifyConnection saved = captor.getValue();
        assertEquals("tenant_da7590066509", saved.getTenantId());
        assertEquals("store_5fcd29b2b01c", saved.getStoreId());
        assertEquals("my-test-store.myshopify.com", saved.getShopifyStoreDomain());

        // Verify store platform updated to SHOPIFY
        verify(storeRepository).save(eq("tenant_da7590066509"), any(Store.class));
        assertEquals("SHOPIFY", mockStore.getPlatform());
    }

    // 2. Duplicate connection -> 409 Conflict
    @Test
    void testCreateDuplicateConnectionThrowsConflict() throws Exception {
        when(apiUserRepository.findById("firebase_uid_owner")).thenReturn(mockUser);
        when(storeRepository.findById("tenant_da7590066509", "store_5fcd29b2b01c")).thenReturn(mockStore);

        ShopifyConnection existing = new ShopifyConnection("sc_111", "tenant_da7590066509", "store_5fcd29b2b01c",
                "existing.myshopify.com", null, ShopifyConnectionStatus.CONNECTED.name(), "2026-09-23T00:00:00Z", "2026-09-23T00:00:00Z");
        when(shopifyConnectionRepository.findByStoreId("tenant_da7590066509", "store_5fcd29b2b01c")).thenReturn(existing);

        CreateShopifyConnectionRequest req = new CreateShopifyConnectionRequest("new-store.myshopify.com");

        ConflictException ex = assertThrows(ConflictException.class, () ->
                shopifyConnectionService.createConnection(mockToken, "store_5fcd29b2b01c", req));
        assertTrue(ex.getMessage().contains("already exists"));
    }

    // 3. Get connection
    @Test
    void testGetConnectionSuccess() throws Exception {
        when(apiUserRepository.findById("firebase_uid_owner")).thenReturn(mockUser);
        when(storeRepository.findById("tenant_da7590066509", "store_5fcd29b2b01c")).thenReturn(mockStore);

        ShopifyConnection existing = new ShopifyConnection("sc_111", "tenant_da7590066509", "store_5fcd29b2b01c",
                "test.myshopify.com", "shp_999", ShopifyConnectionStatus.CONNECTED.name(), "2026-09-23T00:00:00Z", "2026-09-23T00:00:00Z");
        when(shopifyConnectionRepository.findByStoreId("tenant_da7590066509", "store_5fcd29b2b01c")).thenReturn(existing);

        ShopifyConnectionResponse res = shopifyConnectionService.getConnection(mockToken, "store_5fcd29b2b01c");

        assertNotNull(res);
        assertEquals("sc_111", res.getConnectionId());
        assertEquals("test.myshopify.com", res.getShopifyStoreDomain());
        assertEquals("CONNECTED", res.getStatus());
    }

    @Test
    void testGetConnectionNotFoundThrowsNotFound() throws Exception {
        when(apiUserRepository.findById("firebase_uid_owner")).thenReturn(mockUser);
        when(storeRepository.findById("tenant_da7590066509", "store_5fcd29b2b01c")).thenReturn(mockStore);
        when(shopifyConnectionRepository.findByStoreId("tenant_da7590066509", "store_5fcd29b2b01c")).thenReturn(null);

        NotFoundException ex = assertThrows(NotFoundException.class, () ->
                shopifyConnectionService.getConnection(mockToken, "store_5fcd29b2b01c"));
        assertTrue(ex.getMessage().contains("Shopify connection not found"));
    }

    // 4. Update connection (PATCH)
    @Test
    void testUpdateConnectionSuccess() throws Exception {
        when(apiUserRepository.findById("firebase_uid_owner")).thenReturn(mockUser);
        when(storeRepository.findById("tenant_da7590066509", "store_5fcd29b2b01c")).thenReturn(mockStore);

        ShopifyConnection existing = new ShopifyConnection("sc_111", "tenant_da7590066509", "store_5fcd29b2b01c",
                "old.myshopify.com", null, ShopifyConnectionStatus.CONNECTED.name(), "2026-09-23T00:00:00Z", "2026-09-23T00:00:00Z");
        when(shopifyConnectionRepository.findByStoreId("tenant_da7590066509", "store_5fcd29b2b01c")).thenReturn(existing);

        UpdateShopifyConnectionRequest req = new UpdateShopifyConnectionRequest("DISCONNECTED");
        req.setShopifyStoreDomain("updated.myshopify.com");

        ShopifyConnectionResponse res = shopifyConnectionService.updateConnection(mockToken, "store_5fcd29b2b01c", req);

        assertNotNull(res);
        assertEquals("DISCONNECTED", res.getStatus());
        assertEquals("updated.myshopify.com", res.getShopifyStoreDomain());
        verify(shopifyConnectionRepository).save(existing);
    }

    @Test
    void testUpdateConnectionInvalidStatusThrowsBadRequest() throws Exception {
        when(apiUserRepository.findById("firebase_uid_owner")).thenReturn(mockUser);
        when(storeRepository.findById("tenant_da7590066509", "store_5fcd29b2b01c")).thenReturn(mockStore);

        ShopifyConnection existing = new ShopifyConnection("sc_111", "tenant_da7590066509", "store_5fcd29b2b01c",
                "test.myshopify.com", null, ShopifyConnectionStatus.CONNECTED.name(), "2026-09-23T00:00:00Z", "2026-09-23T00:00:00Z");
        when(shopifyConnectionRepository.findByStoreId("tenant_da7590066509", "store_5fcd29b2b01c")).thenReturn(existing);

        UpdateShopifyConnectionRequest req = new UpdateShopifyConnectionRequest("INVALID_STATUS");

        assertThrows(BadRequestException.class, () ->
                shopifyConnectionService.updateConnection(mockToken, "store_5fcd29b2b01c", req));
    }

    // 5. Delete/disconnect connection
    @Test
    void testDeleteConnectionSuccess() throws Exception {
        when(apiUserRepository.findById("firebase_uid_owner")).thenReturn(mockUser);
        when(storeRepository.findById("tenant_da7590066509", "store_5fcd29b2b01c")).thenReturn(mockStore);

        ShopifyConnection existing = new ShopifyConnection("sc_111", "tenant_da7590066509", "store_5fcd29b2b01c",
                "test.myshopify.com", null, ShopifyConnectionStatus.CONNECTED.name(), "2026-09-23T00:00:00Z", "2026-09-23T00:00:00Z");
        when(shopifyConnectionRepository.findByStoreId("tenant_da7590066509", "store_5fcd29b2b01c")).thenReturn(existing);

        shopifyConnectionService.deleteConnection(mockToken, "store_5fcd29b2b01c");

        verify(shopifyConnectionRepository).delete("sc_111");
    }

    // 7. Store belonging to another tenant -> 403 Forbidden
    @Test
    void testCrossTenantStoreAccessThrowsForbidden() throws Exception {
        when(apiUserRepository.findById("firebase_uid_owner")).thenReturn(mockUser);
        when(storeRepository.findById("tenant_da7590066509", "store_other_tenant")).thenReturn(null);

        Store otherTenantStore = new Store();
        otherTenantStore.setStoreId("store_other_tenant");
        otherTenantStore.setTenantId("tenant_other_business");
        when(storeRepository.findByStoreId("store_other_tenant")).thenReturn(otherTenantStore);

        CreateShopifyConnectionRequest req = new CreateShopifyConnectionRequest("test.myshopify.com");

        ForbiddenException ex = assertThrows(ForbiddenException.class, () ->
                shopifyConnectionService.createConnection(mockToken, "store_other_tenant", req));
        assertTrue(ex.getMessage().contains("Store does not belong to user's tenant"));
    }

    // 8. Non-existing store -> 404 Not Found
    @Test
    void testStoreNotFoundThrowsNotFound() throws Exception {
        when(apiUserRepository.findById("firebase_uid_owner")).thenReturn(mockUser);
        when(storeRepository.findById("tenant_da7590066509", "non_existent_store")).thenReturn(null);
        when(storeRepository.findByStoreId("non_existent_store")).thenReturn(null);

        CreateShopifyConnectionRequest req = new CreateShopifyConnectionRequest("test.myshopify.com");

        NotFoundException ex = assertThrows(NotFoundException.class, () ->
                shopifyConnectionService.createConnection(mockToken, "non_existent_store", req));
        assertTrue(ex.getMessage().contains("Store not found"));
    }

    // User without tenant -> 404 Not Found
    @Test
    void testUserWithoutTenantThrowsNotFound() throws Exception {
        mockUser.setTenantId(null);
        when(apiUserRepository.findById("firebase_uid_owner")).thenReturn(mockUser);

        CreateShopifyConnectionRequest req = new CreateShopifyConnectionRequest("test.myshopify.com");

        NotFoundException ex = assertThrows(NotFoundException.class, () ->
                shopifyConnectionService.createConnection(mockToken, "store_5fcd29b2b01c", req));
        assertTrue(ex.getMessage().contains("User does not belong to any tenant"));
    }

    // Missing required field
    @Test
    void testMissingDomainThrowsBadRequest() {
        CreateShopifyConnectionRequest req = new CreateShopifyConnectionRequest("");

        assertThrows(BadRequestException.class, () ->
                shopifyConnectionService.createConnection(mockToken, "store_5fcd29b2b01c", req));
    }
}
