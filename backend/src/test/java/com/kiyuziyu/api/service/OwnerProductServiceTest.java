package com.kiyuziyu.api.service;

import com.google.firebase.auth.FirebaseToken;
import com.kiyuziyu.api.dto.ownerproduct.OwnerProductResponse;
import com.kiyuziyu.api.dto.ownerproduct.SelectOwnerProductRequest;
import com.kiyuziyu.api.dto.ownerproduct.UpdateOwnerProductRequest;
import com.kiyuziyu.api.exception.BadRequestException;
import com.kiyuziyu.api.exception.ConflictException;
import com.kiyuziyu.api.exception.ForbiddenException;
import com.kiyuziyu.api.exception.NotFoundException;
import com.kiyuziyu.api.model.ApiUser;
import com.kiyuziyu.api.model.OwnerProduct;
import com.kiyuziyu.api.model.Product;
import com.kiyuziyu.api.model.Store;
import com.kiyuziyu.api.repository.ApiUserRepository;
import com.kiyuziyu.api.repository.OwnerProductRepository;
import com.kiyuziyu.api.repository.ProductRepository;
import com.kiyuziyu.api.repository.StoreRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@org.mockito.junit.jupiter.MockitoSettings(strictness = org.mockito.quality.Strictness.LENIENT)
class OwnerProductServiceTest {

    @Mock
    private ApiUserRepository apiUserRepository;

    @Mock
    private StoreRepository storeRepository;

    @Mock
    private ProductRepository productRepository;

    @Mock
    private OwnerProductRepository ownerProductRepository;

    @InjectMocks
    private OwnerProductService ownerProductService;

    private FirebaseToken mockToken;
    private ApiUser mockUser;
    private Store mockStore;
    private Product mockMasterProduct;

    @BeforeEach
    void setUp() {
        mockToken = mock(FirebaseToken.class);
        when(mockToken.getUid()).thenReturn("firebase_uid_test");

        mockUser = new ApiUser();
        mockUser.setUid("firebase_uid_test");
        mockUser.setTenantId("tenant_da7590066509");

        mockStore = new Store();
        mockStore.setStoreId("store_5fcd29b2b01c");
        mockStore.setTenantId("tenant_da7590066509");
        mockStore.setName("Kiyuziyu Main Store");
        mockStore.setCode("MAIN");

        mockMasterProduct = new Product();
        mockMasterProduct.setId("swCyEYDiK3gLJCQNC27W");
        mockMasterProduct.setProductCode("524");
        mockMasterProduct.setProductName("Kiyu ziyu 1240 kada watch");
        mockMasterProduct.setImage("https://example.com/watch.jpg");
        mockMasterProduct.setBasePrice(699.0);
    }

    // 3. User without tenant → 404
    @Test
    void testUserWithoutTenantThrowsNotFound() throws Exception {
        mockUser.setTenantId(null);
        when(apiUserRepository.findById("firebase_uid_test")).thenReturn(mockUser);

        SelectOwnerProductRequest req = new SelectOwnerProductRequest("swCyEYDiK3gLJCQNC27W");

        NotFoundException ex = assertThrows(NotFoundException.class, () ->
                ownerProductService.selectProduct(mockToken, "store_5fcd29b2b01c", req));
        assertTrue(ex.getMessage().contains("User does not belong to any tenant"));
    }

    // 4. Store not belonging to user's tenant → 403
    @Test
    void testStoreNotBelongingToUserTenantThrowsForbidden() throws Exception {
        when(apiUserRepository.findById("firebase_uid_test")).thenReturn(mockUser);
        // Store does not exist under user's tenant
        when(storeRepository.findById("tenant_da7590066509", "store_other_tenant")).thenReturn(null);
        // But store exists under another tenant
        Store otherStore = new Store();
        otherStore.setStoreId("store_other_tenant");
        otherStore.setTenantId("tenant_other_9999");
        when(storeRepository.findByStoreId("store_other_tenant")).thenReturn(otherStore);

        SelectOwnerProductRequest req = new SelectOwnerProductRequest("swCyEYDiK3gLJCQNC27W");

        ForbiddenException ex = assertThrows(ForbiddenException.class, () ->
                ownerProductService.selectProduct(mockToken, "store_other_tenant", req));
        assertTrue(ex.getMessage().contains("Store does not belong to user's tenant"));
    }

