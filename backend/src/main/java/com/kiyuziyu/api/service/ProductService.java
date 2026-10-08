package com.kiyuziyu.api.service;

import com.kiyuziyu.api.dto.PagedResult;
import com.kiyuziyu.api.dto.ProductResponse;
import com.kiyuziyu.api.model.Product;
import com.kiyuziyu.api.model.ClientProductOverride;
import com.kiyuziyu.api.repository.ProductRepository;
import com.kiyuziyu.api.repository.ClientProductOverrideRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutionException;

@Service
public class ProductService {

    @Autowired
    private ProductRepository productRepository;
    
    @Autowired
    private ClientProductOverrideRepository overrideRepository;

    public PagedResult<ProductResponse> getAllProducts(String clientId, int limit, int offset) throws ExecutionException, InterruptedException {
        PagedResult<Product> pagedResult = productRepository.findAllProducts(limit, offset);
        return new PagedResult<>(mapToResponseList(pagedResult.getData(), clientId), pagedResult.getTotalCount());
    }

    public ProductResponse getProductById(String clientId, String id) throws ExecutionException, InterruptedException {
        Product product = productRepository.findById(id);
        if (product == null) {
            return null;
        }
        return mapToResponse(product, clientId);
    }

    public PagedResult<ProductResponse> searchProducts(String clientId, String query, int limit, int offset) throws ExecutionException, InterruptedException {
        PagedResult<Product> pagedResult = productRepository.searchProducts(query, limit, offset);
        return new PagedResult<>(mapToResponseList(pagedResult.getData(), clientId), pagedResult.getTotalCount());
    }

    public PagedResult<ProductResponse> getProductsByCollection(String clientId, String collectionId, int limit, int offset) throws ExecutionException, InterruptedException {
        PagedResult<Product> pagedResult = productRepository.findByCollectionId(collectionId, limit, offset);
        return new PagedResult<>(mapToResponseList(pagedResult.getData(), clientId), pagedResult.getTotalCount());
    }

    // --- MAPPING LOGIC ---

    private List<ProductResponse> mapToResponseList(List<Product> products, String clientId) {
        List<ProductResponse> responses = new ArrayList<>();
        for (Product p : products) {
            responses.add(mapToResponse(p, clientId));
        }
        return responses;
    }

    private ProductResponse mapToResponse(Product p, String clientId) {
        ProductResponse res = new ProductResponse();
        res.setProductId(p.getId());
        res.setProductCode(p.getProductCode());
        res.setProductName(p.getProductName());
        res.setDescription(p.getDescription());
        res.setBasePrice(p.getBasePrice());
        res.setImage(p.getImage());
        res.setImages(p.getImages());
        res.setTags(p.getTags());
        res.setCollectionId(p.getCollectionId());
        res.setSubcollectionId(p.getSubcollectionId());
        res.setVariations(p.getVariations());
        res.setCollectionData(p.getCollectionData());
        res.setSubcollectionData(p.getSubcollectionData());

        res.setQuantity(p.getQuantity());
        res.setInitialQuantity(p.getInitialQuantity());

        // Stock Calculation Logic
        int calculatedStock = calculateStock(p);
        res.setStock(calculatedStock);
        res.setAvailability(calculatedStock > 0);
        
        // Merge Client Override
        if (clientId != null && !clientId.isEmpty()) {
            try {
                ClientProductOverride override = overrideRepository.findByClientAndProduct(clientId, p.getProductCode());
                if (override != null && Boolean.TRUE.equals(override.getEnabled())) {
                    if (override.getCustomProductName() != null && !override.getCustomProductName().isEmpty()) {
                        res.setProductName(override.getCustomProductName());
                    }
                    if (override.getCustomDescription() != null && !override.getCustomDescription().isEmpty()) {
                        res.setDescription(override.getCustomDescription());
                    }
                    if (override.getCustomImage() != null && !override.getCustomImage().isEmpty()) {
                        res.setImage(override.getCustomImage());
                    }
                    if (override.getCustomImages() != null && !override.getCustomImages().isEmpty()) {
                        res.setImages(override.getCustomImages());
                    }
                    if (override.getSellingPrice() != null) {
                        res.setSellingPrice(override.getSellingPrice());
                    }
                }
            } catch (Exception e) {
                // Log exception in production, but continue mapping base product
                e.printStackTrace();
            }
        }

        return res;
    }

    private int calculateStock(Product p) {
        int totalStock = 0;
        int initialTotalStock = 0;
        boolean hasQuantity = false;

        // 1. Variant products: sum quantity inside variations
        if (p.getVariations() != null && !p.getVariations().isEmpty()) {
            for (Map<String, Object> var : p.getVariations()) {
                if (var.containsKey("quantity") && var.get("quantity") != null) {
                    hasQuantity = true;
                    Object qty = var.get("quantity");
                    if (qty instanceof Number) {
                        totalStock += ((Number) qty).intValue();
                    } else if (qty instanceof String) {
                        try {
                            totalStock += Integer.parseInt((String) qty);
                        } catch (NumberFormatException ignored) {}
                    }
                }
                if (var.containsKey("initialQuantity") && var.get("initialQuantity") != null) {
                    Object initialQty = var.get("initialQuantity");
                    if (initialQty instanceof Number) {
                        initialTotalStock += ((Number) initialQty).intValue();
                    } else if (initialQty instanceof String) {
                        try {
                            initialTotalStock += Integer.parseInt((String) initialQty);
                        } catch (NumberFormatException ignored) {}
                    }
                }
            }
        } 
        // 2. Simple products: check quantity at root level
        else {
            if (p.getQuantity() != null) {
                hasQuantity = true;
                Object qty = p.getQuantity();
                if (qty instanceof Number) {
                    totalStock = ((Number) qty).intValue();
                } else if (qty instanceof String) {
                    try {
                        totalStock = Integer.parseInt((String) qty);
                    } catch (NumberFormatException ignored) {}
                }
            }
            if (p.getInitialQuantity() != null) {
                Object qty = p.getInitialQuantity();
                if (qty instanceof Number) {
                    initialTotalStock = ((Number) qty).intValue();
                } else if (qty instanceof String) {
                    try {
                        initialTotalStock = Integer.parseInt((String) qty);
                    } catch (NumberFormatException ignored) {}
                }
            }
        }

        if (hasQuantity) {
            return totalStock;
        }
        return initialTotalStock;
    }
}
