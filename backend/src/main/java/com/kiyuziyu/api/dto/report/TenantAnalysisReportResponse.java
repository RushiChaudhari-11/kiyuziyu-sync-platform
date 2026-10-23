package com.kiyuziyu.api.dto.report;

import java.util.List;
import java.util.Map;

public class TenantAnalysisReportResponse {
    private String tenantId;
    private SalesReport salesReport;
    private DailyAmountReport dailyAmountReport;
    private AdminPayableReport adminPayableReport;
    private List<AdminTransactionItem> adminTransactions;
    private List<ActivityLogItem> activityLogs;

    public TenantAnalysisReportResponse() {}

    public String getTenantId() { return tenantId; }
    public void setTenantId(String tenantId) { this.tenantId = tenantId; }

    public SalesReport getSalesReport() { return salesReport; }
    public void setSalesReport(SalesReport salesReport) { this.salesReport = salesReport; }

    public DailyAmountReport getDailyAmountReport() { return dailyAmountReport; }
    public void setDailyAmountReport(DailyAmountReport dailyAmountReport) { this.dailyAmountReport = dailyAmountReport; }

    public AdminPayableReport getAdminPayableReport() { return adminPayableReport; }
    public void setAdminPayableReport(AdminPayableReport adminPayableReport) { this.adminPayableReport = adminPayableReport; }

    public List<AdminTransactionItem> getAdminTransactions() { return adminTransactions; }
    public void setAdminTransactions(List<AdminTransactionItem> adminTransactions) { this.adminTransactions = adminTransactions; }

    public List<ActivityLogItem> getActivityLogs() { return activityLogs; }
    public void setActivityLogs(List<ActivityLogItem> activityLogs) { this.activityLogs = activityLogs; }

    // Nested DTOs
    public static class SalesReport {
        private double totalSalesAmount;
        private double totalPaymentsReceived;
        private double pendingPaymentsAmount;
        private double failedOrCancelledAmount;
        private int totalOrdersCount;
        private int successfulPaymentsCount;
        private int pendingPaymentsCount;
        private int failedPaymentsCount;
        private Map<String, Integer> paymentStatusBreakdown;

        public SalesReport() {}

        public double getTotalSalesAmount() { return totalSalesAmount; }
        public void setTotalSalesAmount(double totalSalesAmount) { this.totalSalesAmount = totalSalesAmount; }

        public double getTotalPaymentsReceived() { return totalPaymentsReceived; }
        public void setTotalPaymentsReceived(double totalPaymentsReceived) { this.totalPaymentsReceived = totalPaymentsReceived; }

        public double getPendingPaymentsAmount() { return pendingPaymentsAmount; }
        public void setPendingPaymentsAmount(double pendingPaymentsAmount) { this.pendingPaymentsAmount = pendingPaymentsAmount; }

        public double getFailedOrCancelledAmount() { return failedOrCancelledAmount; }
        public void setFailedOrCancelledAmount(double failedOrCancelledAmount) { this.failedOrCancelledAmount = failedOrCancelledAmount; }

        public int getTotalOrdersCount() { return totalOrdersCount; }
        public void setTotalOrdersCount(int totalOrdersCount) { this.totalOrdersCount = totalOrdersCount; }

        public int getSuccessfulPaymentsCount() { return successfulPaymentsCount; }
        public void setSuccessfulPaymentsCount(int successfulPaymentsCount) { this.successfulPaymentsCount = successfulPaymentsCount; }

        public int getPendingPaymentsCount() { return pendingPaymentsCount; }
        public void setPendingPaymentsCount(int pendingPaymentsCount) { this.pendingPaymentsCount = pendingPaymentsCount; }

        public int getFailedPaymentsCount() { return failedPaymentsCount; }
        public void setFailedPaymentsCount(int failedPaymentsCount) { this.failedPaymentsCount = failedPaymentsCount; }

        public Map<String, Integer> getPaymentStatusBreakdown() { return paymentStatusBreakdown; }
        public void setPaymentStatusBreakdown(Map<String, Integer> paymentStatusBreakdown) { this.paymentStatusBreakdown = paymentStatusBreakdown; }
    }

    public static class DailyAmountReport {
        private double todayOrderAmount;
        private double todayAmountCollected;
        private double todayPendingAmount;
        private int todayOrderCount;
        private double yesterdayOrderAmount;
        private int yesterdayOrderCount;
        private double amountChangePercentage;

        public DailyAmountReport() {}

        public double getTodayOrderAmount() { return todayOrderAmount; }
        public void setTodayOrderAmount(double todayOrderAmount) { this.todayOrderAmount = todayOrderAmount; }

        public double getTodayAmountCollected() { return todayAmountCollected; }
        public void setTodayAmountCollected(double todayAmountCollected) { this.todayAmountCollected = todayAmountCollected; }