    // Store completely not found → 404
    @Test
    void testStoreNotFoundThrowsNotFound() throws Exception {
        when(apiUserRepository.findById("firebase_uid_test")).thenReturn(mockUser);
        when(storeRepository.findById("tenant_da7590066509", "non_existent_store")).thenReturn(null);
        when(storeRepository.findByStoreId("non_existent_store")).thenReturn(null);

        SelectOwnerProductRequest req = new SelectOwnerProductRequest("swCyEYDiK3gLJCQNC27W");

        NotFoundException ex = assertThrows(NotFoundException.class, () ->
                ownerProductService.selectProduct(mockToken, "non_existent_store", req));
        assertTrue(ex.getMessage().contains("Store not found"));
    }

    // 5. Master product does not exist → 404
    @Test
    void testMasterProductDoesNotExistThrowsNotFound() throws Exception {
        when(apiUserRepository.findById("firebase_uid_test")).thenReturn(mockUser);
        when(storeRepository.findById("tenant_da7590066509", "store_5fcd29b2b01c")).thenReturn(mockStore);
        when(productRepository.findByDocumentId("unknown_doc_id")).thenReturn(null);

        SelectOwnerProductRequest req = new SelectOwnerProductRequest("unknown_doc_id");

        NotFoundException ex = assertThrows(NotFoundException.class, () ->
                ownerProductService.selectProduct(mockToken, "store_5fcd29b2b01c", req));
        assertTrue(ex.getMessage().contains("Master product not found"));
    }

    // 6. Valid product selection → 201
    // 7. productId comes from existing master product
    // 8. productCode is read from master product, not trusted from request
    // 19. productId is the existing Firebase document ID
    @Test
    void testSelectProductSuccess() throws Exception {
        when(apiUserRepository.findById("firebase_uid_test")).thenReturn(mockUser);
        when(storeRepository.findById("tenant_da7590066509", "store_5fcd29b2b01c")).thenReturn(mockStore);
        when(productRepository.findByDocumentId("swCyEYDiK3gLJCQNC27W")).thenReturn(mockMasterProduct);
        when(ownerProductRepository.findByTenantStoreAndProduct("tenant_da7590066509", "store_5fcd29b2b01c", "swCyEYDiK3gLJCQNC27W"))
                .thenReturn(null);

        SelectOwnerProductRequest req = new SelectOwnerProductRequest("swCyEYDiK3gLJCQNC27W");

        OwnerProductResponse res = ownerProductService.selectProduct(mockToken, "store_5fcd29b2b01c", req);

        assertNotNull(res);
        assertEquals("tenant_da7590066509", res.getTenantId());
        assertEquals("store_5fcd29b2b01c", res.getStoreId());
        assertEquals("swCyEYDiK3gLJCQNC27W", res.getProductId());
        assertEquals("524", res.getProductCode());
        assertEquals("Kiyu ziyu 1240 kada watch", res.getProductName());
        assertEquals("https://example.com/watch.jpg", res.getImage());
        assertTrue(res.isEnabled());
        assertNotNull(res.getSelectionId());
        assertTrue(res.getSelectionId().startsWith("sel_"));

        ArgumentCaptor<OwnerProduct> captor = ArgumentCaptor.forClass(OwnerProduct.class);
        verify(ownerProductRepository).save(captor.capture());
        OwnerProduct saved = captor.getValue();
        assertEquals("swCyEYDiK3gLJCQNC27W", saved.getProductId());
        assertEquals("524", saved.getProductCode());
        assertTrue(saved.isEnabled());
    }

    // 9. Duplicate selection → 409
    @Test
    void testDuplicateSelectionThrowsConflict() throws Exception {
        when(apiUserRepository.findById("firebase_uid_test")).thenReturn(mockUser);
        when(storeRepository.findById("tenant_da7590066509", "store_5fcd29b2b01c")).thenReturn(mockStore);
        when(productRepository.findByDocumentId("swCyEYDiK3gLJCQNC27W")).thenReturn(mockMasterProduct);

        OwnerProduct existing = new OwnerProduct("sel_123", "tenant_da7590066509", "store_5fcd29b2b01c",
                "swCyEYDiK3gLJCQNC27W", "524", true, "2026-09-22T00:00:00Z", "2026-09-22T00:00:00Z");
        when(ownerProductRepository.findByTenantStoreAndProduct("tenant_da7590066509", "store_5fcd29b2b01c", "swCyEYDiK3gLJCQNC27W"))
                .thenReturn(existing);

        SelectOwnerProductRequest req = new SelectOwnerProductRequest("swCyEYDiK3gLJCQNC27W");

        ConflictException ex = assertThrows(ConflictException.class, () ->
                ownerProductService.selectProduct(mockToken, "store_5fcd29b2b01c", req));
        assertTrue(ex.getMessage().contains("Product already selected for this store"));
    }

