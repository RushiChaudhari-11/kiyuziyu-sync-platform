package com.kiyuziyu.api.repository;

import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.QueryDocumentSnapshot;
import com.google.cloud.firestore.QuerySnapshot;
import com.kiyuziyu.api.dto.report.TenantAnalysisReportResponse.AdminTransactionItem;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.List;

@Repository
public class AdminPaymentRepository {

    private static final Logger log = LoggerFactory.getLogger(AdminPaymentRepository.class);
    public static final String COLLECTION_NAME = "adminPayments";

    @Autowired(required = false)
    private Firestore firestore;

    public List<AdminTransactionItem> findPaymentsForTenant(String tenantId, String userUid) {
        List<AdminTransactionItem> transactions = new ArrayList<>();
        if (firestore == null) {
            return transactions;
        }

        try {
            // First check by sellerId matching tenantId
            if (tenantId != null && !tenantId.trim().isEmpty()) {
                QuerySnapshot snap = firestore.collection(COLLECTION_NAME)
                        .whereEqualTo("sellerId", tenantId.trim())
                        .get()
                        .get();
                for (QueryDocumentSnapshot doc : snap.getDocuments()) {
                    transactions.add(mapDocToTransaction(doc));
                }
            }

            // Also check by userUid if distinct and not already captured
            if (userUid != null && !userUid.trim().isEmpty() && !userUid.equals(tenantId)) {
                QuerySnapshot snapUid = firestore.collection(COLLECTION_NAME)
                        .whereEqualTo("sellerId", userUid.trim())
                        .get()
                        .get();
                for (QueryDocumentSnapshot doc : snapUid.getDocuments()) {
                    if (transactions.stream().noneMatch(t -> t.getTransactionId().equals(doc.getId()))) {
                        transactions.add(mapDocToTransaction(doc));
                    }
                }
            }
        } catch (Exception e) {
            log.warn("[AdminPaymentRepo] Failed to fetch payments for tenantId={}, uid={}: {}", tenantId, userUid, e.getMessage());
        }

        return transactions;
    }

    private AdminTransactionItem mapDocToTransaction(QueryDocumentSnapshot doc) {
        String id = doc.getId();
        Double amount = doc.getDouble("amount");
        if (amount == null) {
            Long l = doc.getLong("amount");
            amount = l != null ? l.doubleValue() : 0.0;
        }

        String type = doc.getString("type");
        if (type == null || type.trim().isEmpty()) {
            type = "Platform Base Settlement";
        }

        String status = doc.getString("status");
        if (status == null || status.trim().isEmpty()) {
            status = "COMPLETED";
        }

        String referenceId = doc.getString("referenceId");
        if (referenceId == null) {
            referenceId = doc.getString("transactionId");
            if (referenceId == null) {
                referenceId = "REF-" + id.substring(0, Math.min(8, id.length()));
            }
        }

        String dateStr = "";
        com.google.cloud.Timestamp ts = doc.getTimestamp("createdAt");
        if (ts != null) {
            dateStr = ts.toDate().toInstant().toString();
        } else {
            String s = doc.getString("createdAt");
            dateStr = s != null ? s : "";
        }

        return new AdminTransactionItem(id, dateStr, amount, type, status, referenceId);
    }
}
