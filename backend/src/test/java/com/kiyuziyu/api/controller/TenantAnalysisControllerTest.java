package com.kiyuziyu.api.controller;

import com.google.firebase.auth.FirebaseToken;
import com.kiyuziyu.api.dto.report.TenantAnalysisReportResponse;
import com.kiyuziyu.api.dto.report.TenantAnalysisReportResponse.SalesReport;
import com.kiyuziyu.api.security.FirebaseAuthenticationService;
import com.kiyuziyu.api.service.TenantAnalysisService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(TenantAnalysisController.class)
@AutoConfigureMockMvc(addFilters = false)
class TenantAnalysisControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private FirebaseAuthenticationService firebaseAuthService;

    @MockBean
    private TenantAnalysisService tenantAnalysisService;

    @MockBean
    private com.kiyuziyu.api.security.ApiKeyInterceptor apiKeyInterceptor;

    @MockBean
    private com.kiyuziyu.api.security.AdminSecurityInterceptor adminSecurityInterceptor;

    @Test
    void testGetTenantAnalysisReports_Success() throws Exception {
        FirebaseToken mockToken = org.mockito.Mockito.mock(FirebaseToken.class);
        when(firebaseAuthService.verifyToken("Bearer mock-token")).thenReturn(mockToken);

        TenantAnalysisReportResponse mockResponse = new TenantAnalysisReportResponse();
        mockResponse.setTenantId("tenant_abc");
        SalesReport salesReport = new SalesReport();
        salesReport.setTotalSalesAmount(5000.0);
        salesReport.setTotalOrdersCount(10);
        mockResponse.setSalesReport(salesReport);

        when(tenantAnalysisService.getAnalysisReport(mockToken)).thenReturn(mockResponse);

        mockMvc.perform(get("/api/v1/tenants/me/reports/analysis")
                        .header("Authorization", "Bearer mock-token")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.tenantId").value("tenant_abc"))
                .andExpect(jsonPath("$.data.salesReport.totalSalesAmount").value(5000.0))
                .andExpect(jsonPath("$.data.salesReport.totalOrdersCount").value(10));
    }
}
