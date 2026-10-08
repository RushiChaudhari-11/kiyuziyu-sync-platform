package com.kiyuziyu.api.service;

import com.google.firebase.auth.FirebaseToken;
import com.kiyuziyu.api.dto.admin.AdminCreateTenantRequest;
import com.kiyuziyu.api.dto.admin.AdminTenantListItem;
import com.kiyuziyu.api.exception.BadRequestException;
import com.kiyuziyu.api.exception.ForbiddenException;
import com.kiyuziyu.api.model.AdminUser;
import com.kiyuziyu.api.model.Tenant;
import com.kiyuziyu.api.repository.AdminUserRepository;
import com.kiyuziyu.api.repository.ApiClientRepository;
import com.kiyuziyu.api.repository.ApiCredentialRepository;
import com.kiyuziyu.api.repository.ApiUserRepository;
import com.kiyuziyu.api.repository.TenantRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Collections;
import java.util.List;
import java.util.concurrent.ExecutionException;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AdminTenantServiceTest {

    @Mock
    private AdminUserRepository adminUserRepository;

    @Mock
    private TenantRepository tenantRepository;

    @Mock
    private ApiUserRepository apiUserRepository;

    @Mock
    private ApiClientService apiClientService;

    @Mock
    private ApiCredentialRepository apiCredentialRepository;

    @InjectMocks
    private AdminTenantService adminTenantService;

    @Test
    void testNonSuperAdminThrowsForbidden() throws ExecutionException, InterruptedException {
        FirebaseToken mockToken = Mockito.mock(FirebaseToken.class);
        when(mockToken.getUid()).thenReturn("admin_uid_1");

        AdminUser normalAdmin = new AdminUser();
        normalAdmin.setUid("admin_uid_1");
        normalAdmin.setRole("ADMIN"); // Not SUPER_ADMIN
        normalAdmin.setStatus("ACTIVE");
        when(adminUserRepository.findByUid("admin_uid_1")).thenReturn(normalAdmin);

        assertThrows(ForbiddenException.class, () -> adminTenantService.verifySuperAdmin(mockToken));
    }

    @Test
    void testSuperAdminAccessPasses() throws ExecutionException, InterruptedException {
        FirebaseToken mockToken = Mockito.mock(FirebaseToken.class);
        when(mockToken.getUid()).thenReturn("superadmin_uid_1");

        AdminUser superAdmin = new AdminUser();
        superAdmin.setUid("superadmin_uid_1");
        superAdmin.setRole("SUPER_ADMIN");
        superAdmin.setStatus("ACTIVE");
        when(adminUserRepository.findByUid("superadmin_uid_1")).thenReturn(superAdmin);

        assertDoesNotThrow(() -> adminTenantService.verifySuperAdmin(mockToken));
    }

    @Test
    void testCreateTenantRejectsSuperAdminRoleInRequestBody() throws ExecutionException, InterruptedException {
        FirebaseToken mockToken = Mockito.mock(FirebaseToken.class);
        when(mockToken.getUid()).thenReturn("superadmin_uid_1");

        AdminUser superAdmin = new AdminUser();
        superAdmin.setUid("superadmin_uid_1");
        superAdmin.setRole("SUPER_ADMIN");
        superAdmin.setStatus("ACTIVE");
        when(adminUserRepository.findByUid("superadmin_uid_1")).thenReturn(superAdmin);

        AdminCreateTenantRequest request = new AdminCreateTenantRequest();
        request.setName("Test Tenant");
        request.setEmail("tenant@example.com");
        request.setPassword("Password123!");
        request.setRole("SUPER_ADMIN"); // Forbidden role in tenant form

        assertThrows(BadRequestException.class, () -> adminTenantService.createTenant(mockToken, request));
    }

    @Test
    void testListTenantsForSuperAdmin() throws ExecutionException, InterruptedException {
        FirebaseToken mockToken = Mockito.mock(FirebaseToken.class);
        when(mockToken.getUid()).thenReturn("superadmin_uid_1");

        AdminUser superAdmin = new AdminUser();
        superAdmin.setUid("superadmin_uid_1");
        superAdmin.setRole("SUPER_ADMIN");
        superAdmin.setStatus("ACTIVE");
        when(adminUserRepository.findByUid("superadmin_uid_1")).thenReturn(superAdmin);

        Tenant t1 = new Tenant();
        t1.setTenantId("tenant_100");
        t1.setName("Tenant One");
        t1.setCode("TENANT1");
        t1.setStatus("ACTIVE");

        when(tenantRepository.findAll()).thenReturn(List.of(t1));

        List<AdminTenantListItem> list = adminTenantService.listTenants(mockToken);
        assertEquals(1, list.size());
        assertEquals("tenant_100", list.get(0).getTenantId());
        assertEquals("Tenant One", list.get(0).getName());
    }
}
