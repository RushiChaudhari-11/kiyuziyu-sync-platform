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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutionException;

@Service
public class OwnerProductService {

    private static final Logger log = LoggerFactory.getLogger(OwnerProductService.class);

    @Autowired
    private ApiUserRepository apiUserRepository;

    @Autowired
    private StoreRepository storeRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private OwnerProductRepository ownerProductRepository;

    /**
     * Resolve the authenticated user's tenant ID and validate store authorization.
     */
    private StoreContext resolveAndAuthorizeStore(FirebaseToken token, String storeId)
            throws ExecutionException, InterruptedException {
        String uid = token.getUid();
        ApiUser user = apiUserRepository.findById(uid);
        if (user == null || user.getTenantId() == null || user.getTenantId().trim().isEmpty()) {
            log.warn("[OwnerProductService] User UID={} has no associated tenant", uid);
            throw new NotFoundException("User does not belong to any tenant");
        }

        String tenantId = user.getTenantId().trim();

        // Check if the store exists under the user's tenant
        Store store = storeRepository.findById(tenantId, storeId);
        if (store == null) {
            // Check if store exists globally under a different tenant
            Store crossTenantStore = storeRepository.findByStoreId(storeId);
            if (crossTenantStore != null) {
                log.warn("[OwnerProductService] Cross-tenant access denied: User tenant={}, Store tenant={}",
                        tenantId, crossTenantStore.getTenantId());
                throw new ForbiddenException("Store does not belong to user's tenant");
            }
            throw new NotFoundException("Store not found: " + storeId);
        }

        return new StoreContext(tenantId, storeId);
    }

    /**
     * 1. SELECT PRODUCT
     * Select a master product for the authenticated user's store.
     */
    public OwnerProductResponse selectProduct(FirebaseToken token, String storeId, SelectOwnerProductRequest request)
            throws ExecutionException, InterruptedException {
        if (request == null || request.getProductId() == null || request.getProductId().trim().isEmpty()) {
            throw new BadRequestException("Field 'productId' is required");
        }

        StoreContext ctx = resolveAndAuthorizeStore(token, storeId);
        String productId = request.getProductId().trim();

        // 1. Verify master product exists in existing catalog (Read-Only)
        Product masterProduct = productRepository.findByDocumentId(productId);
        if (masterProduct == null) {
            log.warn("[OwnerProductService] Master product not found for productId: {}", productId);
            throw new NotFoundException("Master product not found: " + productId);
        }

        // 2. Read existing productCode from master data (do not trust client)
        String verifiedProductCode = masterProduct.getProductCode();

        // 3. Duplicate selection check: tenantId + storeId + productId
        OwnerProduct existing = ownerProductRepository.findByTenantStoreAndProduct(ctx.tenantId, ctx.storeId, productId);
        if (existing != null) {
            log.warn("[OwnerProductService] Product already selected for tenantId={}, storeId={}, productId={}",
                    ctx.tenantId, ctx.storeId, productId);
            throw new ConflictException("Product already selected for this store: " + productId);
        }

        // 4. Create owner selection record (Reference ONLY, do not duplicate master catalog)
        String selectionId = "sel_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        String now = Instant.now().toString();

        OwnerProduct ownerProduct = new OwnerProduct(
                selectionId,
                ctx.tenantId,
                ctx.storeId,
                productId,
                verifiedProductCode,
                true,
                now,
                now
        );

        ownerProductRepository.save(ownerProduct);
        log.info("[OwnerProductService] Selected product: selectionId={}, tenantId={}, storeId={}, productId={}, productCode={}",
                selectionId, ctx.tenantId, ctx.storeId, productId, verifiedProductCode);

        return mapToResponse(ownerProduct, masterProduct);
    }

    /**
     * 2. GET SELECTED PRODUCTS
     * Return all selected products for the authenticated user's store.
     */
    public List<OwnerProductResponse> getOwnerProducts(FirebaseToken token, String storeId)
            throws ExecutionException, InterruptedException {
        StoreContext ctx = resolveAndAuthorizeStore(token, storeId);

        List<OwnerProduct> selections = ownerProductRepository.findByStoreId(ctx.tenantId, ctx.storeId);
        List<OwnerProductResponse> responses = new ArrayList<>();

        for (OwnerProduct op : selections) {
            Product master = productRepository.findByDocumentId(op.getProductId());
            responses.add(mapToResponse(op, master));
        }

        return responses;
    }

    /**
     * 3. GET ONE SELECTED PRODUCT
     */
    public OwnerProductResponse getOwnerProduct(FirebaseToken token, String storeId, String productId)
            throws ExecutionException, InterruptedException {
        StoreContext ctx = resolveAndAuthorizeStore(token, storeId);

        OwnerProduct selection = ownerProductRepository.findByTenantStoreAndProduct(ctx.tenantId, ctx.storeId, productId);
        if (selection == null) {
            throw new NotFoundException("Product not found in owner selection: " + productId);
        }

        Product master = productRepository.findByDocumentId(productId);
        return mapToResponse(selection, master);
    }

    /**
     * 4. ENABLE / DISABLE PRODUCT
     */
    public OwnerProductResponse updateOwnerProduct(FirebaseToken token, String storeId, String productId, UpdateOwnerProductRequest request)
            throws ExecutionException, InterruptedException {
        if (request == null || request.getEnabled() == null) {
            throw new BadRequestException("Field 'enabled' is required");
        }

        StoreContext ctx = resolveAndAuthorizeStore(token, storeId);

        OwnerProduct selection = ownerProductRepository.findByTenantStoreAndProduct(ctx.tenantId, ctx.storeId, productId);
        if (selection == null) {
            throw new NotFoundException("Product not found in owner selection: " + productId);
        }

        selection.setEnabled(request.getEnabled());
        selection.setUpdatedAt(Instant.now().toString());

        // Save only the selection record — master product is NEVER modified
        ownerProductRepository.save(selection);
        log.info("[OwnerProductService] Updated selectionId={}, enabled={}", selection.getSelectionId(), selection.isEnabled());

        Product master = productRepository.findByDocumentId(productId);
        return mapToResponse(selection, master);
    }

    /**
     * 5. REMOVE PRODUCT FROM OWNER SELECTION
     */
    public void deleteOwnerProduct(FirebaseToken token, String storeId, String productId)
            throws ExecutionException, InterruptedException {
        StoreContext ctx = resolveAndAuthorizeStore(token, storeId);

        OwnerProduct selection = ownerProductRepository.findByTenantStoreAndProduct(ctx.tenantId, ctx.storeId, productId);
        if (selection == null) {
            throw new NotFoundException("Product not found in owner selection: " + productId);
        }

        // Delete only the owner selection relationship — master product is NEVER modified
        ownerProductRepository.delete(selection.getSelectionId());
        log.info("[OwnerProductService] Removed product selectionId={}, productId={} for storeId={}",
                selection.getSelectionId(), productId, storeId);
    }

    private OwnerProductResponse mapToResponse(OwnerProduct op, Product master) {
        String productName = master != null ? master.getProductName() : null;
        String image = master != null ? master.getImage() : null;
        return new OwnerProductResponse(
                op.getSelectionId(),
                op.getTenantId(),
                op.getStoreId(),
                op.getProductId(),
                op.getProductCode(),
                productName,
                image,
                op.isEnabled(),
                op.getCreatedAt(),
                op.getUpdatedAt()
        );
    }

    private static class StoreContext {
        final String tenantId;
        final String storeId;

        StoreContext(String tenantId, String storeId) {
            this.tenantId = tenantId;
            this.storeId = storeId;
        }
    }
}
