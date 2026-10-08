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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.ExecutionException;

@Service
public class ShopifyConnectionService {

    private static final Logger log = LoggerFactory.getLogger(ShopifyConnectionService.class);

    @Autowired
    private ApiUserRepository apiUserRepository;

    @Autowired
    private StoreRepository storeRepository;

    @Autowired
    private ShopifyConnectionRepository shopifyConnectionRepository;

    @Autowired
    private ShopifyTokenService tokenService;

    @Autowired
    private com.kiyuziyu.api.integration.shopify.ShopifyGraphQLClient shopifyGraphQLClient;

    /**
     * Resolve the authenticated user's tenant ID and validate store authorization.
     */
    private StoreContext resolveAndAuthorizeStore(FirebaseToken token, String storeId)
            throws ExecutionException, InterruptedException {
        String uid = token.getUid();
        ApiUser user = apiUserRepository.findById(uid);
        if (user == null || user.getTenantId() == null || user.getTenantId().trim().isEmpty()) {
            log.warn("[ShopifyConnectionService] User UID={} has no associated tenant", uid);
            throw new NotFoundException("User does not belong to any tenant");
        }

        String tenantId = user.getTenantId().trim();

        // Check if store exists under user's tenant
        Store store = storeRepository.findById(tenantId, storeId);
        if (store == null) {
            // Check if store exists globally under a different tenant
            Store crossTenantStore = storeRepository.findByStoreId(storeId);
            if (crossTenantStore != null) {
                log.warn("[ShopifyConnectionService] Cross-tenant access denied: User tenant={}, Store tenant={}",
                        tenantId, crossTenantStore.getTenantId());
                throw new ForbiddenException("Store does not belong to user's tenant");
            }
            throw new NotFoundException("Store not found: " + storeId);
        }

        return new StoreContext(tenantId, storeId, store);
    }

    /**
     * Normalize Shopify store domain (trim, strip protocol, remove trailing slash, lowercase).
    /**
     * Normalize and validate Shopify store domain.
     */
    public String normalizeAndValidateDomain(String rawDomain) {
        if (rawDomain == null || rawDomain.trim().isEmpty()) {
            throw new BadRequestException("Please enter a valid Shopify store domain.");
        }
        String domain = rawDomain.trim().toLowerCase();
        if (domain.startsWith("https://")) {
            domain = domain.substring(8);
        } else if (domain.startsWith("http://")) {
            domain = domain.substring(7);
        }
        int slashIdx = domain.indexOf('/');
        if (slashIdx != -1) {
            domain = domain.substring(0, slashIdx);
        }
        domain = domain.trim();

        if (!domain.endsWith(".myshopify.com")) {
            if (!domain.contains(".")) {
                domain = domain + ".myshopify.com";
            } else {
                throw new BadRequestException("Please enter a valid Shopify store domain.");
            }
        }

        if (!domain.matches("^[a-zA-Z0-9][a-zA-Z0-9\\-]*\\.myshopify\\.com$")) {
            throw new BadRequestException("Please enter a valid Shopify store domain.");
        }

        return domain;
    }

    /**
     * Resolve tenantId from authenticated user.
     */
    public String resolveTenantId(FirebaseToken token) throws ExecutionException, InterruptedException {
        if (token == null || token.getUid() == null) {
            throw new ForbiddenException("Authentication token required");
        }
        String uid = token.getUid();
        ApiUser user = apiUserRepository.findById(uid);
        if (user == null || user.getTenantId() == null || user.getTenantId().trim().isEmpty()) {
            log.warn("[ShopifyConnectionService] User UID={} has no associated tenant", uid);
            throw new NotFoundException("User does not belong to any tenant");
        }
        return user.getTenantId().trim();
    }

    /**
     * Get or create a primary store for the given tenant.
     */
    public Store getOrCreatePrimaryTenantStore(String tenantId) throws ExecutionException, InterruptedException {
        java.util.List<Store> stores = storeRepository.findAllByTenantId(tenantId);
        if (stores != null && !stores.isEmpty()) {
            return stores.get(0);
        }

        String storeId = "store_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        Store store = new Store();
        store.setStoreId(storeId);
        store.setTenantId(tenantId);
        store.setName("Primary Store");
        store.setCode("MAIN");
        store.setPlatform(StorePlatform.GENERIC.name());
        store.setStatus(StoreStatus.ACTIVE.name());
        store.setCreatedAt(com.google.cloud.Timestamp.now());
        store.setUpdatedAt(com.google.cloud.Timestamp.now());

        storeRepository.save(tenantId, store);
        log.info("[ShopifyConnectionService] Created primary storeId={} for tenantId={}", storeId, tenantId);
        return store;
    }

