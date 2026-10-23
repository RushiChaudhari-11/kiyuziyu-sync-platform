package com.kiyuziyu.api.repository;

import com.google.api.core.ApiFuture;
import com.google.cloud.firestore.*;
import com.kiyuziyu.api.dto.PagedResult;
import com.kiyuziyu.api.model.Product;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Repository;

import java.util.*;
import java.util.concurrent.ExecutionException;

@Repository
public class ProductRepository {

    private static final Logger log = LoggerFactory.getLogger(ProductRepository.class);

    @Autowired
    private Firestore firestore;

    public PagedResult<Product> findAllProducts(int limit, int offset) throws ExecutionException, InterruptedException {
        long t0 = System.currentTimeMillis();
        try {
            Query baseQuery = firestore.collectionGroup("products").whereGreaterThan("quantity", 0);
            long totalCount = baseQuery.count().get().get().getCount();
            
            Query query = baseQuery.offset(offset).limit(limit);
            List<QueryDocumentSnapshot> docs = query.get().get().getDocuments();
            log.info("[ProductRepo] findAllProducts(limit={}, offset={}) {}ms {} docs, totalCount={}", limit, offset, System.currentTimeMillis()-t0, docs.size(), totalCount);
            Map<String, DocumentSnapshot> cache = new HashMap<>();
            return new PagedResult<>(mapToProducts(docs, cache), totalCount);
        } catch (Exception e) {
            if (isIndexMissingError(e)) {
                log.warn("[ProductRepo] quantity > 0 index not ready yet, falling back to all products temporarily: {}", e.getMessage());
                Query baseQuery = firestore.collectionGroup("products");
                long totalCount = baseQuery.count().get().get().getCount();
                Query query = baseQuery.offset(offset).limit(limit);
                List<QueryDocumentSnapshot> docs = query.get().get().getDocuments();
                Map<String, DocumentSnapshot> cache = new HashMap<>();
                return new PagedResult<>(mapToProducts(docs, cache), totalCount);
            }
            throw e;
        }
    }

    public Product findById(String productCode) throws ExecutionException, InterruptedException {
        long t0 = System.currentTimeMillis();
        try {
            // Fast path: single collectionGroup query (requires Firestore index on products.productCode)
            Query query = firestore.collectionGroup("products").whereEqualTo("productCode", productCode).limit(1);
            List<QueryDocumentSnapshot> docs = query.get().get().getDocuments();
            log.info("[ProductRepo] findById('{}') collectionGroup query {}ms {} docs", productCode, System.currentTimeMillis()-t0, docs.size());
            if (docs.isEmpty()) return null;
            Map<String, DocumentSnapshot> cache = new HashMap<>();
            return mapToProduct(docs.get(0), cache);
        } catch (Exception e) {
            if (isIndexMissingError(e)) {
                log.warn("[ProductRepo] findById('{}') collectionGroup index not ready, falling back to iteration ({}ms so far). Deploy firestore.indexes.json to fix.", productCode, System.currentTimeMillis()-t0);
                return findByIdFallback(productCode);
            }
            throw e;
        }
    }

    /** Iteration-based fallback used until the collectionGroup index is built. */
    private Product findByIdFallback(String productCode) throws ExecutionException, InterruptedException {
        long t0 = System.currentTimeMillis();
        Map<String, DocumentSnapshot> cache = new HashMap<>();
        Iterable<DocumentReference> collections = firestore.collection("collections").listDocuments();
        for (DocumentReference colRef : collections) {
            Iterable<DocumentReference> subcollections = colRef.collection("subcollections").listDocuments();
            for (DocumentReference subRef : subcollections) {
                Query q = subRef.collection("products").whereEqualTo("productCode", productCode).limit(1);
                List<QueryDocumentSnapshot> docs = q.get().get().getDocuments();
                if (!docs.isEmpty()) {
                    log.info("[ProductRepo] findByIdFallback('{}') found via iteration {}ms", productCode, System.currentTimeMillis()-t0);
                    return mapToProduct(docs.get(0), cache);
                }
            }
        }
        log.info("[ProductRepo] findByIdFallback('{}') not found {}ms", productCode, System.currentTimeMillis()-t0);
        return null;
    }

