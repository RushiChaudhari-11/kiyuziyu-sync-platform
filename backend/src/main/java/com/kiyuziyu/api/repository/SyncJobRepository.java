package com.kiyuziyu.api.repository;

import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.QueryDocumentSnapshot;
import com.google.cloud.firestore.QuerySnapshot;
import com.kiyuziyu.api.model.SyncJob;
import com.kiyuziyu.api.model.SyncJobStatus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutionException;

@Repository
public class SyncJobRepository {

    private static final Logger log = LoggerFactory.getLogger(SyncJobRepository.class);

    public static final String COLLECTION_NAME = "apiSyncJobs";

    @Autowired
    private Firestore firestore;

    public void save(SyncJob job) throws ExecutionException, InterruptedException {
        if (firestore == null || job == null || job.getJobId() == null) {
            return;
        }
        firestore.collection(COLLECTION_NAME)
                .document(job.getJobId().trim())
                .set(job)
                .get();
        log.info("[SyncJobRepo] Saved jobId={}, tenantId={}, storeId={}, status={}, processed={}/{}",
                job.getJobId(), job.getTenantId(), job.getStoreId(), job.getStatus(), job.getProcessedItems(), job.getTotalItems());
    }

    public SyncJob findById(String jobId) throws ExecutionException, InterruptedException {
        if (firestore == null || jobId == null || jobId.trim().isEmpty()) {
            return null;
        }
        DocumentSnapshot snap = firestore.collection(COLLECTION_NAME)
                .document(jobId.trim())
                .get()
                .get();
        if (snap.exists()) {
            return snap.toObject(SyncJob.class);
        }
        return null;
    }

    public SyncJob claimJobForProcessing(String jobId) throws ExecutionException, InterruptedException {
        if (firestore == null || jobId == null || jobId.trim().isEmpty()) {
            return null;
        }
        com.google.cloud.firestore.DocumentReference docRef = firestore.collection(COLLECTION_NAME).document(jobId.trim());
        return firestore.runTransaction(transaction -> {
            DocumentSnapshot snap = transaction.get(docRef).get();
            if (!snap.exists()) {
                return null;
            }
            SyncJob job = snap.toObject(SyncJob.class);
            if (job == null || !SyncJobStatus.QUEUED.name().equals(job.getStatus())) {
                return null; // Already claimed or not queued
            }
            job.setStatus(SyncJobStatus.RUNNING.name());
            job.setStartedAt(java.time.Instant.now().toString());
            job.setUpdatedAt(java.time.Instant.now().toString());
            transaction.set(docRef, job);
            return job;
        }).get();
    }

    public List<SyncJob> findAllByStore(String tenantId, String storeId) throws ExecutionException, InterruptedException {
        List<SyncJob> list = new ArrayList<>();
        if (firestore == null || tenantId == null || storeId == null) {
            return list;
        }
        QuerySnapshot snap = firestore.collection(COLLECTION_NAME)
                .whereEqualTo("tenantId", tenantId.trim())
                .whereEqualTo("storeId", storeId.trim())
                .get()
                .get();
        for (QueryDocumentSnapshot doc : snap.getDocuments()) {
            list.add(doc.toObject(SyncJob.class));
        }
        // Sort descending by createdAt
        list.sort((a, b) -> {
            String ca = a.getCreatedAt() != null ? a.getCreatedAt() : "";
            String cb = b.getCreatedAt() != null ? b.getCreatedAt() : "";
            return cb.compareTo(ca);
        });
        return list;
    }

    public List<SyncJob> findActiveJobsForStore(String tenantId, String storeId) throws ExecutionException, InterruptedException {
        List<SyncJob> storeJobs = findAllByStore(tenantId, storeId);
        List<SyncJob> activeJobs = new ArrayList<>();
        for (SyncJob job : storeJobs) {
            if (SyncJobStatus.QUEUED.name().equals(job.getStatus()) ||
                SyncJobStatus.RUNNING.name().equals(job.getStatus())) {
                activeJobs.add(job);
            }
        }
        return activeJobs;
    }
}