    /**
     * GET /api/v1/tenants/me/shopify-connection
     * Get Shopify connection for current tenant.
     */
    public ShopifyConnectionResponse getTenantConnection(FirebaseToken token) throws ExecutionException, InterruptedException {
        String tenantId = resolveTenantId(token);
        ShopifyConnection connection = shopifyConnectionRepository.findByTenantId(tenantId);
        if (connection == null) {
            Store store = getOrCreatePrimaryTenantStore(tenantId);
            connection = shopifyConnectionRepository.findByStoreId(tenantId, store.getStoreId());
        }
        if (connection == null) {
            return null;
        }
        return mapToResponse(connection);
    }

    /**
     * POST /api/v1/tenants/me/shopify-connection
     * Connect Shopify store for current tenant.
     */
    public ShopifyConnectionResponse createTenantConnection(FirebaseToken token, CreateShopifyConnectionRequest request)
            throws ExecutionException, InterruptedException {
        if (request == null || request.getShopifyStoreDomain() == null || request.getShopifyStoreDomain().trim().isEmpty()) {
            throw new BadRequestException("Please enter a valid Shopify store domain.");
        }

        String tenantId = resolveTenantId(token);
        String normalizedDomain = normalizeAndValidateDomain(request.getShopifyStoreDomain());
        Store store = getOrCreatePrimaryTenantStore(tenantId);

        ShopifyConnection existing = shopifyConnectionRepository.findByTenantId(tenantId);
        if (existing != null && ShopifyConnectionStatus.CONNECTED.name().equalsIgnoreCase(existing.getStatus())) {
            if (normalizedDomain.equalsIgnoreCase(existing.getShopifyStoreDomain())) {
                return mapToResponse(existing);
            }
        }



        String connectionId = existing != null ? existing.getConnectionId() : "sc_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        String now = Instant.now().toString();

        ShopifyConnection connection = new ShopifyConnection(
                connectionId,
                tenantId,
                store.getStoreId(),
                normalizedDomain,
                request.getShopifyStoreId(),
                ShopifyConnectionStatus.CONNECTED.name(),
                existing != null ? existing.getConnectedAt() : now,
                now
        );

        shopifyConnectionRepository.save(connection);

        if (!StorePlatform.SHOPIFY.name().equalsIgnoreCase(store.getPlatform())) {
            store.setPlatform(StorePlatform.SHOPIFY.name());
            store.setUpdatedAt(com.google.cloud.Timestamp.now());
            storeRepository.save(tenantId, store);
        }

        log.info("[ShopifyConnectionService] Connected tenant Shopify store: tenantId={}, domain={}", tenantId, normalizedDomain);
        return mapToResponse(connection);
    }

    /**
     * DELETE /api/v1/tenants/me/shopify-connection
     * Disconnect Shopify store for current tenant.
     */
    public void deleteTenantConnection(FirebaseToken token) throws ExecutionException, InterruptedException {
        String tenantId = resolveTenantId(token);
        ShopifyConnection connection = shopifyConnectionRepository.findByTenantId(tenantId);
        if (connection != null) {
            connection.setStatus(ShopifyConnectionStatus.DISCONNECTED.name());
            connection.setUpdatedAt(Instant.now().toString());
            shopifyConnectionRepository.save(connection);
            log.info("[ShopifyConnectionService] Disconnected tenant connectionId={} for tenantId={}", connection.getConnectionId(), tenantId);
        }
    }

    /**
     * POST /api/v1/tenants/me/stores/{storeId}/shopify-connection
     * Connect a store to a Shopify merchant store.
     */
    public ShopifyConnectionResponse createConnection(FirebaseToken token, String storeId, CreateShopifyConnectionRequest request)
            throws ExecutionException, InterruptedException {
        if (request == null || request.getShopifyStoreDomain() == null || request.getShopifyStoreDomain().trim().isEmpty()) {
            throw new BadRequestException("Please enter a valid Shopify store domain.");
        }

        StoreContext ctx = resolveAndAuthorizeStore(token, storeId);

        ShopifyConnection existing = shopifyConnectionRepository.findByStoreId(ctx.tenantId, ctx.storeId);
        if (existing != null && ShopifyConnectionStatus.CONNECTED.name().equalsIgnoreCase(existing.getStatus())) {
            throw new ConflictException("Shopify connection already exists for this store");
        }

        String normalizedDomain = normalizeAndValidateDomain(request.getShopifyStoreDomain());
        

        String connectionId = existing != null ? existing.getConnectionId() : "sc_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        String now = Instant.now().toString();

        ShopifyConnection connection = new ShopifyConnection(
                connectionId,
                ctx.tenantId,
                ctx.storeId,
                normalizedDomain,
                request.getShopifyStoreId(),
                ShopifyConnectionStatus.CONNECTED.name(),
                now,
                now
        );

        shopifyConnectionRepository.save(connection);

        if (!StorePlatform.SHOPIFY.name().equalsIgnoreCase(ctx.store.getPlatform())) {
            ctx.store.setPlatform(StorePlatform.SHOPIFY.name());
            ctx.store.setUpdatedAt(com.google.cloud.Timestamp.now());
            storeRepository.save(ctx.tenantId, ctx.store);
        }

        log.info("[ShopifyConnectionService] Created connection: connectionId={}, tenantId={}, storeId={}, domain={}",
                connectionId, ctx.tenantId, ctx.storeId, normalizedDomain);

        return mapToResponse(connection);
    }