    /** Find a master product by its unique Firestore document ID (productId). */
    public Product findByDocumentId(String productId) throws ExecutionException, InterruptedException {
        if (firestore == null || productId == null || productId.trim().isEmpty()) {
            return null;
        }
        long t0 = System.currentTimeMillis();
        Map<String, DocumentSnapshot> cache = new HashMap<>();

        // Fast path: check root collection "products" if exists
        try {
            DocumentSnapshot rootDoc = firestore.collection("products").document(productId.trim()).get().get();
            if (rootDoc.exists()) {
                Product p = rootDoc.toObject(Product.class);
                if (p != null) {
                    p.setId(rootDoc.getId());
                    if (rootDoc.contains("purchaseRate")) {
                        p.setPurchaseRate(rootDoc.get("purchaseRate"));
                    }
                    return p;
                }
            }
        } catch (Exception ignored) {}

        Iterable<DocumentReference> collections = firestore.collection("collections").listDocuments();
        for (DocumentReference colRef : collections) {
            Iterable<DocumentReference> subcollections = colRef.collection("subcollections").listDocuments();
            for (DocumentReference subRef : subcollections) {
                DocumentSnapshot doc = subRef.collection("products").document(productId.trim()).get().get();
                if (doc.exists()) {
                    log.info("[ProductRepo] findByDocumentId('{}') found via iteration in {}ms", productId, System.currentTimeMillis() - t0);
                    Product p = doc.toObject(Product.class);
                    if (p != null) {
                        p.setId(doc.getId());
                        if (doc.contains("purchaseRate")) {
                            p.setPurchaseRate(doc.get("purchaseRate"));
                        }
                        String[] parts = doc.getReference().getPath().split("/");
                        if (parts.length >= 6 && "collections".equals(parts[0]) && "subcollections".equals(parts[2])) {
                            p.setCollectionId(parts[1]);
                            p.setSubcollectionId(parts[3]);
                            enrichWithParentData(p, parts[1], parts[3], cache);
                        }
                    }
                    return p;
                }
            }
        }
        log.info("[ProductRepo] findByDocumentId('{}') not found after {}ms", productId, System.currentTimeMillis() - t0);
        return null;
    }

    public PagedResult<Product> searchProducts(String searchQuery, int limit, int offset) throws ExecutionException, InterruptedException {
        long t0 = System.currentTimeMillis();
        try {
            // Fast path: single collectionGroup query (requires Firestore index on products.productCode)
            Query baseQuery = firestore.collectionGroup("products")
                    .whereGreaterThanOrEqualTo("productCode", searchQuery)
                    .whereLessThanOrEqualTo("productCode", searchQuery + "\uf8ff");
            long totalCount = baseQuery.count().get().get().getCount();

            Query query = baseQuery.offset(offset).limit(limit);
            List<QueryDocumentSnapshot> docs = query.get().get().getDocuments();
            log.info("[ProductRepo] searchProducts('{}') collectionGroup query {}ms {} docs, totalCount={}", searchQuery, System.currentTimeMillis()-t0, docs.size(), totalCount);
            Map<String, DocumentSnapshot> cache = new HashMap<>();
            return new PagedResult<>(mapToProducts(docs, cache), totalCount);
        } catch (Exception e) {
            if (isIndexMissingError(e)) {
                log.warn("[ProductRepo] searchProducts('{}') collectionGroup index not ready, falling back to iteration. Deploy firestore.indexes.json to fix.", searchQuery);
                return searchProductsFallback(searchQuery, limit, offset);
            }
            throw e;
        }
    }

    /** Iteration-based fallback used until the collectionGroup index is built. */
    private PagedResult<Product> searchProductsFallback(String searchQuery, int limit, int offset) throws ExecutionException, InterruptedException {
        long t0 = System.currentTimeMillis();
        List<Product> allMatches = new ArrayList<>();
        Map<String, DocumentSnapshot> cache = new HashMap<>();
        Iterable<DocumentReference> collections = firestore.collection("collections").listDocuments();
        for (DocumentReference colRef : collections) {
            Iterable<DocumentReference> subcollections = colRef.collection("subcollections").listDocuments();
            for (DocumentReference subRef : subcollections) {
                Query q = subRef.collection("products")
                        .whereGreaterThanOrEqualTo("productCode", searchQuery)
                        .whereLessThanOrEqualTo("productCode", searchQuery + "\uf8ff");
                allMatches.addAll(mapToProducts(q.get().get().getDocuments(), cache));
            }
        }
        log.info("[ProductRepo] searchProductsFallback('{}') found {} results {}ms", searchQuery, allMatches.size(), System.currentTimeMillis()-t0);
        long totalCount = allMatches.size();
        int toIndex = Math.min(offset + limit, allMatches.size());
        if (offset >= allMatches.size()) return new PagedResult<>(new ArrayList<>(), totalCount);
        return new PagedResult<>(allMatches.subList(offset, toIndex), totalCount);
    }

