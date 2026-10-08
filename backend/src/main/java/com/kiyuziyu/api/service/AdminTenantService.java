package com.kiyuziyu.api.service;

import com.google.cloud.Timestamp;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseToken;
import com.google.firebase.auth.UserRecord;
import com.kiyuziyu.api.dto.admin.AdminCreateTenantRequest;
import com.kiyuziyu.api.dto.admin.AdminCreateTenantResponseData;
import com.kiyuziyu.api.dto.admin.AdminTenantListItem;
import com.kiyuziyu.api.exception.BadRequestException;
import com.kiyuziyu.api.exception.ConflictException;
import com.kiyuziyu.api.exception.ForbiddenException;
import com.kiyuziyu.api.exception.UnauthorizedException;
import com.kiyuziyu.api.model.ApiClient;
import com.kiyuziyu.api.model.ApiCredential;
import com.kiyuziyu.api.model.AdminUser;
import com.kiyuziyu.api.model.ApiUser;
import com.kiyuziyu.api.model.Tenant;
import com.kiyuziyu.api.model.TenantStatus;
import com.kiyuziyu.api.model.UserRole;
import com.kiyuziyu.api.model.UserStatus;
import com.kiyuziyu.api.repository.ApiClientRepository;
import com.kiyuziyu.api.repository.ApiCredentialRepository;
import com.kiyuziyu.api.repository.AdminUserRepository;
import com.kiyuziyu.api.repository.ApiUserRepository;
import com.kiyuziyu.api.repository.TenantRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutionException;

@Service
public class AdminTenantService {

    private static final Logger log = LoggerFactory.getLogger(AdminTenantService.class);

    @Autowired
    private AdminUserRepository adminUserRepository;

    @Autowired
    private TenantRepository tenantRepository;

    @Autowired
    private ApiUserRepository apiUserRepository;

    @Autowired
    private ApiClientService apiClientService;

    @Autowired
    private ApiCredentialRepository apiCredentialRepository;

    /**
     * Verify that the authenticated Firebase user has an active SUPER_ADMIN profile.
     */
    public void verifySuperAdmin(FirebaseToken token) throws ExecutionException, InterruptedException {
        String uid = token.getUid();
        AdminUser adminUser = adminUserRepository.findByUid(uid);
        if (adminUser == null || !"ACTIVE".equalsIgnoreCase(adminUser.getStatus()) || !"SUPER_ADMIN".equalsIgnoreCase(adminUser.getRole())) {
            log.warn("[AdminTenantService] Access denied for UID={}. Requires active SUPER_ADMIN role.", uid);
            throw new ForbiddenException("Super Admin privileges required");
        }
    }