    /**
     * GET /api/v1/tenants/me/stores/{storeId}/shopify-connection
     * Return current Shopify connection for the store.
     */
    public ShopifyConnectionResponse getConnection(FirebaseToken token, String storeId)
            throws ExecutionException, InterruptedException {
        StoreContext ctx = resolveAndAuthorizeStore(token, storeId);

        ShopifyConnection connection = shopifyConnectionRepository.findByStoreId(ctx.tenantId, ctx.storeId);
        if (connection == null) {
            throw new NotFoundException("Shopify connection not found for store: " + storeId);
        }

        return mapToResponse(connection);
    }

    /**
     * PATCH /api/v1/tenants/me/stores/{storeId}/shopify-connection
     * Update connection metadata / status safely.
     */
    public ShopifyConnectionResponse updateConnection(FirebaseToken token, String storeId, UpdateShopifyConnectionRequest request)
            throws ExecutionException, InterruptedException {
        if (request == null) {
            throw new BadRequestException("Request body cannot be empty");
        }

        StoreContext ctx = resolveAndAuthorizeStore(token, storeId);

        ShopifyConnection connection = shopifyConnectionRepository.findByStoreId(ctx.tenantId, ctx.storeId);
        if (connection == null) {
            throw new NotFoundException("Shopify connection not found for store: " + storeId);
        }

        if (request.getStatus() != null && !request.getStatus().trim().isEmpty()) {
            try {
                ShopifyConnectionStatus statusEnum = ShopifyConnectionStatus.valueOf(request.getStatus().trim().toUpperCase());
                connection.setStatus(statusEnum.name());
            } catch (IllegalArgumentException e) {
                throw new BadRequestException("Invalid status: " + request.getStatus() + ". Valid values are: CONNECTED, DISCONNECTED, ERROR");
            }
        }

        if (request.getShopifyStoreDomain() != null && !request.getShopifyStoreDomain().trim().isEmpty()) {
            connection.setShopifyStoreDomain(normalizeAndValidateDomain(request.getShopifyStoreDomain()));
        }

        if (request.getShopifyStoreId() != null) {
            connection.setShopifyStoreId(request.getShopifyStoreId().trim());
        }

        connection.setUpdatedAt(Instant.now().toString());
        shopifyConnectionRepository.save(connection);

        log.info("[ShopifyConnectionService] Updated connection: connectionId={}, status={}",
                connection.getConnectionId(), connection.getStatus());

        return mapToResponse(connection);
    }

    /**
     * DELETE /api/v1/tenants/me/stores/{storeId}/shopify-connection
     * Disconnect / delete the Shopify connection record.
     */
    public void deleteConnection(FirebaseToken token, String storeId)
            throws ExecutionException, InterruptedException {
        StoreContext ctx = resolveAndAuthorizeStore(token, storeId);

        ShopifyConnection connection = shopifyConnectionRepository.findByStoreId(ctx.tenantId, ctx.storeId);
        if (connection == null) {
            throw new NotFoundException("Shopify connection not found for store: " + storeId);
        }

        connection.setStatus(ShopifyConnectionStatus.DISCONNECTED.name());
        connection.setUpdatedAt(Instant.now().toString());
        shopifyConnectionRepository.save(connection);
        log.info("[ShopifyConnectionService] Disconnected connectionId={} for storeId={}",
                connection.getConnectionId(), storeId);
    }

    private ShopifyConnectionResponse mapToResponse(ShopifyConnection conn) {
        boolean hasSecret = false;
        boolean connected = ShopifyConnectionStatus.CONNECTED.name().equalsIgnoreCase(conn.getStatus());
        return new ShopifyConnectionResponse(
                conn.getConnectionId(),
                conn.getTenantId(),
                conn.getStoreId(),
                conn.getShopifyStoreDomain(),
                conn.getShopifyStoreId(),
                connected,
                conn.getStatus(),
                conn.getConnectedAt(),
                conn.getUpdatedAt()
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