    private boolean isIndexMissingError(Exception e) {
        String msg = e.getMessage();
        if (msg == null) return false;
        // Check cause chain too
        Throwable cause = e.getCause();
        while (cause != null) {
            if (cause.getMessage() != null && cause.getMessage().contains("FAILED_PRECONDITION")) return true;
            cause = cause.getCause();
        }
        return msg.contains("FAILED_PRECONDITION") || msg.contains("index");
    }

    public PagedResult<Product> findByCollectionId(String collectionId, int limit, int offset) throws ExecutionException, InterruptedException {
        long t0 = System.currentTimeMillis();
        DocumentReference colRef = firestore.collection("collections").document(collectionId);
        Query baseQuery = firestore.collectionGroup("products")
                .orderBy(FieldPath.documentId())
                .startAt(colRef.getPath())
                .endAt(colRef.getPath() + "\uf8ff");
        long totalCount = baseQuery.count().get().get().getCount();

        Query query = baseQuery.offset(offset).limit(limit);
        List<QueryDocumentSnapshot> docs = query.get().get().getDocuments();
        log.info("[ProductRepo] findByCollectionId('{}') collectionGroup query {}ms {} docs, totalCount={}", collectionId, System.currentTimeMillis()-t0, docs.size(), totalCount);
        Map<String, DocumentSnapshot> cache = new HashMap<>();
        return new PagedResult<>(mapToProducts(docs, cache), totalCount);
    }

    public List<Map<String, Object>> findAllCollections() throws ExecutionException, InterruptedException {
        long t0 = System.currentTimeMillis();
        List<QueryDocumentSnapshot> docs = firestore.collection("collections").get().get().getDocuments();
        log.info("[ProductRepo] findAllCollections() {}ms {} docs", System.currentTimeMillis()-t0, docs.size());
        
        List<com.google.api.core.ApiFuture<com.google.cloud.firestore.QuerySnapshot>> futures = new ArrayList<>();
        for (QueryDocumentSnapshot doc : docs) {
            futures.add(firestore.collection("collections").document(doc.getId()).collection("subcollections").get());
        }
        
        List<Map<String, Object>> result = new ArrayList<>();
        for (int i = 0; i < docs.size(); i++) {
            QueryDocumentSnapshot doc = docs.get(i);
            Map<String, Object> data = doc.getData();
            if (data == null) data = new HashMap<>();
            data = new LinkedHashMap<>(data);
            data.put("id", doc.getId());
            
            List<QueryDocumentSnapshot> subDocs = futures.get(i).get().getDocuments();
            List<Map<String, Object>> subs = new ArrayList<>();
            for (QueryDocumentSnapshot subDoc : subDocs) {
                Map<String, Object> subData = subDoc.getData();
                if (subData == null) subData = new HashMap<>();
                subData = new LinkedHashMap<>(subData);
                subData.put("id", subDoc.getId());
                subs.add(subData);
            }
            data.put("subcollections", subs);
            
            result.add(data);
        }
        log.info("[ProductRepo] Fetched subcollections concurrently in {}ms", System.currentTimeMillis() - t0);
        return result;
    }

    private List<Product> mapToProducts(List<QueryDocumentSnapshot> docs, Map<String, DocumentSnapshot> cache) throws ExecutionException, InterruptedException {
        prefetchParentDocs(docs, cache);
        List<Product> products = new ArrayList<>();
        for (QueryDocumentSnapshot doc : docs) {
            try {
                products.add(mapToProduct(doc, cache));
            } catch (Exception e) {
                log.warn("[ProductRepo] Skipping product doc {} due to mapping error: {}", doc.getId(), e.getMessage());
            }
        }
        return products;
    }

