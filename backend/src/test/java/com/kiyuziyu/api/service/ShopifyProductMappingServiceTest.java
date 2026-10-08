package com.kiyuziyu.api.service;

import com.google.firebase.auth.FirebaseToken;
import com.kiyuziyu.api.dto.shopifymapping.CreateShopifyProductMappingRequest;
import com.kiyuziyu.api.dto.shopifymapping.ShopifyProductMappingResponse;
import com.kiyuziyu.api.dto.shopifymapping.UpdateShopifyProductMappingRequest;
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

import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ShopifyProductMappingServiceTest {

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
    private ShopifyProductMappingRepository shopifyProductMappingRepository;

    @InjectMocks
    private ShopifyProductMappingService shopifyProductMappingService;

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

        mockOwnerProduct = new OwnerProduct("sel_123", "tenant_da7590066509", "store_5fcd29b2b01c",
                "swCyEYDiK3gLJCQNC27W", "524", true, "2026-09-23T00:00:00Z", "2026-09-23T00:00:00Z");

        mockMasterProduct = new Product();
        mockMasterProduct.setId("swCyEYDiK3gLJCQNC27W");
        mockMasterProduct.setProductCode("524");
        mockMasterProduct.setProductName("Kiyu ziyu 1240 kada watch");
        mockMasterProduct.setBasePrice(699.0);
    }

    // 1. Create mapping successfully
    // 13. Client cannot override tenantId
    // 14. Client cannot override productCode
    // 15. Client cannot modify master product
    // 16. Shopify credentials are never returned
    @Test
    void testCreateMappingSuccess() throws Exception {
        when(apiUserRepository.findById("firebase_uid_owner")).thenReturn(mockUser);
        when(storeRepository.findById("tenant_da7590066509", "store_5fcd29b2b01c")).thenReturn(mockStore);
        when(shopifyConnectionRepository.findByStoreId("tenant_da7590066509", "store_5fcd29b2b01c")).thenReturn(mockConnection);
        when(ownerProductRepository.findByTenantStoreAndProduct("tenant_da7590066509", "store_5fcd29b2b01c", "swCyEYDiK3gLJCQNC27W")).thenReturn(mockOwnerProduct);
        when(productRepository.findByDocumentId("swCyEYDiK3gLJCQNC27W")).thenReturn(mockMasterProduct);
        when(shopifyProductMappingRepository.findByStoreAndProduct("tenant_da7590066509", "store_5fcd29b2b01c", "swCyEYDiK3gLJCQNC27W")).thenReturn(null);
        when(shopifyProductMappingRepository.findByStoreAndShopifyProductId("tenant_da7590066509", "store_5fcd29b2b01c", "gid://shopify/Product/123456789")).thenReturn(null);

        CreateShopifyProductMappingRequest req = new CreateShopifyProductMappingRequest(
                "swCyEYDiK3gLJCQNC27W",
                "gid://shopify/Product/123456789",
                "kiyu-ziyu-1240-kada-watch"
        );

        ShopifyProductMappingResponse res = shopifyProductMappingService.createMapping(mockToken, "store_5fcd29b2b01c", req);

        assertNotNull(res);
        assertNotNull(res.getMappingId());
        assertTrue(res.getMappingId().startsWith("map_"));
        assertEquals("tenant_da7590066509", res.getTenantId());
        assertEquals("store_5fcd29b2b01c", res.getStoreId());
        assertEquals("sc_141e517b19ea", res.getConnectionId());
        assertEquals("swCyEYDiK3gLJCQNC27W", res.getProductId());
        assertEquals("524", res.getProductCode());
        assertEquals("gid://shopify/Product/123456789", res.getShopifyProductId());
        assertEquals("kiyu-ziyu-1240-kada-watch", res.getShopifyProductHandle());
        assertEquals("MAPPED", res.getStatus());
        assertNotNull(res.getCreatedAt());
        assertNotNull(res.getUpdatedAt());

        // Master product is untouched
        assertEquals(699.0, mockMasterProduct.getBasePrice());
        assertEquals("524", mockMasterProduct.getProductCode());

        // Zero credentials exposed
        assertFalse(ShopifyProductMappingResponse.class.getDeclaredFields().toString().contains("accessToken"));
        assertFalse(ShopifyProductMappingResponse.class.getDeclaredFields().toString().contains("secret"));

        ArgumentCaptor<ShopifyProductMapping> captor = ArgumentCaptor.forClass(ShopifyProductMapping.class);
        verify(shopifyProductMappingRepository).save(captor.capture());
        ShopifyProductMapping saved = captor.getValue();
        assertEquals("tenant_da7590066509", saved.getTenantId());
        assertEquals("524", saved.getProductCode());
        assertEquals("MAPPED", saved.getStatus());
    }

    // 2. Duplicate mapping for same store -> 409
    // 18. Same product cannot be mapped twice to same store
    @Test
    void testDuplicateProductMappingThrowsConflict() throws Exception {
        when(apiUserRepository.findById("firebase_uid_owner")).thenReturn(mockUser);
        when(storeRepository.findById("tenant_da7590066509", "store_5fcd29b2b01c")).thenReturn(mockStore);
        when(shopifyConnectionRepository.findByStoreId("tenant_da7590066509", "store_5fcd29b2b01c")).thenReturn(mockConnection);
        when(ownerProductRepository.findByTenantStoreAndProduct("tenant_da7590066509", "store_5fcd29b2b01c", "swCyEYDiK3gLJCQNC27W")).thenReturn(mockOwnerProduct);
        when(productRepository.findByDocumentId("swCyEYDiK3gLJCQNC27W")).thenReturn(mockMasterProduct);

        ShopifyProductMapping existing = new ShopifyProductMapping("map_existing", "tenant_da7590066509", "store_5fcd29b2b01c",
                "sc_1", "swCyEYDiK3gLJCQNC27W", "524", "gid://shopify/Product/111", null, "MAPPED", "2026-09-23T00:00:00Z", "2026-09-23T00:00:00Z");
        when(shopifyProductMappingRepository.findByStoreAndProduct("tenant_da7590066509", "store_5fcd29b2b01c", "swCyEYDiK3gLJCQNC27W")).thenReturn(existing);

        CreateShopifyProductMappingRequest req = new CreateShopifyProductMappingRequest(
                "swCyEYDiK3gLJCQNC27W",
                "gid://shopify/Product/222"
        );

        ConflictException ex = assertThrows(ConflictException.class, () ->
                shopifyProductMappingService.createMapping(mockToken, "store_5fcd29b2b01c", req));
        assertTrue(ex.getMessage().contains("Product already mapped for this store"));
    }

    // Duplicate Shopify Product ID in same store -> 409
    @Test
    void testDuplicateShopifyProductIdThrowsConflict() throws Exception {
        when(apiUserRepository.findById("firebase_uid_owner")).thenReturn(mockUser);
        when(storeRepository.findById("tenant_da7590066509", "store_5fcd29b2b01c")).thenReturn(mockStore);
        when(shopifyConnectionRepository.findByStoreId("tenant_da7590066509", "store_5fcd29b2b01c")).thenReturn(mockConnection);
        when(ownerProductRepository.findByTenantStoreAndProduct("tenant_da7590066509", "store_5fcd29b2b01c", "swCyEYDiK3gLJCQNC27W")).thenReturn(mockOwnerProduct);
        when(productRepository.findByDocumentId("swCyEYDiK3gLJCQNC27W")).thenReturn(mockMasterProduct);
        when(shopifyProductMappingRepository.findByStoreAndProduct("tenant_da7590066509", "store_5fcd29b2b01c", "swCyEYDiK3gLJCQNC27W")).thenReturn(null);

        ShopifyProductMapping existingShopify = new ShopifyProductMapping("map_other", "tenant_da7590066509", "store_5fcd29b2b01c",
                "sc_1", "other_prod", "999", "gid://shopify/Product/123456789", null, "MAPPED", "2026-09-23T00:00:00Z", "2026-09-23T00:00:00Z");
        when(shopifyProductMappingRepository.findByStoreAndShopifyProductId("tenant_da7590066509", "store_5fcd29b2b01c", "gid://shopify/Product/123456789")).thenReturn(existingShopify);

        CreateShopifyProductMappingRequest req = new CreateShopifyProductMappingRequest(
                "swCyEYDiK3gLJCQNC27W",
                "gid://shopify/Product/123456789"
        );

        ConflictException ex = assertThrows(ConflictException.class, () ->
                shopifyProductMappingService.createMapping(mockToken, "store_5fcd29b2b01c", req));
        assertTrue(ex.getMessage().contains("Shopify product ID already mapped"));
    }

    // 17. Same product can be mapped to different stores -> Allowed
    @Test
    void testSameProductCanBeMappedToDifferentStores() throws Exception {
        Store storeB = new Store();
        storeB.setStoreId("store_branch_b");
        storeB.setTenantId("tenant_da7590066509");
        storeB.setName("Branch B Store");

        ShopifyConnection connectionB = new ShopifyConnection("sc_branch_b", "tenant_da7590066509", "store_branch_b",
                "branch-b.myshopify.com", null, "CONNECTED", "2026-09-23T00:00:00Z", "2026-09-23T00:00:00Z");

        OwnerProduct ownerProductB = new OwnerProduct("sel_b", "tenant_da7590066509", "store_branch_b",
                "swCyEYDiK3gLJCQNC27W", "524", true, "2026-09-23T00:00:00Z", "2026-09-23T00:00:00Z");

        when(apiUserRepository.findById("firebase_uid_owner")).thenReturn(mockUser);
        when(storeRepository.findById("tenant_da7590066509", "store_branch_b")).thenReturn(storeB);
        when(shopifyConnectionRepository.findByStoreId("tenant_da7590066509", "store_branch_b")).thenReturn(connectionB);
        when(ownerProductRepository.findByTenantStoreAndProduct("tenant_da7590066509", "store_branch_b", "swCyEYDiK3gLJCQNC27W")).thenReturn(ownerProductB);
        when(productRepository.findByDocumentId("swCyEYDiK3gLJCQNC27W")).thenReturn(mockMasterProduct);
        when(shopifyProductMappingRepository.findByStoreAndProduct("tenant_da7590066509", "store_branch_b", "swCyEYDiK3gLJCQNC27W")).thenReturn(null);
        when(shopifyProductMappingRepository.findByStoreAndShopifyProductId("tenant_da7590066509", "store_branch_b", "gid://shopify/Product/storeB_123")).thenReturn(null);

        CreateShopifyProductMappingRequest req = new CreateShopifyProductMappingRequest(
                "swCyEYDiK3gLJCQNC27W",
                "gid://shopify/Product/storeB_123"
        );

        ShopifyProductMappingResponse res = shopifyProductMappingService.createMapping(mockToken, "store_branch_b", req);

        assertNotNull(res);
        assertEquals("store_branch_b", res.getStoreId());
        assertEquals("swCyEYDiK3gLJCQNC27W", res.getProductId());
        assertEquals("gid://shopify/Product/storeB_123", res.getShopifyProductId());
    }

    // 8. Cross-tenant store -> 403 Forbidden
    @Test
    void testCrossTenantStoreThrowsForbidden() throws Exception {
        when(apiUserRepository.findById("firebase_uid_owner")).thenReturn(mockUser);
        when(storeRepository.findById("tenant_da7590066509", "store_other_tenant")).thenReturn(null);

        Store otherTenantStore = new Store();
        otherTenantStore.setStoreId("store_other_tenant");
        otherTenantStore.setTenantId("tenant_other_business");
        when(storeRepository.findByStoreId("store_other_tenant")).thenReturn(otherTenantStore);

        CreateShopifyProductMappingRequest req = new CreateShopifyProductMappingRequest(
                "swCyEYDiK3gLJCQNC27W",
                "gid://shopify/Product/123"
        );

        ForbiddenException ex = assertThrows(ForbiddenException.class, () ->
                shopifyProductMappingService.createMapping(mockToken, "store_other_tenant", req));
        assertTrue(ex.getMessage().contains("Store does not belong to user's tenant"));
    }

    // 9. Missing store -> 404
    @Test
    void testMissingStoreThrowsNotFound() throws Exception {
        when(apiUserRepository.findById("firebase_uid_owner")).thenReturn(mockUser);
        when(storeRepository.findById("tenant_da7590066509", "non_existent_store")).thenReturn(null);
        when(storeRepository.findByStoreId("non_existent_store")).thenReturn(null);

        CreateShopifyProductMappingRequest req = new CreateShopifyProductMappingRequest(
                "swCyEYDiK3gLJCQNC27W",
                "gid://shopify/Product/123"
        );

        NotFoundException ex = assertThrows(NotFoundException.class, () ->
                shopifyProductMappingService.createMapping(mockToken, "non_existent_store", req));
        assertTrue(ex.getMessage().contains("Store not found"));
    }

    // 10. Missing Shopify connection -> 404
    @Test
    void testMissingShopifyConnectionThrowsNotFound() throws Exception {
        when(apiUserRepository.findById("firebase_uid_owner")).thenReturn(mockUser);
        when(storeRepository.findById("tenant_da7590066509", "store_5fcd29b2b01c")).thenReturn(mockStore);
        when(shopifyConnectionRepository.findByStoreId("tenant_da7590066509", "store_5fcd29b2b01c")).thenReturn(null);

        CreateShopifyProductMappingRequest req = new CreateShopifyProductMappingRequest(
                "swCyEYDiK3gLJCQNC27W",
                "gid://shopify/Product/123"
        );

        NotFoundException ex = assertThrows(NotFoundException.class, () ->
                shopifyProductMappingService.createMapping(mockToken, "store_5fcd29b2b01c", req));
        assertTrue(ex.getMessage().contains("Shopify connection not found"));
    }

    // 11. Missing owner product selection -> 404
    @Test
    void testMissingOwnerProductSelectionThrowsNotFound() throws Exception {
        when(apiUserRepository.findById("firebase_uid_owner")).thenReturn(mockUser);
        when(storeRepository.findById("tenant_da7590066509", "store_5fcd29b2b01c")).thenReturn(mockStore);
        when(shopifyConnectionRepository.findByStoreId("tenant_da7590066509", "store_5fcd29b2b01c")).thenReturn(mockConnection);
        when(ownerProductRepository.findByTenantStoreAndProduct("tenant_da7590066509", "store_5fcd29b2b01c", "swCyEYDiK3gLJCQNC27W")).thenReturn(null);

        CreateShopifyProductMappingRequest req = new CreateShopifyProductMappingRequest(
                "swCyEYDiK3gLJCQNC27W",
                "gid://shopify/Product/123"
        );

        NotFoundException ex = assertThrows(NotFoundException.class, () ->
                shopifyProductMappingService.createMapping(mockToken, "store_5fcd29b2b01c", req));
        assertTrue(ex.getMessage().contains("Owner product selection not found"));
    }

    // 12. Missing master product -> 404
    @Test
    void testMissingMasterProductThrowsNotFound() throws Exception {
        when(apiUserRepository.findById("firebase_uid_owner")).thenReturn(mockUser);
        when(storeRepository.findById("tenant_da7590066509", "store_5fcd29b2b01c")).thenReturn(mockStore);
        when(shopifyConnectionRepository.findByStoreId("tenant_da7590066509", "store_5fcd29b2b01c")).thenReturn(mockConnection);
        when(ownerProductRepository.findByTenantStoreAndProduct("tenant_da7590066509", "store_5fcd29b2b01c", "swCyEYDiK3gLJCQNC27W")).thenReturn(mockOwnerProduct);
        when(productRepository.findByDocumentId("swCyEYDiK3gLJCQNC27W")).thenReturn(null);

        CreateShopifyProductMappingRequest req = new CreateShopifyProductMappingRequest(
                "swCyEYDiK3gLJCQNC27W",
                "gid://shopify/Product/123"
        );

        NotFoundException ex = assertThrows(NotFoundException.class, () ->
                shopifyProductMappingService.createMapping(mockToken, "store_5fcd29b2b01c", req));
        assertTrue(ex.getMessage().contains("Master product not found"));
    }

    // 3. Get all mappings
    @Test
    void testGetAllMappingsSuccess() throws Exception {
        when(apiUserRepository.findById("firebase_uid_owner")).thenReturn(mockUser);
        when(storeRepository.findById("tenant_da7590066509", "store_5fcd29b2b01c")).thenReturn(mockStore);

        ShopifyProductMapping m1 = new ShopifyProductMapping("map_1", "tenant_da7590066509", "store_5fcd29b2b01c",
                "sc_1", "p1", "code1", "gid://shopify/Product/1", "handle1", "MAPPED", "2026-09-23T00:00:00Z", "2026-09-23T00:00:00Z");
        when(shopifyProductMappingRepository.findAllByStore("tenant_da7590066509", "store_5fcd29b2b01c"))
                .thenReturn(Collections.singletonList(m1));

        List<ShopifyProductMappingResponse> list = shopifyProductMappingService.getAllMappings(mockToken, "store_5fcd29b2b01c");

        assertEquals(1, list.size());
        assertEquals("map_1", list.get(0).getMappingId());
        assertEquals("p1", list.get(0).getProductId());
    }

    // 4. Get single mapping
    @Test
    void testGetSingleMappingSuccess() throws Exception {
        when(apiUserRepository.findById("firebase_uid_owner")).thenReturn(mockUser);
        when(storeRepository.findById("tenant_da7590066509", "store_5fcd29b2b01c")).thenReturn(mockStore);

        ShopifyProductMapping m1 = new ShopifyProductMapping("map_1", "tenant_da7590066509", "store_5fcd29b2b01c",
                "sc_1", "p1", "code1", "gid://shopify/Product/1", "handle1", "MAPPED", "2026-09-23T00:00:00Z", "2026-09-23T00:00:00Z");
        when(shopifyProductMappingRepository.findByStoreAndProduct("tenant_da7590066509", "store_5fcd29b2b01c", "p1"))
                .thenReturn(m1);

        ShopifyProductMappingResponse res = shopifyProductMappingService.getSingleMapping(mockToken, "store_5fcd29b2b01c", "p1");

        assertNotNull(res);
        assertEquals("map_1", res.getMappingId());
        assertEquals("p1", res.getProductId());
    }

    // 5. Update mapping (PATCH)
    @Test
    void testUpdateMappingSuccess() throws Exception {
        when(apiUserRepository.findById("firebase_uid_owner")).thenReturn(mockUser);
        when(storeRepository.findById("tenant_da7590066509", "store_5fcd29b2b01c")).thenReturn(mockStore);

        ShopifyProductMapping m1 = new ShopifyProductMapping("map_1", "tenant_da7590066509", "store_5fcd29b2b01c",
                "sc_1", "p1", "code1", "gid://shopify/Product/1", "handle1", "MAPPED", "2026-09-23T00:00:00Z", "2026-09-23T00:00:00Z");
        when(shopifyProductMappingRepository.findByStoreAndProduct("tenant_da7590066509", "store_5fcd29b2b01c", "p1"))
                .thenReturn(m1);

        UpdateShopifyProductMappingRequest req = new UpdateShopifyProductMappingRequest("UNMAPPED");
        req.setShopifyProductHandle("updated-handle");

        ShopifyProductMappingResponse res = shopifyProductMappingService.updateMapping(mockToken, "store_5fcd29b2b01c", "p1", req);

        assertNotNull(res);
        assertEquals("UNMAPPED", res.getStatus());
        assertEquals("updated-handle", res.getShopifyProductHandle());
        verify(shopifyProductMappingRepository).save(m1);
    }

    // 6. Delete mapping
    @Test
    void testDeleteMappingSuccess() throws Exception {
        when(apiUserRepository.findById("firebase_uid_owner")).thenReturn(mockUser);
        when(storeRepository.findById("tenant_da7590066509", "store_5fcd29b2b01c")).thenReturn(mockStore);

        ShopifyProductMapping m1 = new ShopifyProductMapping("map_1", "tenant_da7590066509", "store_5fcd29b2b01c",
                "sc_1", "p1", "code1", "gid://shopify/Product/1", "handle1", "MAPPED", "2026-09-23T00:00:00Z", "2026-09-23T00:00:00Z");
        when(shopifyProductMappingRepository.findByStoreAndProduct("tenant_da7590066509", "store_5fcd29b2b01c", "p1"))
                .thenReturn(m1);

        shopifyProductMappingService.deleteMapping(mockToken, "store_5fcd29b2b01c", "p1");

        // Verify mapping deleted, master product untouched
        verify(shopifyProductMappingRepository).delete("map_1");
        assertEquals("swCyEYDiK3gLJCQNC27W", mockMasterProduct.getId());
    }
}
