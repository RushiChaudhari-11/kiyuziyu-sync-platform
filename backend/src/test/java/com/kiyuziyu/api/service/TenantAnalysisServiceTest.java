package com.kiyuziyu.api.service;

import com.google.firebase.auth.FirebaseToken;
import com.kiyuziyu.api.dto.report.TenantAnalysisReportResponse;
import com.kiyuziyu.api.dto.report.TenantAnalysisReportResponse.AdminTransactionItem;
import com.kiyuziyu.api.exception.NotFoundException;
import com.kiyuziyu.api.model.ApiUser;
import com.kiyuziyu.api.model.TenantOrder;
import com.kiyuziyu.api.repository.AdminPaymentRepository;
import com.kiyuziyu.api.repository.ApiUserRepository;
import com.kiyuziyu.api.repository.TenantOrderRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TenantAnalysisServiceTest {

    @Mock
    private TenantOrderRepository tenantOrderRepository;

    @Mock
    private AdminPaymentRepository adminPaymentRepository;

    @Mock
    private ApiUserRepository apiUserRepository;

    @InjectMocks
    private TenantAnalysisService tenantAnalysisService;

    @Test
    void testGetAnalysisReportSuccess() throws Exception {
        FirebaseToken mockToken = Mockito.mock(FirebaseToken.class);
        when(mockToken.getUid()).thenReturn("user_123");

        ApiUser mockUser = new ApiUser();
        mockUser.setUid("user_123");
        mockUser.setTenantId("tenant_abc");
        when(apiUserRepository.findById("user_123")).thenReturn(mockUser);

        List<TenantOrder> orders = new ArrayList<>();

        TenantOrder o1 = new TenantOrder();
        o1.setOrderId("ord_1");
        o1.setOrderNumber("1001");
        o1.setTenantId("tenant_abc");
        o1.setTotalSellingPrice(1000.0);
        o1.setTotalBasePrice(700.0);
        o1.setStatus("Payment Done");
        o1.setCreatedAt(Instant.now().toString());
        orders.add(o1);

        TenantOrder o2 = new TenantOrder();
        o2.setOrderId("ord_2");
        o2.setOrderNumber("1002");
        o2.setTenantId("tenant_abc");
        o2.setTotalSellingPrice(500.0);
        o2.setTotalBasePrice(350.0);
        o2.setStatus("Pending Payment");
        o2.setCreatedAt(Instant.now().toString());
        orders.add(o2);

        TenantOrder o3 = new TenantOrder();
        o3.setOrderId("ord_3");
        o3.setOrderNumber("1003");
        o3.setTenantId("tenant_abc");
        o3.setTotalSellingPrice(200.0);
        o3.setTotalBasePrice(140.0);
        o3.setStatus("Cancelled");
        o3.setCreatedAt(Instant.now().toString());
        orders.add(o3);

        when(tenantOrderRepository.findByTenantId("tenant_abc")).thenReturn(orders);

        List<AdminTransactionItem> transactions = new ArrayList<>();
        transactions.add(new AdminTransactionItem("tx_1", Instant.now().toString(), 500.0, "Platform Settlement", "COMPLETED", "REF-001"));
        when(adminPaymentRepository.findPaymentsForTenant("tenant_abc", "user_123")).thenReturn(transactions);

        TenantAnalysisReportResponse response = tenantAnalysisService.getAnalysisReport(mockToken);

        assertNotNull(response);
        assertEquals("tenant_abc", response.getTenantId());

        // Sales Report checks
        // Total valid sales = o1 (1000) + o2 (500) = 1500 (o3 cancelled excluded from sales)
        assertEquals(1500.0, response.getSalesReport().getTotalSalesAmount());
        assertEquals(1000.0, response.getSalesReport().getTotalPaymentsReceived());
        assertEquals(500.0, response.getSalesReport().getPendingPaymentsAmount());
        assertEquals(200.0, response.getSalesReport().getFailedOrCancelledAmount());
        assertEquals(3, response.getSalesReport().getTotalOrdersCount());
        assertEquals(1, response.getSalesReport().getSuccessfulPaymentsCount());
        assertEquals(1, response.getSalesReport().getPendingPaymentsCount());
        assertEquals(1, response.getSalesReport().getFailedPaymentsCount());

        // Daily Report checks
        assertEquals(1500.0, response.getDailyAmountReport().getTodayOrderAmount());
        assertEquals(2, response.getDailyAmountReport().getTodayOrderCount());

        // Admin Payable checks
        // Total payable base cost for valid orders = 700 + 350 = 1050
        assertEquals(1050.0, response.getAdminPayableReport().getTotalAmountPayable());
        assertEquals(500.0, response.getAdminPayableReport().getAmountAlreadyPaid());
        assertEquals(550.0, response.getAdminPayableReport().getRemainingPayableAmount());

        // Transactions & Logs
        assertEquals(1, response.getAdminTransactions().size());
        assertFalse(response.getActivityLogs().isEmpty());
    }

    @Test
    void testGetAnalysisReportUserNotFoundThrows() throws Exception {
        FirebaseToken mockToken = Mockito.mock(FirebaseToken.class);
        when(mockToken.getUid()).thenReturn("nonexistent");
        when(apiUserRepository.findById("nonexistent")).thenReturn(null);

        assertThrows(NotFoundException.class, () -> tenantAnalysisService.getAnalysisReport(mockToken));
    }
}