    private void prefetchParentDocs(List<QueryDocumentSnapshot> docs, Map<String, DocumentSnapshot> cache) throws ExecutionException, InterruptedException {
        Set<String> colIds = new LinkedHashSet<>();
        Set<String> subKeys = new LinkedHashSet<>();
        for (QueryDocumentSnapshot doc : docs) {
            String[] parts = doc.getReference().getPath().split("/");
            if (parts.length >= 6 && "collections".equals(parts[0]) && "subcollections".equals(parts[2])) {
                colIds.add(parts[1]);
                subKeys.add(parts[1] + "|" + parts[3]);
            }
        }
        List<DocumentReference> colRefs = new ArrayList<>();
        for (String colId : colIds) {
            if (!cache.containsKey("col_" + colId)) colRefs.add(firestore.collection("collections").document(colId));
        }
        if (!colRefs.isEmpty()) {
            long t0 = System.currentTimeMillis();
            List<DocumentSnapshot> snaps = firestore.getAll(colRefs.toArray(new DocumentReference[0])).get();
            log.debug("[ProductRepo] Batch-fetched {} collection docs {}ms", colRefs.size(), System.currentTimeMillis()-t0);
            for (DocumentSnapshot s : snaps) cache.put("col_" + s.getId(), s);
        }
        List<DocumentReference> subRefs = new ArrayList<>();
        for (String key : subKeys) {
            if (!cache.containsKey("sub_" + key)) {
                String[] kp = key.split("\\|");
                subRefs.add(firestore.collection("collections").document(kp[0]).collection("subcollections").document(kp[1]));
            }
        }
        if (!subRefs.isEmpty()) {
            long t0 = System.currentTimeMillis();
            List<DocumentSnapshot> snaps = firestore.getAll(subRefs.toArray(new DocumentReference[0])).get();
            log.debug("[ProductRepo] Batch-fetched {} subcollection docs {}ms", subRefs.size(), System.currentTimeMillis()-t0);
            for (DocumentSnapshot s : snaps) {
                String[] parts = s.getReference().getPath().split("/");
                if (parts.length >= 4) cache.put("sub_" + parts[1] + "_" + parts[3], s);
            }
        }
    }

    private Product mapToProduct(QueryDocumentSnapshot doc, Map<String, DocumentSnapshot> cache) throws ExecutionException, InterruptedException {
        Product p = doc.toObject(Product.class);
        p.setId(doc.getId());
        if (doc.contains("purchaseRate")) {
            p.setPurchaseRate(doc.get("purchaseRate"));
        }
        String[] parts = doc.getReference().getPath().split("/");
        if (parts.length >= 6 && "collections".equals(parts[0]) && "subcollections".equals(parts[2])) {
            p.setCollectionId(parts[1]);
            p.setSubcollectionId(parts[3]);
            enrichWithParentData(p, parts[1], parts[3], cache);
        }
        return p;
    }

    @SuppressWarnings("unchecked")
    private void enrichWithParentData(Product product, String colId, String subId, Map<String, DocumentSnapshot> cache) throws ExecutionException, InterruptedException {
        String colCacheKey = "col_" + colId;
        DocumentSnapshot colDoc = cache.get(colCacheKey);
        if (colDoc == null) {
            long t0 = System.currentTimeMillis();
            colDoc = firestore.collection("collections").document(colId).get().get();
            log.debug("[ProductRepo] Fetched collection '{}' {}ms", colId, System.currentTimeMillis()-t0);
            cache.put(colCacheKey, colDoc);
        }
        if (colDoc != null && colDoc.exists()) {
            Map<String, Object> colData = colDoc.getData();
            if (colData != null) product.setCollectionData(colData);
        }

        String subCacheKey = "sub_" + colId + "_" + subId;
        DocumentSnapshot subDoc = cache.get(subCacheKey);
        if (subDoc == null) {
            long t0 = System.currentTimeMillis();
            subDoc = firestore.collection("collections").document(colId).collection("subcollections").document(subId).get().get();
            log.debug("[ProductRepo] Fetched subcollection '{}/{}' {}ms", colId, subId, System.currentTimeMillis()-t0);
            cache.put(subCacheKey, subDoc);
        }
        if (subDoc != null && subDoc.exists()) {
            Map<String, Object> subData = subDoc.getData();
            if (subData != null) {
                Map<String, Object> filtered = new LinkedHashMap<>(subData);
                filtered.remove("dropshipperPricing");
                product.setSubcollectionData(filtered);
            }
            if (subDoc.contains("description")) product.setDescription(subDoc.getString("description"));
            if (subDoc.contains("tieredPricing")) {
                Map<String, Object> tp = (Map<String, Object>) subDoc.get("tieredPricing");
                if (tp != null && tp.containsKey("retail")) {
                    List<Map<String, Object>> retail = (List<Map<String, Object>>) tp.get("retail");
                    if (retail != null && !retail.isEmpty()) {
                        Map<String, Object> tier = retail.get(0);
                        if (tier.containsKey("price")) {
                            Object priceObj = tier.get("price");
                            if (priceObj instanceof Number) product.setBasePrice(((Number) priceObj).doubleValue());
                            else if (priceObj instanceof String) {
                                try { product.setBasePrice(Double.parseDouble((String) priceObj)); } catch (NumberFormatException ignored) {}
                            }
                        }
                    }
                }
            }
        }
    }
}