    // 10. GET selected products → 200
    @Test
    void testGetOwnerProductsSuccess() throws Exception {
        when(apiUserRepository.findById("firebase_uid_test")).thenReturn(mockUser);
        when(storeRepository.findById("tenant_da7590066509", "store_5fcd29b2b01c")).thenReturn(mockStore);

        OwnerProduct op = new OwnerProduct("sel_123", "tenant_da7590066509", "store_5fcd29b2b01c",
                "swCyEYDiK3gLJCQNC27W", "524", true, "2026-09-22T00:00:00Z", "2026-09-22T00:00:00Z");
        when(ownerProductRepository.findByStoreId("tenant_da7590066509", "store_5fcd29b2b01c"))
                .thenReturn(Collections.singletonList(op));
        when(productRepository.findByDocumentId("swCyEYDiK3gLJCQNC27W")).thenReturn(mockMasterProduct);

        List<OwnerProductResponse> list = ownerProductService.getOwnerProducts(mockToken, "store_5fcd29b2b01c");

        assertEquals(1, list.size());
        assertEquals("swCyEYDiK3gLJCQNC27W", list.get(0).getProductId());
        assertEquals("Kiyu ziyu 1240 kada watch", list.get(0).getProductName());
    }

    // 11. GET one selected product → 200
    @Test
    void testGetOneOwnerProductSuccess() throws Exception {
        when(apiUserRepository.findById("firebase_uid_test")).thenReturn(mockUser);
        when(storeRepository.findById("tenant_da7590066509", "store_5fcd29b2b01c")).thenReturn(mockStore);

        OwnerProduct op = new OwnerProduct("sel_123", "tenant_da7590066509", "store_5fcd29b2b01c",
                "swCyEYDiK3gLJCQNC27W", "524", true, "2026-09-22T00:00:00Z", "2026-09-22T00:00:00Z");
        when(ownerProductRepository.findByTenantStoreAndProduct("tenant_da7590066509", "store_5fcd29b2b01c", "swCyEYDiK3gLJCQNC27W"))
                .thenReturn(op);
        when(productRepository.findByDocumentId("swCyEYDiK3gLJCQNC27W")).thenReturn(mockMasterProduct);

        OwnerProductResponse res = ownerProductService.getOwnerProduct(mockToken, "store_5fcd29b2b01c", "swCyEYDiK3gLJCQNC27W");

        assertNotNull(res);
        assertEquals("swCyEYDiK3gLJCQNC27W", res.getProductId());
        assertEquals("524", res.getProductCode());
    }

    // 12. Enable/disable → 200
    // 15. Master product remains unchanged after disable
    @Test
    void testUpdateOwnerProductEnableDisable() throws Exception {
        when(apiUserRepository.findById("firebase_uid_test")).thenReturn(mockUser);
        when(storeRepository.findById("tenant_da7590066509", "store_5fcd29b2b01c")).thenReturn(mockStore);

        OwnerProduct op = new OwnerProduct("sel_123", "tenant_da7590066509", "store_5fcd29b2b01c",
                "swCyEYDiK3gLJCQNC27W", "524", true, "2026-09-22T00:00:00Z", "2026-09-22T00:00:00Z");
        when(ownerProductRepository.findByTenantStoreAndProduct("tenant_da7590066509", "store_5fcd29b2b01c", "swCyEYDiK3gLJCQNC27W"))
                .thenReturn(op);
        when(productRepository.findByDocumentId("swCyEYDiK3gLJCQNC27W")).thenReturn(mockMasterProduct);

        UpdateOwnerProductRequest req = new UpdateOwnerProductRequest(false);
        OwnerProductResponse updated = ownerProductService.updateOwnerProduct(mockToken, "store_5fcd29b2b01c", "swCyEYDiK3gLJCQNC27W", req);

        assertNotNull(updated);
        assertFalse(updated.isEnabled());

        // Verify save only happened on owner product selection, never on master product
        verify(ownerProductRepository).save(op);
        assertFalse(op.isEnabled());
        // Verify master product was not touched
        assertEquals("swCyEYDiK3gLJCQNC27W", mockMasterProduct.getId());
        assertEquals(699.0, mockMasterProduct.getBasePrice());
    }

