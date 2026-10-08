package com.kiyuziyu.api.service;

import com.google.cloud.Timestamp;
import com.google.firebase.auth.FirebaseToken;
import com.kiyuziyu.api.dto.tenant.CreateTenantRequest;
import com.kiyuziyu.api.dto.tenant.TenantResponse;
import com.kiyuziyu.api.exception.BadRequestException;
import com.kiyuziyu.api.exception.ConflictException;
import com.kiyuziyu.api.exception.NotFoundException;
import com.kiyuziyu.api.model.ApiUser;
import com.kiyuziyu.api.model.Tenant;
import com.kiyuziyu.api.model.TenantStatus;
import com.kiyuziyu.api.model.UserRole;
import com.kiyuziyu.api.model.UserStatus;
import com.kiyuziyu.api.repository.ApiUserRepository;
import com.kiyuziyu.api.repository.TenantRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.UUID;
import java.util.concurrent.ExecutionException;

@Service
public class TenantService {

    private static final Logger log = LoggerFactory.getLogger(TenantService.class);

    @Autowired
    private TenantRepository tenantRepository;

    @Autowired
    private ApiUserRepository apiUserRepository;

    public TenantResponse createTenant(FirebaseToken token, CreateTenantRequest request)
            throws ExecutionException, InterruptedException {
        if (request == null) {
            throw new BadRequestException("Request body is required");
        }

        if (request.getName() == null || request.getName().trim().isEmpty()) {
            throw new BadRequestException("Tenant name is required");
        }

        if (request.getCode() == null || request.getCode().trim().isEmpty()) {
            throw new BadRequestException("Tenant code is required");
        }

        String code = request.getCode().trim().toUpperCase();
        String uid = token.getUid();

        // 1. Tenant code must be unique
        if (tenantRepository.existsByCode(code)) {
            throw new ConflictException("Tenant code already exists: " + code);
        }

        // 2. Check user association
        ApiUser user = apiUserRepository.findById(uid);
        if (user != null && user.getTenantId() != null && !user.getTenantId().trim().isEmpty()) {
            throw new ConflictException("User already belongs to tenant: " + user.getTenantId());
        }

        // 3. Server-side generated tenantId
        String tenantId = "tenant_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);

        Tenant tenant = new Tenant();
        tenant.setTenantId(tenantId);
        tenant.setName(request.getName().trim());
        tenant.setCode(code);
        tenant.setStatus(TenantStatus.ACTIVE.name());
        tenant.setOwnerUserId(uid); // Source of truth from verified Firebase token
        tenant.setCreatedAt(Timestamp.now());
        tenant.setUpdatedAt(Timestamp.now());

        tenantRepository.save(tenant);
        log.info("[TenantService] Created tenant: id={}, code={}, ownerUserId={}", tenantId, code, uid);

        // 4. Update user's apiUsers record with tenantId
        if (user == null) {
            user = new ApiUser();
            user.setUid(uid);
            user.setEmail(token.getEmail());
            user.setEmailVerified(token.isEmailVerified());
            user.setName(token.getName());
            user.setRole(UserRole.OWNER.name());
            user.setStatus(UserStatus.ACTIVE.name());
            user.setCreatedAt(Timestamp.now());
        }
        user.setTenantId(tenantId);
        user.setUpdatedAt(Timestamp.now());
        apiUserRepository.save(user);
        log.info("[TenantService] Associated user UID={} with tenantId={}", uid, tenantId);

        return TenantResponse.from(tenant);
    }

    public TenantResponse getCurrentUserTenant(FirebaseToken token)
            throws ExecutionException, InterruptedException {
        String uid = token.getUid();
        ApiUser user = apiUserRepository.findById(uid);
        if (user == null || user.getTenantId() == null || user.getTenantId().trim().isEmpty()) {
            log.warn("[TenantService] User UID={} does not belong to any tenant", uid);
            throw new NotFoundException("No tenant found for authenticated user");
        }

        String tenantId = user.getTenantId().trim();
        Tenant tenant = tenantRepository.findById(tenantId);
        if (tenant == null) {
            log.warn("[TenantService] Tenant ID={} not found for user UID={}", tenantId, uid);
            throw new NotFoundException("Tenant not found with ID: " + tenantId);
        }

        return TenantResponse.from(tenant);
    }

    public String resolveTenantIdForUser(FirebaseToken token)
            throws ExecutionException, InterruptedException {
        String uid = token.getUid();
        ApiUser user = apiUserRepository.findById(uid);
        if (user == null || user.getTenantId() == null || user.getTenantId().trim().isEmpty()) {
            throw new NotFoundException("Authenticated user does not belong to a tenant. Create a tenant first.");
        }
        return user.getTenantId().trim();
    }
}
