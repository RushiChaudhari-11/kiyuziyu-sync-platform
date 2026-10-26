package com.kiyuziyu.api.service;

import com.google.firebase.auth.FirebaseToken;
import com.kiyuziyu.api.dto.report.TenantAnalysisReportResponse;
import com.kiyuziyu.api.dto.report.TenantAnalysisReportResponse.*;
import com.kiyuziyu.api.exception.ForbiddenException;
import com.kiyuziyu.api.exception.NotFoundException;
import com.kiyuziyu.api.model.ApiUser;
import com.kiyuziyu.api.model.TenantOrder;
import com.kiyuziyu.api.repository.AdminPaymentRepository;
import com.kiyuziyu.api.repository.ApiUserRepository;
import com.kiyuziyu.api.repository.TenantOrderRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class TenantAnalysisService {

    private static final Logger log = LoggerFactory.getLogger(TenantAnalysisService.class);

    @Autowired
    private TenantOrderRepository tenantOrderRepository;

    @Autowired
    private AdminPaymentRepository adminPaymentRepository;

    @Autowired
    private ApiUserRepository apiUserRepository;

    public TenantAnalysisReportResponse getAnalysisReport(FirebaseToken token) {
        if (token == null || token.getUid() == null) {
            throw new ForbiddenException("Authentication token required");
        }

        String uid = token.getUid();
        String tenantId;
        try {
            ApiUser user = apiUserRepository.findById(uid);
            if (user == null || user.getTenantId() == null || user.getTenantId().trim().isEmpty()) {
                log.warn("[TenantAnalysisService] User UID={} has no associated tenant", uid);
                throw new NotFoundException("User does not belong to any tenant");
            }
            tenantId = user.getTenantId().trim();
        } catch (NotFoundException e) {
            throw e;
        } catch (Exception e) {
            log.error("[TenantAnalysisService] Error finding user {}: {}", uid, e.getMessage());
            throw new RuntimeException("Failed to resolve tenant identity", e);
        }

        return generateReportForTenant(tenantId, uid);
    }

    public TenantAnalysisReportResponse generateReportForTenant(String tenantId, String userUid) {
        TenantAnalysisReportResponse response = new TenantAnalysisReportResponse();
        response.setTenantId(tenantId);

        // Fetch authoritative orders for this tenant
        List<TenantOrder> orders = tenantOrderRepository.findByTenantId(tenantId);

        // Fetch admin payments
        List<AdminTransactionItem> transactions = adminPaymentRepository.findPaymentsForTenant(tenantId, userUid);

        // 1. Sales Report
        SalesReport salesReport = buildSalesReport(orders);
        response.setSalesReport(salesReport);

        // 2. Daily Amount Report
        DailyAmountReport dailyReport = buildDailyAmountReport(orders);
        response.setDailyAmountReport(dailyReport);

        // 3. Admin Payable Report
        AdminPayableReport payableReport = buildAdminPayableReport(orders, transactions);
        response.setAdminPayableReport(payableReport);

        // 4. Admin Transactions List
        response.setAdminTransactions(transactions);

        // 5. Activity Logs
        List<ActivityLogItem> logs = buildActivityLogs(orders, transactions, tenantId);
        response.setActivityLogs(logs);

        return response;
    }

    private SalesReport buildSalesReport(List<TenantOrder> orders) {
        SalesReport report = new SalesReport();
        Map<String, Integer> breakdown = new LinkedHashMap<>();
        breakdown.put("Payment Done", 0);
        breakdown.put("Pending Payment", 0);
        breakdown.put("Ready to Dispatch", 0);
        breakdown.put("Dispatched", 0);
        breakdown.put("Delivered", 0);
        breakdown.put("Cancelled", 0);

        double totalSales = 0.0;
        double paymentsReceived = 0.0;
        double pendingPayments = 0.0;
        double failedOrCancelled = 0.0;
        int successfulCount = 0;
        int pendingCount = 0;
        int failedCount = 0;

        for (TenantOrder order : orders) {
            double sellingPrice = order.getTotalSellingPrice() != null ? order.getTotalSellingPrice() : 0.0;
            String status = normalizeStatus(order.getStatus());

            breakdown.put(status, breakdown.getOrDefault(status, 0) + 1);

            if ("Cancelled".equalsIgnoreCase(status)) {
                failedOrCancelled += sellingPrice;
                failedCount++;
            } else {
                totalSales += sellingPrice;

                if (isPaymentSuccessful(status)) {
                    paymentsReceived += sellingPrice;
                    successfulCount++;
                } else {
                    pendingPayments += sellingPrice;
                    pendingCount++;
                }
            }
        }

        report.setTotalSalesAmount(round(totalSales));
        report.setTotalPaymentsReceived(round(paymentsReceived));
        report.setPendingPaymentsAmount(round(pendingPayments));
        report.setFailedOrCancelledAmount(round(failedOrCancelled));
        report.setTotalOrdersCount(orders.size());
        report.setSuccessfulPaymentsCount(successfulCount);
        report.setPendingPaymentsCount(pendingCount);
        report.setFailedPaymentsCount(failedCount);
        report.setPaymentStatusBreakdown(breakdown);

        return report;
    }

    private DailyAmountReport buildDailyAmountReport(List<TenantOrder> orders) {
        DailyAmountReport report = new DailyAmountReport();
        LocalDate today = LocalDate.now(ZoneId.of("UTC"));
        LocalDate yesterday = today.minusDays(1);

        double todayAmount = 0.0;
        double todayCollected = 0.0;
        double todayPending = 0.0;
        int todayCount = 0;

        double yesterdayAmount = 0.0;
        int yesterdayCount = 0;

        for (TenantOrder order : orders) {
            LocalDate orderDate = parseOrderDate(order.getCreatedAt());
            if (orderDate == null) continue;

            double sellingPrice = order.getTotalSellingPrice() != null ? order.getTotalSellingPrice() : 0.0;
            String status = normalizeStatus(order.getStatus());

            if (orderDate.equals(today)) {
                if (!"Cancelled".equalsIgnoreCase(status)) {
                    todayAmount += sellingPrice;
                    todayCount++;
                    if (isPaymentSuccessful(status)) {
                        todayCollected += sellingPrice;
                    } else {
                        todayPending += sellingPrice;
                    }
                }
            } else if (orderDate.equals(yesterday)) {
                if (!"Cancelled".equalsIgnoreCase(status)) {
                    yesterdayAmount += sellingPrice;
                    yesterdayCount++;
                }
            }
        }

        report.setTodayOrderAmount(round(todayAmount));
        report.setTodayAmountCollected(round(todayCollected));
        report.setTodayPendingAmount(round(todayPending));
        report.setTodayOrderCount(todayCount);
        report.setYesterdayOrderAmount(round(yesterdayAmount));
        report.setYesterdayOrderCount(yesterdayCount);

        if (yesterdayAmount > 0) {
            double pctChange = ((todayAmount - yesterdayAmount) / yesterdayAmount) * 100.0;
            report.setAmountChangePercentage(round(pctChange));
        } else {
            report.setAmountChangePercentage(todayAmount > 0 ? 100.0 : 0.0);
        }

        return report;
    }

    private AdminPayableReport buildAdminPayableReport(List<TenantOrder> orders, List<AdminTransactionItem> transactions) {
        AdminPayableReport report = new AdminPayableReport();

        // Platform base wholesale cost of valid orders
        double totalPayable = 0.0;
        for (TenantOrder order : orders) {
            String status = normalizeStatus(order.getStatus());
            if (!"Cancelled".equalsIgnoreCase(status)) {
                double basePrice = order.getTotalBasePrice() != null ? order.getTotalBasePrice() : 0.0;
                totalPayable += basePrice;
            }
        }

        double alreadyPaid = 0.0;
        int completedCount = 0;
        int pendingCount = 0;
        int failedCount = 0;

        for (AdminTransactionItem tx : transactions) {
            String st = tx.getStatus() != null ? tx.getStatus().toUpperCase() : "COMPLETED";
            if ("COMPLETED".equals(st) || "SUCCESS".equals(st)) {
                alreadyPaid += tx.getAmount();
                completedCount++;
            } else if ("PENDING".equals(st)) {
                pendingCount++;
            } else {
                failedCount++;
            }
        }

        double remaining = Math.max(0.0, totalPayable - alreadyPaid);

        report.setTotalAmountPayable(round(totalPayable));
        report.setAmountAlreadyPaid(round(alreadyPaid));
        report.setRemainingPayableAmount(round(remaining));
        report.setCompletedTransactionsCount(completedCount);
        report.setPendingTransactionsCount(pendingCount);
        report.setFailedTransactionsCount(failedCount);

        return report;
    }

    private List<ActivityLogItem> buildActivityLogs(List<TenantOrder> orders, List<AdminTransactionItem> transactions, String tenantId) {
        List<ActivityLogItem> logs = new ArrayList<>();

        // 1. Order Activity logs
        for (TenantOrder order : orders) {
            String ts = order.getUpdatedAt() != null ? order.getUpdatedAt() : order.getCreatedAt();
            if (ts == null || ts.isEmpty()) {
                ts = Instant.now().toString();
            }
            String orderNum = order.getOrderNumber() != null ? order.getOrderNumber() : (order.getOrderId() != null ? order.getOrderId().substring(0, Math.min(8, order.getOrderId().length())) : "N/A");
            String status = normalizeStatus(order.getStatus());
            String result = "Cancelled".equalsIgnoreCase(status) ? "FAILED" : ("Pending Payment".equalsIgnoreCase(status) ? "PENDING" : "SUCCESS");

            logs.add(new ActivityLogItem(
                    "log_ord_" + (order.getOrderId() != null ? order.getOrderId() : UUID.randomUUID().toString().substring(0, 8)),
                    ts,
                    "Customer / Store",
                    "Order #" + orderNum + " status: " + status,
                    order.getOrderId() != null ? order.getOrderId() : orderNum,
                    result
            ));
        }

        // 2. Payment Transaction logs
        for (AdminTransactionItem tx : transactions) {
            String ts = tx.getDate() != null && !tx.getDate().isEmpty() ? tx.getDate() : Instant.now().toString();
            logs.add(new ActivityLogItem(
                    "log_tx_" + tx.getTransactionId(),
                    ts,
                    "Tenant Finance",
                    tx.getType() + " of ₹" + tx.getAmount(),
                    tx.getReferenceId() != null ? tx.getReferenceId() : tx.getTransactionId(),
                    tx.getStatus() != null ? tx.getStatus().toUpperCase() : "SUCCESS"
            ));
        }

        // Sort chronological descending
        logs.sort((a, b) -> {
            String ta = a.getTimestamp() != null ? a.getTimestamp() : "";
            String tb = b.getTimestamp() != null ? b.getTimestamp() : "";
            return tb.compareTo(ta);
        });

        // Limit to top 50 logs to prevent heavy payloads
        if (logs.size() > 50) {
            return new ArrayList<>(logs.subList(0, 50));
        }
        return logs;
    }

    private boolean isPaymentSuccessful(String status) {
        return "Payment Done".equalsIgnoreCase(status)
                || "Delivered".equalsIgnoreCase(status)
                || "Dispatched".equalsIgnoreCase(status)
                || "Ready to Dispatch".equalsIgnoreCase(status);
    }

    private String normalizeStatus(String rawStatus) {
        if (rawStatus == null || rawStatus.trim().isEmpty()) {
            return "Pending Payment";
        }
        String s = rawStatus.trim();
        String upper = s.toUpperCase().replace('_', ' ').replace('-', ' ');

        if (upper.contains("PAYMENT DONE") || upper.contains("PAID") || upper.contains("COMPLETED")) return "Payment Done";
        if (upper.contains("PENDING") || upper.contains("NEW") || upper.contains("UNPAID")) return "Pending Payment";
        if (upper.contains("READY") || upper.contains("PACKED") || upper.contains("PROCESSING")) return "Ready to Dispatch";
        if (upper.contains("DISPATCH") || upper.contains("SHIPPED") || upper.contains("IN TRANSIT")) return "Dispatched";
        if (upper.contains("DELIVER")) return "Delivered";
        if (upper.contains("CANCEL") || upper.contains("VOID")) return "Cancelled";

        return s;
    }

    private LocalDate parseOrderDate(String dateStr) {
        if (dateStr == null || dateStr.trim().isEmpty()) {
            return null;
        }
        try {
            Instant instant = Instant.parse(dateStr);
            return instant.atZone(ZoneId.of("UTC")).toLocalDate();
        } catch (Exception e) {
            try {
                return LocalDate.parse(dateStr.substring(0, 10), DateTimeFormatter.ISO_LOCAL_DATE);
            } catch (Exception ignored) {
                return null;
            }
        }
    }

    private double round(double val) {
        return Math.round(val * 100.0) / 100.0;
    }
}
