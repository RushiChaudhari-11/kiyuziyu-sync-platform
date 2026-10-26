package com.kiyuziyu.api.service;

import com.kiyuziyu.api.integration.shopify.ShopifyContextHolder;
import com.kiyuziyu.api.integration.shopify.ShopifyGraphQLClient;
import com.kiyuziyu.api.model.ShopifyConnection;
import com.kiyuziyu.api.repository.ShopifyConnectionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class ShopifyWebhookRegistrationService {

    private static final Logger log = LoggerFactory.getLogger(ShopifyWebhookRegistrationService.class);

    @Autowired
    private ShopifyGraphQLClient graphQLClient;

    @Autowired
    private ShopifyConnectionRepository connectionRepository;

    @Value("${shopify.oauth.redirect-uri:https://kiyuziyu-api-703805908757.asia-south1.run.app/api/v1/shopify/oauth/callback}")
    private String redirectUri;

    @Value("${shopify.webhook-base-url:}")
    private String explicitWebhookBaseUrl;

    public String resolveWebhookBaseUrl() {
        if (explicitWebhookBaseUrl != null && !explicitWebhookBaseUrl.trim().isEmpty()) {
            String url = explicitWebhookBaseUrl.trim();
            return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
        }
        if (redirectUri != null && redirectUri.contains("/api/v1/shopify/oauth")) {
            return redirectUri.substring(0, redirectUri.indexOf("/api/v1/shopify/oauth"));
        }
        return "https://kiyuziyu-api-703805908757.asia-south1.run.app";
    }

    /**
     * Registers all required webhooks (orders/create, orders/paid, orders/cancelled, inventory_levels/update)
     * for a connected Shopify store, avoiding duplicate registrations.
     */
    public Map<String, Object> registerAllRequiredWebhooks(String shopDomain) {
        Map<String, Object> result = new HashMap<>();
        if (shopDomain == null || shopDomain.trim().isEmpty()) {
            result.put("success", false);
            result.put("message", "Shop domain is required");
            return result;
        }

        String domain = shopDomain.trim();
        ShopifyConnection connection = connectionRepository.findByShopifyStoreDomain(domain);
        String tenantId = connection != null ? connection.getTenantId() : "";

        ShopifyContextHolder.setContext(domain);
        try {
            String baseUrl = resolveWebhookBaseUrl();
            List<Map<String, Object>> existingSubs = graphQLClient.getWebhookSubscriptions();
            log.info("[ShopifyWebhookRegistration] Store {} currently has {} webhook subscriptions", domain, existingSubs.size());

            Map<String, String> requiredTopics = new LinkedHashMap<>();
            requiredTopics.put("ORDERS_CREATE", baseUrl + "/api/v1/webhooks/shopify/orders/create" + (tenantId != null && !tenantId.isEmpty() ? "?tenantId=" + tenantId : ""));
            requiredTopics.put("ORDERS_PAID", baseUrl + "/api/v1/webhooks/shopify/orders/paid" + (tenantId != null && !tenantId.isEmpty() ? "?tenantId=" + tenantId : ""));
            requiredTopics.put("ORDERS_CANCELLED", baseUrl + "/api/v1/webhooks/shopify/orders/cancelled" + (tenantId != null && !tenantId.isEmpty() ? "?tenantId=" + tenantId : ""));
            requiredTopics.put("INVENTORY_LEVELS_UPDATE", baseUrl + "/api/v1/webhooks/shopify/inventory-levels/update" + (tenantId != null && !tenantId.isEmpty() ? "?tenantId=" + tenantId : ""));

            List<String> registered = new ArrayList<>();
            List<String> skippedAlreadyExisting = new ArrayList<>();
            List<String> errors = new ArrayList<>();

            for (Map.Entry<String, String> entry : requiredTopics.entrySet()) {
                String topic = entry.getKey();
                String targetCallback = entry.getValue();

                // Check if already subscribed to this topic
                boolean alreadySubscribed = false;
                for (Map<String, Object> sub : existingSubs) {
                    String existingTopic = String.valueOf(sub.get("topic"));
                    if (topic.equalsIgnoreCase(existingTopic)) {
                        @SuppressWarnings("unchecked")
                        Map<String, Object> endpoint = (Map<String, Object>) sub.get("endpoint");
                        if (endpoint != null) {
                            String existingCallback = String.valueOf(endpoint.get("callbackUrl"));
                            if (existingCallback.startsWith(baseUrl)) {
                                alreadySubscribed = true;
                                skippedAlreadyExisting.add(topic + " -> " + existingCallback);
                                break;
                            }
                        }
                    }
                }

                if (!alreadySubscribed) {
                    try {
                        Map<String, Object> sub = graphQLClient.registerWebhookSubscription(topic, targetCallback);
                        registered.add(topic + " -> " + targetCallback);
                        log.info("[ShopifyWebhookRegistration] Successfully registered webhook: {} -> {}", topic, targetCallback);
                    } catch (Exception ex) {
                        log.error("[ShopifyWebhookRegistration] Failed to register webhook {}: {}", topic, ex.getMessage());
                        errors.add(topic + ": " + ex.getMessage());
                    }
                }
            }

            result.put("success", errors.isEmpty());
            result.put("registered", registered);
            result.put("skippedAlreadyExisting", skippedAlreadyExisting);
            result.put("errors", errors);
            return result;
        } catch (Exception e) {
            log.error("[ShopifyWebhookRegistration] Error registering webhooks for store {}: {}", domain, e.getMessage(), e);
            result.put("success", false);
            result.put("message", e.getMessage());
            return result;
        } finally {
            ShopifyContextHolder.clearContext();
        }
    }
}
