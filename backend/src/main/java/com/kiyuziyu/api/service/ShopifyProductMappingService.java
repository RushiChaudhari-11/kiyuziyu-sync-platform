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
public class ShopifyProductMappingService {

    private static final Logger log = LoggerFactory.getLogger(ShopifyProductMappingService.class);

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
    private ShopifyProductMappingRepository shopifyProductMappingRepository;

    /**
     * Resolve the authenticated user's tenant ID and validate store authorization.
     */
    private StoreContext resolveAndAuthorizeStore(FirebaseToken token, String storeId)
            throws ExecutionException, InterruptedException {
        String uid = token.getUid();
        ApiUser user = apiUserRepository.findById(uid);
        if (user == null || user.getTenantId() == null || user.getTenantId().trim().isEmpty()) {
            log.warn("[ShopifyProductMappingService] User UID={} has no associated tenant", uid);
            throw new NotFoundException("User does not belong to any tenant");
        }

        String tenantId = user.getTenantId().trim();

        // Check if store exists under user's tenant
        Store store = storeRepository.findById(tenantId, storeId);
        if (store == null) {
            // Check if store exists globally under a different tenant
            Store crossTenantStore = storeRepository.findByStoreId(storeId);
            if (crossTenantStore != null) {
                log.warn("[ShopifyProductMappingService] Cross-tenant access denied: User tenant={}, Store tenant={}",
                        tenantId, crossTenantStore.getTenantId());
                throw new ForbiddenException("Store does not belong to user's tenant");
            }
            throw new NotFoundException("Store not found: " + storeId);
        }

        return new StoreContext(tenantId, storeId, store);
    }

    /**
     * POST /api/v1/tenants/me/stores/{storeId}/shopify-product-mappings
     * Create mapping between a selected master product and a Shopify product.
     */
    public ShopifyProductMappingResponse createMapping(FirebaseToken token, String storeId, CreateShopifyProductMappingRequest request)
            throws ExecutionException, InterruptedException {
        if (request == null || request.getProductId() == null || request.getProductId().trim().isEmpty()) {
            throw new BadRequestException("Field 'productId' is required");
        }
        if (request.getShopifyProductId() == null || request.getShopifyProductId().trim().isEmpty()) {
            throw new BadRequestException("Field 'shopifyProductId' is required");
        }

        StoreContext ctx = resolveAndAuthorizeStore(token, storeId);
        String productId = request.getProductId().trim();
        String shopifyProductId = request.getShopifyProductId().trim();

        // 1. Verify Shopify connection exists for this store
        ShopifyConnection connection = shopifyConnectionRepository.findByStoreId(ctx.tenantId, ctx.storeId);
        if (connection == null) {
            log.warn("[ShopifyProductMappingService] No Shopify connection found for tenantId={}, storeId={}", ctx.tenantId, ctx.storeId);
            throw new NotFoundException("Shopify connection not found for store: " + ctx.storeId);
        }

        // 2. Verify owner product selection exists for this store
        OwnerProduct ownerProduct = ownerProductRepository.findByTenantStoreAndProduct(ctx.tenantId, ctx.storeId, productId);
        if (ownerProduct == null) {
            log.warn("[ShopifyProductMappingService] Owner product selection not found for tenantId={}, storeId={}, productId={}",
                    ctx.tenantId, ctx.storeId, productId);
            throw new NotFoundException("Owner product selection not found for product: " + productId);
        }

        // 3. Verify master product exists in catalog (READ-ONLY)
        Product masterProduct = productRepository.findByDocumentId(productId);
        if (masterProduct == null) {
            log.warn("[ShopifyProductMappingService] Master product not found for productId: {}", productId);
            throw new NotFoundException("Master product not found: " + productId);
        }

        // 4. Duplicate protection:
        // A) Same product cannot be mapped twice to the same store
        ShopifyProductMapping existingByProduct = shopifyProductMappingRepository.findByStoreAndProduct(ctx.tenantId, ctx.storeId, productId);
        if (existingByProduct != null) {
            log.warn("[ShopifyProductMappingService] Product already mapped for store: productId={}, storeId={}", productId, ctx.storeId);
            throw new ConflictException("Product already mapped for this store: " + productId);
        }

        // B) Same Shopify product ID cannot be mapped twice in the same store
        ShopifyProductMapping existingByShopifyId = shopifyProductMappingRepository.findByStoreAndShopifyProductId(ctx.tenantId, ctx.storeId, shopifyProductId);
        if (existingByShopifyId != null) {
            log.warn("[ShopifyProductMappingService] Shopify product ID already mapped in this store: shopifyProductId={}, storeId={}", shopifyProductId, ctx.storeId);
            throw new ConflictException("Shopify product ID already mapped in this store: " + shopifyProductId);
        }

        // 5. Create mapping record
        String mappingId = "map_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        String verifiedProductCode = masterProduct.getProductCode();
        String now = Instant.now().toString();

        ShopifyProductMapping mapping = new ShopifyProductMapping(
                mappingId,
                ctx.tenantId,
                ctx.storeId,
                connection.getConnectionId(),
                productId,
                verifiedProductCode,
                shopifyProductId,
                request.getShopifyProductHandle(),
                ShopifyProductMappingStatus.MAPPED.name(),
                now,
                now
        );

        shopifyProductMappingRepository.save(mapping);
        log.info("[ShopifyProductMappingService] Created mapping: mappingId={}, tenantId={}, storeId={}, productId={}, productCode={}, shopifyProductId={}",
                mappingId, ctx.tenantId, ctx.storeId, productId, verifiedProductCode, shopifyProductId);

        return mapToResponse(mapping);
    }