    /**
     * Create a new Tenant and associated resources (Firebase Auth user, apiUser, apiTenant, ApiClient).
     */
    public AdminCreateTenantResponseData createTenant(FirebaseToken token, AdminCreateTenantRequest request)
            throws ExecutionException, InterruptedException {
        verifySuperAdmin(token);

        if (request == null) {
            throw new BadRequestException("Request body is required");
        }
        if (request.getName() == null || request.getName().trim().isEmpty()) {
            throw new BadRequestException("Tenant name is required");
        }
        if (request.getEmail() == null || request.getEmail().trim().isEmpty()) {
            throw new BadRequestException("Email address is required");
        }
        if (request.getPassword() == null || request.getPassword().length() < 6) {
            throw new BadRequestException("Password must be at least 6 characters");
        }

        String roleStr = request.getRole() != null ? request.getRole().trim().toUpperCase() : UserRole.OWNER.name();
        if (UserRole.SUPER_ADMIN.name().equals(roleStr) || (!UserRole.OWNER.name().equals(roleStr) && !UserRole.STORE_MANAGER.name().equals(roleStr) && !UserRole.STAFF.name().equals(roleStr))) {
            throw new BadRequestException("Invalid role. Allowed roles: OWNER, STORE_MANAGER, STAFF");
        }

        String email = request.getEmail().trim();
        String name = request.getName().trim();

        // 1. Generate tenantId and unique tenant code
        String tenantId = "tenant_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        String baseCode = name.toUpperCase().replaceAll("[^A-Z0-9]", "");
        if (baseCode.length() < 3) baseCode = "TN" + baseCode;
        if (baseCode.length() > 12) baseCode = baseCode.substring(0, 12);

        String tenantCode = baseCode;
        int counter = 1;
        while (tenantRepository.existsByCode(tenantCode)) {
            tenantCode = baseCode + "_" + counter++;
        }

        String firebaseUid = null;
        try {
            // 2. Create Firebase Authentication User via Admin SDK
            UserRecord.CreateRequest createReq = new UserRecord.CreateRequest()
                    .setEmail(email)
                    .setPassword(request.getPassword())
                    .setDisplayName(name);
            UserRecord userRecord = FirebaseAuth.getInstance().createUser(createReq);
            firebaseUid = userRecord.getUid();
            log.info("[AdminTenantService] Created Firebase Auth User: UID={}, Email={}", firebaseUid, email);

            // 3. Create Tenant Document
            Tenant tenant = new Tenant();
            tenant.setTenantId(tenantId);
            tenant.setName(name);
            tenant.setCode(tenantCode);
            tenant.setStatus(TenantStatus.ACTIVE.name());
            tenant.setOwnerUserId(firebaseUid);
            tenant.setCreatedAt(Timestamp.now());
            tenant.setUpdatedAt(Timestamp.now());
            tenantRepository.save(tenant);
            log.info("[AdminTenantService] Created apiTenants record: id={}, code={}, ownerUserId={}", tenantId, tenantCode, firebaseUid);

            // 4. Create ApiUser Document
            ApiUser apiUser = new ApiUser();
            apiUser.setUid(firebaseUid);
            apiUser.setEmail(email);
            apiUser.setName(name);
            apiUser.setRole(roleStr);
            apiUser.setStatus(UserStatus.ACTIVE.name());
            apiUser.setTenantId(tenantId);
            apiUser.setCreatedAt(Timestamp.now());
            apiUser.setUpdatedAt(Timestamp.now());
            apiUserRepository.save(apiUser);
            log.info("[AdminTenantService] Created apiUsers record: UID={}, tenantId={}", firebaseUid, tenantId);

            // 5. Create API Client / Credential if requested
            String createdClientId = null;
            String generatedApiKey = null;
            if (Boolean.TRUE.equals(request.getCreateApiClient())) {
                ApiClient client = apiClientService.createClient(name, null);
                createdClientId = client.getClientId();

                if (request.getApiKey() != null && !request.getApiKey().trim().isEmpty()) {
                    String rawKey = request.getApiKey().trim();
                    ApiCredential credential = new ApiCredential();
                    credential.setCredentialId(UUID.randomUUID().toString());
                    credential.setClientId(createdClientId);
                    credential.setApiKeyHash(apiClientService.hashKey(rawKey));
                    credential.setStatus("ACTIVE");
                    credential.setCreatedAt(Timestamp.now());
                    apiCredentialRepository.save(credential);
                } else {
                    generatedApiKey = apiClientService.generateApiKey(createdClientId);
                }
            }

            AdminCreateTenantResponseData responseData = new AdminCreateTenantResponseData();
            responseData.setTenantId(tenantId);
            responseData.setName(name);
            responseData.setCode(tenantCode);
            responseData.setEmail(email);
            responseData.setRole(roleStr);
            responseData.setStatus("ACTIVE");
            responseData.setApiClientId(createdClientId);
            responseData.setApiKey(generatedApiKey);

            return responseData;

        } catch (Exception e) {
            log.error("[AdminTenantService] Tenant creation failed. Rolling back created resources...", e);
            if (firebaseUid != null) {
                try {
                    FirebaseAuth.getInstance().deleteUser(firebaseUid);
                    log.info("[AdminTenantService] Rollback successful: Deleted Firebase Auth User UID={}", firebaseUid);
                } catch (Exception ex) {
                    log.error("[AdminTenantService] Rollback failed to delete Firebase Auth User UID={}: {}", firebaseUid, ex.getMessage());
                }
            }
            if (e instanceof BadRequestException || e instanceof ConflictException || e instanceof ForbiddenException || e instanceof UnauthorizedException) {
                throw (RuntimeException) e;
            }
            if (e instanceof FirebaseAuthException) {
                FirebaseAuthException fae = (FirebaseAuthException) e;
                if ("EMAIL_ALREADY_EXISTS".equals(fae.getAuthErrorCode().name()) || fae.getMessage().contains("already exists")) {
                    throw new ConflictException("Email is already registered in Firebase Authentication: " + email);
                }
                throw new BadRequestException("Firebase Auth error: " + fae.getMessage());
            }
            throw new RuntimeException("Failed to create tenant: " + e.getMessage(), e);
        }
    }

    /**
     * List all tenants for Super Admin.
     */
    public List<AdminTenantListItem> listTenants(FirebaseToken token) throws ExecutionException, InterruptedException {
        verifySuperAdmin(token);
        List<Tenant> tenants = tenantRepository.findAll();
        List<AdminTenantListItem> items = new ArrayList<>();
        for (Tenant t : tenants) {
            items.add(AdminTenantListItem.from(t));
        }
        return items;
    }
}