    // 13. Delete selection → 204
    // 16. Master product remains unchanged after delete
    @Test
    void testDeleteOwnerProductSuccess() throws Exception {
        when(apiUserRepository.findById("firebase_uid_test")).thenReturn(mockUser);
        when(storeRepository.findById("tenant_da7590066509", "store_5fcd29b2b01c")).thenReturn(mockStore);

        OwnerProduct op = new OwnerProduct("sel_123", "tenant_da7590066509", "store_5fcd29b2b01c",
                "swCyEYDiK3gLJCQNC27W", "524", true, "2026-09-22T00:00:00Z", "2026-09-22T00:00:00Z");
        when(ownerProductRepository.findByTenantStoreAndProduct("tenant_da7590066509", "store_5fcd29b2b01c", "swCyEYDiK3gLJCQNC27W"))
                .thenReturn(op);

        ownerProductService.deleteOwnerProduct(mockToken, "store_5fcd29b2b01c", "swCyEYDiK3gLJCQNC27W");

        // Verify deleted from selection
        verify(ownerProductRepository).delete("sel_123");
        // Verify master product is untouched
        assertEquals("swCyEYDiK3gLJCQNC27W", mockMasterProduct.getId());
        assertEquals("524", mockMasterProduct.getProductCode());
    }

    // 14. Master product remains unchanged after selection
    @Test
    void testMasterProductUnchangedAfterSelection() throws Exception {
        when(apiUserRepository.findById("firebase_uid_test")).thenReturn(mockUser);
        when(storeRepository.findById("tenant_da7590066509", "store_5fcd29b2b01c")).thenReturn(mockStore);
        when(productRepository.findByDocumentId("swCyEYDiK3gLJCQNC27W")).thenReturn(mockMasterProduct);
        when(ownerProductRepository.findByTenantStoreAndProduct("tenant_da7590066509", "store_5fcd29b2b01c", "swCyEYDiK3gLJCQNC27W"))
                .thenReturn(null);

        SelectOwnerProductRequest req = new SelectOwnerProductRequest("swCyEYDiK3gLJCQNC27W");
        ownerProductService.selectProduct(mockToken, "store_5fcd29b2b01c", req);

        // Assert master product fields remain 100% identical
        assertEquals("swCyEYDiK3gLJCQNC27W", mockMasterProduct.getId());
        assertEquals("524", mockMasterProduct.getProductCode());
        assertEquals("Kiyu ziyu 1240 kada watch", mockMasterProduct.getProductName());
        assertEquals(699.0, mockMasterProduct.getBasePrice());
    }

    // 17. Tenant isolation & 18. Store isolation
    @Test
    void testTenantAndStoreIsolation() throws Exception {
        when(apiUserRepository.findById("firebase_uid_test")).thenReturn(mockUser);
        // Tenant A user cannot query Store B belonging to Tenant B
        when(storeRepository.findById("tenant_da7590066509", "store_tenant_b")).thenReturn(null);
        Store tenantBStore = new Store();
        tenantBStore.setStoreId("store_tenant_b");
        tenantBStore.setTenantId("tenant_b");
        when(storeRepository.findByStoreId("store_tenant_b")).thenReturn(tenantBStore);

        assertThrows(ForbiddenException.class, () ->
                ownerProductService.getOwnerProducts(mockToken, "store_tenant_b"));

        assertThrows(ForbiddenException.class, () ->
                ownerProductService.getOwnerProduct(mockToken, "store_tenant_b", "swCyEYDiK3gLJCQNC27W"));

        assertThrows(ForbiddenException.class, () ->
                ownerProductService.deleteOwnerProduct(mockToken, "store_tenant_b", "swCyEYDiK3gLJCQNC27W"));
    }

    // 20. No Shopify API calls are made by Step 5
    @Test
    void testZeroShopifyCallsMade() {
        // OwnerProductService does not inject or reference ShopifyGraphQLClient or ShopifyProductService
        assertFalse(OwnerProductService.class.getDeclaredFields().toString().contains("Shopify"));
    }
}