        public double getTodayPendingAmount() { return todayPendingAmount; }
        public void setTodayPendingAmount(double todayPendingAmount) { this.todayPendingAmount = todayPendingAmount; }

        public int getTodayOrderCount() { return todayOrderCount; }
        public void setTodayOrderCount(int todayOrderCount) { this.todayOrderCount = todayOrderCount; }

        public double getYesterdayOrderAmount() { return yesterdayOrderAmount; }
        public void setYesterdayOrderAmount(double yesterdayOrderAmount) { this.yesterdayOrderAmount = yesterdayOrderAmount; }

        public int getYesterdayOrderCount() { return yesterdayOrderCount; }
        public void setYesterdayOrderCount(int yesterdayOrderCount) { this.yesterdayOrderCount = yesterdayOrderCount; }

        public double getAmountChangePercentage() { return amountChangePercentage; }
        public void setAmountChangePercentage(double amountChangePercentage) { this.amountChangePercentage = amountChangePercentage; }
    }

    public static class AdminPayableReport {
        private double totalAmountPayable;
        private double amountAlreadyPaid;
        private double remainingPayableAmount;
        private int completedTransactionsCount;
        private int pendingTransactionsCount;
        private int failedTransactionsCount;

        public AdminPayableReport() {}

        public double getTotalAmountPayable() { return totalAmountPayable; }
        public void setTotalAmountPayable(double totalAmountPayable) { this.totalAmountPayable = totalAmountPayable; }

        public double getAmountAlreadyPaid() { return amountAlreadyPaid; }
        public void setAmountAlreadyPaid(double amountAlreadyPaid) { this.amountAlreadyPaid = amountAlreadyPaid; }

        public double getRemainingPayableAmount() { return remainingPayableAmount; }
        public void setRemainingPayableAmount(double remainingPayableAmount) { this.remainingPayableAmount = remainingPayableAmount; }

        public int getCompletedTransactionsCount() { return completedTransactionsCount; }
        public void setCompletedTransactionsCount(int completedTransactionsCount) { this.completedTransactionsCount = completedTransactionsCount; }

        public int getPendingTransactionsCount() { return pendingTransactionsCount; }
        public void setPendingTransactionsCount(int pendingTransactionsCount) { this.pendingTransactionsCount = pendingTransactionsCount; }

        public int getFailedTransactionsCount() { return failedTransactionsCount; }
        public void setFailedTransactionsCount(int failedTransactionsCount) { this.failedTransactionsCount = failedTransactionsCount; }
    }

    public static class AdminTransactionItem {
        private String transactionId;
        private String date;
        private double amount;
        private String type; // e.g. "Platform Settlement", "Base Cost Payment"
        private String status; // "COMPLETED", "PENDING", "FAILED"
        private String referenceId;

        public AdminTransactionItem() {}

        public AdminTransactionItem(String transactionId, String date, double amount, String type, String status, String referenceId) {
            this.transactionId = transactionId;
            this.date = date;
            this.amount = amount;
            this.type = type;
            this.status = status;
            this.referenceId = referenceId;
        }

        public String getTransactionId() { return transactionId; }
        public void setTransactionId(String transactionId) { this.transactionId = transactionId; }

        public String getDate() { return date; }
        public void setDate(String date) { this.date = date; }

        public double getAmount() { return amount; }
        public void setAmount(double amount) { this.amount = amount; }

        public String getType() { return type; }
        public void setType(String type) { this.type = type; }

        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }

        public String getReferenceId() { return referenceId; }
        public void setReferenceId(String referenceId) { this.referenceId = referenceId; }
    }

    public static class ActivityLogItem {
        private String id;
        private String timestamp;
        private String user;
        private String action;
        private String entityId;
        private String result; // "SUCCESS", "FAILED", "QUEUED", "INFO"

        public ActivityLogItem() {}

        public ActivityLogItem(String id, String timestamp, String user, String action, String entityId, String result) {
            this.id = id;
            this.timestamp = timestamp;
            this.user = user;
            this.action = action;
            this.entityId = entityId;
            this.result = result;
        }

        public String getId() { return id; }
        public void setId(String id) { this.id = id; }

        public String getTimestamp() { return timestamp; }
        public void setTimestamp(String timestamp) { this.timestamp = timestamp; }

        public String getUser() { return user; }
        public void setUser(String user) { this.user = user; }

        public String getAction() { return action; }
        public void setAction(String action) { this.action = action; }

        public String getEntityId() { return entityId; }
        public void setEntityId(String entityId) { this.entityId = entityId; }

        public String getResult() { return result; }
        public void setResult(String result) { this.result = result; }
    }
}