    /**
     * GET /api/v1/tenants/me/stores/{storeId}/shopify-product-mappings
     * Return all mappings belonging to the store.
     */
    public List<ShopifyProductMappingResponse> getAllMappings(FirebaseToken token, String storeId)
            throws ExecutionException, InterruptedException {
        StoreContext ctx = resolveAndAuthorizeStore(token, storeId);

        List<ShopifyProductMapping> mappings = shopifyProductMappingRepository.findAllByStore(ctx.tenantId, ctx.storeId);
        List<ShopifyProductMappingResponse> responses = new ArrayList<>();
        for (ShopifyProductMapping m : mappings) {
            responses.add(mapToResponse(m));
        }
        return responses;
    }

    /**
     * GET /api/v1/tenants/me/stores/{storeId}/shopify-product-mappings/{productId}
     * Return single mapping by productId for the store.
     */
    public ShopifyProductMappingResponse getSingleMapping(FirebaseToken token, String storeId, String productId)
            throws ExecutionException, InterruptedException {
        StoreContext ctx = resolveAndAuthorizeStore(token, storeId);

        ShopifyProductMapping mapping = shopifyProductMappingRepository.findByStoreAndProduct(ctx.tenantId, ctx.storeId, productId.trim());
        if (mapping == null) {
            throw new NotFoundException("Mapping not found for product: " + productId);
        }

        return mapToResponse(mapping);
    }

    /**
     * PATCH /api/v1/tenants/me/stores/{storeId}/shopify-product-mappings/{productId}
     * Update safe mapping fields.
     */
    public ShopifyProductMappingResponse updateMapping(FirebaseToken token, String storeId, String productId, UpdateShopifyProductMappingRequest request)
            throws ExecutionException, InterruptedException {
        if (request == null) {
            throw new BadRequestException("Request body cannot be empty");
        }

        StoreContext ctx = resolveAndAuthorizeStore(token, storeId);

        ShopifyProductMapping mapping = shopifyProductMappingRepository.findByStoreAndProduct(ctx.tenantId, ctx.storeId, productId.trim());
        if (mapping == null) {
            throw new NotFoundException("Mapping not found for product: " + productId);
        }

        if (request.getStatus() != null && !request.getStatus().trim().isEmpty()) {
            try {
                ShopifyProductMappingStatus statusEnum = ShopifyProductMappingStatus.valueOf(request.getStatus().trim().toUpperCase());
                mapping.setStatus(statusEnum.name());
            } catch (IllegalArgumentException e) {
                throw new BadRequestException("Invalid status: " + request.getStatus() + ". Valid values are: MAPPED, UNMAPPED, ERROR");
            }
        }

        if (request.getShopifyProductId() != null && !request.getShopifyProductId().trim().isEmpty()) {
            String newShopifyProductId = request.getShopifyProductId().trim();
            // Check if changed and already mapped to another product in this store
            if (!newShopifyProductId.equals(mapping.getShopifyProductId())) {
                ShopifyProductMapping existing = shopifyProductMappingRepository.findByStoreAndShopifyProductId(ctx.tenantId, ctx.storeId, newShopifyProductId);
                if (existing != null && !existing.getMappingId().equals(mapping.getMappingId())) {
                    throw new ConflictException("Shopify product ID already mapped in this store: " + newShopifyProductId);
                }
            }
            mapping.setShopifyProductId(newShopifyProductId);
        }

        if (request.getShopifyProductHandle() != null) {
            mapping.setShopifyProductHandle(request.getShopifyProductHandle().trim());
        }

        mapping.setUpdatedAt(Instant.now().toString());
        shopifyProductMappingRepository.save(mapping);

        log.info("[ShopifyProductMappingService] Updated mapping: mappingId={}, status={}",
                mapping.getMappingId(), mapping.getStatus());

        return mapToResponse(mapping);
    }

    /**
     * DELETE /api/v1/tenants/me/stores/{storeId}/shopify-product-mappings/{productId}
     * Delete only the mapping record.
     */
    public void deleteMapping(FirebaseToken token, String storeId, String productId)
            throws ExecutionException, InterruptedException {
        StoreContext ctx = resolveAndAuthorizeStore(token, storeId);

        ShopifyProductMapping mapping = shopifyProductMappingRepository.findByStoreAndProduct(ctx.tenantId, ctx.storeId, productId.trim());
        if (mapping == null) {
            throw new NotFoundException("Mapping not found for product: " + productId);
        }

        // Delete only the mapping record from Firestore
        shopifyProductMappingRepository.delete(mapping.getMappingId());
        log.info("[ShopifyProductMappingService] Deleted mappingId={} for productId={} in storeId={}",
                mapping.getMappingId(), productId, storeId);
    }

    private ShopifyProductMappingResponse mapToResponse(ShopifyProductMapping m) {
        return new ShopifyProductMappingResponse(
                m.getMappingId(),
                m.getTenantId(),
                m.getStoreId(),
                m.getConnectionId(),
                m.getProductId(),
                m.getProductCode(),
                m.getShopifyProductId(),
                m.getShopifyProductHandle(),
                m.getStatus(),
                m.getCreatedAt(),
                m.getUpdatedAt()
        );
    }

    private static class StoreContext {
        final String tenantId;
        final String storeId;
        final Store store;

        StoreContext(String tenantId, String storeId, Store store) {
            this.tenantId = tenantId;
            this.storeId = storeId;
            this.store = store;
        }
    }
}
