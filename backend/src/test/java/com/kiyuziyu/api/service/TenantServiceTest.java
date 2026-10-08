package com.kiyuziyu.api.service;

import com.google.firebase.auth.FirebaseToken;
import com.kiyuziyu.api.dto.tenant.CreateTenantRequest;
import com.kiyuziyu.api.dto.tenant.TenantResponse;
import com.kiyuziyu.api.exception.ConflictException;
import com.kiyuziyu.api.exception.NotFoundException;
import com.kiyuziyu.api.model.ApiUser;
import com.kiyuziyu.api.model.Tenant;
import com.kiyuziyu.api.model.TenantStatus;
import com.kiyuziyu.api.repository.ApiUserRepository;
import com.kiyuziyu.api.repository.TenantRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.concurrent.ExecutionException;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TenantServiceTest {

    @Mock
    private TenantRepository tenantRepository;

    @Mock
    private ApiUserRepository apiUserRepository;

    @InjectMocks
    private TenantService tenantService;

    @Test
    void testCreateTenantSuccessAndEnforceRules() throws ExecutionException, InterruptedException {
        FirebaseToken mockToken = Mockito.mock(FirebaseToken.class);
        when(mockToken.getUid()).thenReturn("firebase_uid_owner1");

        when(tenantRepository.existsByCode("KIYUZIYU")).thenReturn(false);

        ApiUser existingUser = new ApiUser();
        existingUser.setUid("firebase_uid_owner1");
        existingUser.setEmail("owner@kiyuziyu.com");
        when(apiUserRepository.findById("firebase_uid_owner1")).thenReturn(existingUser);

        CreateTenantRequest request = new CreateTenantRequest("Kiyuziyu", "kiyuziyu");

        TenantResponse response = tenantService.createTenant(mockToken, request);

        // Verify tenant saved
        ArgumentCaptor<Tenant> tenantCaptor = ArgumentCaptor.forClass(Tenant.class);
        verify(tenantRepository, times(1)).save(tenantCaptor.capture());
        Tenant savedTenant = tenantCaptor.getValue();

        // 1. tenantId generated server-side
        assertNotNull(savedTenant.getTenantId());
        assertTrue(savedTenant.getTenantId().startsWith("tenant_"));

        // 2. ownerUserId strictly from Firebase UID
        assertEquals("firebase_uid_owner1", savedTenant.getOwnerUserId());

        // 3. Uppercase code
        assertEquals("KIYUZIYU", savedTenant.getCode());
        assertEquals("Kiyuziyu", savedTenant.getName());

        // 4. Default status ACTIVE
        assertEquals(TenantStatus.ACTIVE.name(), savedTenant.getStatus());
        assertNotNull(savedTenant.getCreatedAt());
        assertNotNull(savedTenant.getUpdatedAt());

        // 5. User's apiUsers record associated with tenantId
        ArgumentCaptor<ApiUser> userCaptor = ArgumentCaptor.forClass(ApiUser.class);
        verify(apiUserRepository, times(1)).save(userCaptor.capture());
        assertEquals(savedTenant.getTenantId(), userCaptor.getValue().getTenantId());

        // 6. Response matches
        assertNotNull(response);
        assertEquals(savedTenant.getTenantId(), response.getTenantId());
        assertEquals("KIYUZIYU", response.getCode());
        assertEquals("firebase_uid_owner1", response.getOwnerUserId());
    }

    @Test
    void testCreateTenantDuplicateCodeThrowsConflict() throws ExecutionException, InterruptedException {
        FirebaseToken mockToken = Mockito.mock(FirebaseToken.class);
        when(mockToken.getUid()).thenReturn("firebase_uid_owner2");

        when(tenantRepository.existsByCode("EXISTING")).thenReturn(true);

        CreateTenantRequest request = new CreateTenantRequest("Existing Co", "existing");

        assertThrows(ConflictException.class, () -> tenantService.createTenant(mockToken, request));
        verify(tenantRepository, never()).save(any());
    }

    @Test
    void testGetCurrentUserTenantNotFoundThrows404() throws ExecutionException, InterruptedException {
        FirebaseToken mockToken = Mockito.mock(FirebaseToken.class);
        when(mockToken.getUid()).thenReturn("uid_no_tenant");

        when(apiUserRepository.findById("uid_no_tenant")).thenReturn(null);

        assertThrows(NotFoundException.class, () -> tenantService.getCurrentUserTenant(mockToken));
    }

    @Test
    void testGetCurrentUserTenantSuccess() throws ExecutionException, InterruptedException {
        FirebaseToken mockToken = Mockito.mock(FirebaseToken.class);
        when(mockToken.getUid()).thenReturn("uid_with_tenant");

        ApiUser user = new ApiUser();
        user.setUid("uid_with_tenant");
        user.setTenantId("tenant_999");
        when(apiUserRepository.findById("uid_with_tenant")).thenReturn(user);

        Tenant tenant = new Tenant();
        tenant.setTenantId("tenant_999");
        tenant.setName("Kiyuziyu");
        tenant.setCode("KIYUZIYU");
        tenant.setOwnerUserId("uid_with_tenant");
        tenant.setStatus(TenantStatus.ACTIVE.name());
        when(tenantRepository.findById("tenant_999")).thenReturn(tenant);

        TenantResponse response = tenantService.getCurrentUserTenant(mockToken);

        assertNotNull(response);
        assertEquals("tenant_999", response.getTenantId());
        assertEquals("KIYUZIYU", response.getCode());
        assertEquals("uid_with_tenant", response.getOwnerUserId());
    }
}
