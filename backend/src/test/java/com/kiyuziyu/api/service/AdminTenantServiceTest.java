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

import java.time.Instant;
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
    void testCreateTenantRejectsInvalidDateRange() throws ExecutionException, InterruptedException {
        FirebaseToken mockToken = Mockito.mock(FirebaseToken.class);
        when(mockToken.getUid()).thenReturn("superadmin_uid_1");

        AdminUser superAdmin = new AdminUser();
        superAdmin.setUid("superadmin_uid_1");
        superAdmin.setRole("SUPER_ADMIN");
        superAdmin.setStatus("ACTIVE");
        when(adminUserRepository.findByUid("superadmin_uid_1")).thenReturn(superAdmin);

        AdminCreateTenantRequest request = new AdminCreateTenantRequest();
        request.setBusinessName("Test Jewelry");
        request.setFullName("John Doe");
        request.setEmail("tenant@example.com");
        request.setPassword("Password123!");
        request.setSubscriptionType("MONTHLY");
        // End date is BEFORE start date:
        request.setSubscriptionStartDate("2026-10-22T10:00:00Z");
        request.setSubscriptionEndDate("2026-10-21T10:00:00Z");

        BadRequestException ex = assertThrows(BadRequestException.class, () -> adminTenantService.createTenant(mockToken, request));
        assertTrue(ex.getMessage().contains("Subscription end date must be strictly after start date"));
    }

    @Test
    void testCreateTenantRejectsNegativeAmount() throws ExecutionException, InterruptedException {
        FirebaseToken mockToken = Mockito.mock(FirebaseToken.class);
        when(mockToken.getUid()).thenReturn("superadmin_uid_1");

        AdminUser superAdmin = new AdminUser();
        superAdmin.setUid("superadmin_uid_1");
        superAdmin.setRole("SUPER_ADMIN");
        superAdmin.setStatus("ACTIVE");
        when(adminUserRepository.findByUid("superadmin_uid_1")).thenReturn(superAdmin);

        AdminCreateTenantRequest request = new AdminCreateTenantRequest();
        request.setBusinessName("Test Jewelry");
        request.setFullName("John Doe");
        request.setEmail("tenant@example.com");
        request.setPassword("Password123!");
        request.setSubscriptionAmount(-50.0);

        BadRequestException ex = assertThrows(BadRequestException.class, () -> adminTenantService.createTenant(mockToken, request));
        assertTrue(ex.getMessage().contains("Subscription amount cannot be negative"));
    }

    @Test
    void testCreateTenantRejectsInvalidSubscriptionType() throws ExecutionException, InterruptedException {
        FirebaseToken mockToken = Mockito.mock(FirebaseToken.class);
        when(mockToken.getUid()).thenReturn("superadmin_uid_1");

        AdminUser superAdmin = new AdminUser();
        superAdmin.setUid("superadmin_uid_1");
        superAdmin.setRole("SUPER_ADMIN");
        superAdmin.setStatus("ACTIVE");
        when(adminUserRepository.findByUid("superadmin_uid_1")).thenReturn(superAdmin);

        AdminCreateTenantRequest request = new AdminCreateTenantRequest();
        request.setBusinessName("Test Jewelry");
        request.setFullName("John Doe");
        request.setEmail("tenant@example.com");
        request.setPassword("Password123!");
        request.setSubscriptionType("LIFETIME_INVALID");

        BadRequestException ex = assertThrows(BadRequestException.class, () -> adminTenantService.createTenant(mockToken, request));
        assertTrue(ex.getMessage().contains("Invalid subscription type"));
    }

    @Test
    void testParseDateStringToInstantSupport() {
        assertNotNull(AdminTenantService.parseDateStringToInstant("2026-10-22T10:00:00Z", "Test"));
        assertNotNull(AdminTenantService.parseDateStringToInstant("2026-10-22T10:00", "Test"));
        assertNotNull(AdminTenantService.parseDateStringToInstant("2026-10-22", "Test"));
        assertNull(AdminTenantService.parseDateStringToInstant(null, "Test"));
        assertNull(AdminTenantService.parseDateStringToInstant("", "Test"));
        assertThrows(BadRequestException.class, () -> AdminTenantService.parseDateStringToInstant("not-a-date", "TestDate"));
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
        t1.setBusinessName("Tenant One Business");
        t1.setFullName("John Owner");
        t1.setCode("TENANT1");
        t1.setStatus("ACTIVE");
        t1.setSubscriptionType("MONTHLY");
        t1.setSubscriptionAmount(999.0);

        when(tenantRepository.findAll()).thenReturn(List.of(t1));

        List<AdminTenantListItem> list = adminTenantService.listTenants(mockToken);
        assertEquals(1, list.size());
        assertEquals("tenant_100", list.get(0).getTenantId());
        assertEquals("Tenant One", list.get(0).getName());
        assertEquals("Tenant One Business", list.get(0).getBusinessName());
        assertEquals("John Owner", list.get(0).getFullName());
        assertEquals("MONTHLY", list.get(0).getSubscriptionType());
        assertEquals(999.0, list.get(0).getSubscriptionAmount());
    }
}
