package com.kiyuziyu.api.service;

import com.google.cloud.Timestamp;
import com.kiyuziyu.api.model.ApiClient;
import com.kiyuziyu.api.model.ApiCredential;
import com.kiyuziyu.api.model.ClientProductOverride;
import com.kiyuziyu.api.repository.ApiClientRepository;
import com.kiyuziyu.api.repository.ApiCredentialRepository;
import com.kiyuziyu.api.repository.ClientProductOverrideRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.UUID;
import java.util.concurrent.ExecutionException;

@Service
public class ApiClientService {

    @Autowired
    private ApiClientRepository apiClientRepository;

    @Autowired
    private ApiCredentialRepository apiCredentialRepository;

    @Autowired
    private ClientProductOverrideRepository overrideRepository;

    private static final SecureRandom secureRandom = new SecureRandom();

    public ApiClient createClient(String clientName, String domain) throws ExecutionException, InterruptedException {
        ApiClient client = new ApiClient();
        client.setClientId(UUID.randomUUID().toString());
        client.setClientName(clientName);
        client.setDomain(domain);
        client.setStatus("ACTIVE");
        client.setCreatedAt(Timestamp.now());
        client.setUpdatedAt(Timestamp.now());
        
        apiClientRepository.save(client);
        return client;
    }

    public String generateApiKey(String clientId) throws ExecutionException, InterruptedException {
        // Invalidate old keys first (optional logic, but we'll implement multiple keys logic or just simple generation)
        // For simplicity, we just generate a new one. A revoked key should be handled separately.

        byte[] randomBytes = new byte[32];
        secureRandom.nextBytes(randomBytes);
        String rawSecret = Base64.getUrlEncoder().withoutPadding().encodeToString(randomBytes);
        String fullKey = "kyz_live_" + rawSecret;

        ApiCredential credential = new ApiCredential();
        credential.setCredentialId(UUID.randomUUID().toString());
        credential.setClientId(clientId);
        credential.setApiKeyHash(hashKey(fullKey));
        credential.setStatus("ACTIVE");
        credential.setCreatedAt(Timestamp.now());
        
        apiCredentialRepository.save(credential);
        
        // Only return the plaintext key once
        return fullKey;
    }
    
    public void revokeKeyByHash(String hash) throws ExecutionException, InterruptedException {
        ApiCredential cred = apiCredentialRepository.findByHash(hash);
        if (cred != null) {
            cred.setStatus("REVOKED");
            apiCredentialRepository.save(cred);
        }
    }

    public void suspendClient(String clientId) throws ExecutionException, InterruptedException {
        ApiClient client = apiClientRepository.findById(clientId);
        if (client != null) {
            client.setStatus("SUSPENDED");
            client.setUpdatedAt(Timestamp.now());
            apiClientRepository.save(client);
        }
    }

    public String hashKey(String plaintextKey) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] encodedhash = digest.digest(plaintextKey.getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder(2 * encodedhash.length);
            for (int i = 0; i < encodedhash.length; i++) {
                String hex = Integer.toHexString(0xff & encodedhash[i]);
                if(hex.length() == 1) {
                    hexString.append('0');
                }
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 algorithm not found", e);
        }
    }

    public ApiCredential authenticate(String apiKey) throws ExecutionException, InterruptedException {
        String hash = hashKey(apiKey);
        ApiCredential cred = apiCredentialRepository.findByHash(hash);
        if (cred == null || !"ACTIVE".equals(cred.getStatus())) {
            return null;
        }

        ApiClient client = apiClientRepository.findById(cred.getClientId());
        if (client == null || !"ACTIVE".equals(client.getStatus())) {
            return null; // Client suspended or revoked
        }

        // Update lastUsedAt optionally (might cause too many writes, so skip for now)
        return cred;
    }

    public void setProductOverride(String clientId, String productId, String productCode, 
                                   String customName, String customDesc, String customImg, Double sellingPrice) throws ExecutionException, InterruptedException {
        
        ApiClient client = apiClientRepository.findById(clientId);
        if (client == null) throw new IllegalArgumentException("Client not found");

        ClientProductOverride override = overrideRepository.findByClientAndProduct(clientId, productId);
        if (override == null) {
            override = new ClientProductOverride();
            override.setClientId(clientId);
            override.setProductId(productId);
            override.setProductCode(productCode);
            override.setCreatedAt(Timestamp.now());
        }
        
        override.setCustomProductName(customName);
        override.setCustomDescription(customDesc);
        override.setCustomImage(customImg);
        
        if (sellingPrice != null && sellingPrice < 0) {
            throw new IllegalArgumentException("Selling price cannot be negative");
        }
        override.setSellingPrice(sellingPrice);
        override.setEnabled(true);
        override.setUpdatedAt(Timestamp.now());
        
        overrideRepository.save(override);
    }
}
