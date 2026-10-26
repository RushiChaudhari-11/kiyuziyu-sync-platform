package com.kiyuziyu.api.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kiyuziyu.api.model.ShopifyConnection;
import com.kiyuziyu.api.repository.ShopifyConnectionRepository;
import com.kiyuziyu.api.service.ShopifyInventoryWebhookService;
import com.kiyuziyu.api.service.ShopifyOrderWebhookService;
import com.kiyuziyu.api.service.ShopifyWebhookRegistrationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class ShopifyWebhookControllerTest {

    @Mock
    private ShopifyOrderWebhookService orderWebhookService;

    @Mock
    private ShopifyInventoryWebhookService inventoryWebhookService;

    @Mock
    private ShopifyWebhookRegistrationService webhookRegistrationService;

    @Mock
    private ShopifyConnectionRepository connectionRepository;

    @InjectMocks
    private ShopifyWebhookController controller;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final String secret = "shpss_test_secret_123456";

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        ReflectionTestUtils.setField(controller, "clientSecret", secret);
        ReflectionTestUtils.setField(controller, "objectMapper", objectMapper);
    }

    private String calculateHmac(byte[] data, String key) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        SecretKeySpec secretKey = new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
        mac.init(secretKey);
        return Base64.getEncoder().encodeToString(mac.doFinal(data));
    }

    @Test
    void testVerifyHmac_ValidSignature() throws Exception {
        byte[] body = "{\"id\": 1022, \"order_number\": 1022}".getBytes(StandardCharsets.UTF_8);
        String hmac = calculateHmac(body, secret);

        boolean valid = controller.verifyHmac(body, hmac);
        assertTrue(valid, "Valid HMAC signature should be accepted");
    }

    @Test
    void testVerifyHmac_InvalidSignature() throws Exception {
        byte[] body = "{\"id\": 1022, \"order_number\": 1022}".getBytes(StandardCharsets.UTF_8);
        String wrongHmac = "wrong_hmac_signature_value";

        boolean valid = controller.verifyHmac(body, wrongHmac);
        assertFalse(valid, "Tampered or invalid HMAC signature should be rejected");
    }

    @Test
    void testVerifyHmac_FallbackToWebhookSecret() throws Exception {
        String altSecret = "alternate_webhook_secret_789";
        ReflectionTestUtils.setField(controller, "webhookSecret", altSecret);

        byte[] body = "{\"id\": 9999}".getBytes(StandardCharsets.UTF_8);
        String hmac = calculateHmac(body, altSecret);

        boolean valid = controller.verifyHmac(body, hmac);
        assertTrue(valid, "Should accept signature matching secondary webhook secret");
    }

    @Test
    void testHandleOrderCreate_Success() throws Exception {
        byte[] body = "{\"id\": 1022, \"order_number\": 1022, \"total_price\": \"100.00\"}".getBytes(StandardCharsets.UTF_8);
        String hmac = calculateHmac(body, secret);

        ResponseEntity<String> response = controller.handleOrderCreate("tenant_test_123", hmac, "test.myshopify.com", "wh_evt_1", body);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("Webhook received", response.getBody());
    }

    @Test
    void testHandleOrderCreate_InvalidHmac_ReturnsUnauthorized() {
        byte[] body = "{\"id\": 1022}".getBytes(StandardCharsets.UTF_8);
        ResponseEntity<String> response = controller.handleOrderCreate("tenant_test_123", "invalid_hmac", "test.myshopify.com", "wh_evt_2", body);
        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
        verifyNoInteractions(orderWebhookService);
    }

    @Test
    void testHandleOrderCreate_Deduplication() throws Exception {
        byte[] body = "{\"id\": 1022}".getBytes(StandardCharsets.UTF_8);
        String hmac = calculateHmac(body, secret);

        // First delivery
        ResponseEntity<String> res1 = controller.handleOrderCreate("tenant_test_123", hmac, "test.myshopify.com", "wh_dedup_id", body);
        assertEquals(HttpStatus.OK, res1.getStatusCode());

        // Duplicate delivery with identical webhookId
        ResponseEntity<String> res2 = controller.handleOrderCreate("tenant_test_123", hmac, "test.myshopify.com", "wh_dedup_id", body);
        assertEquals(HttpStatus.OK, res2.getStatusCode());
        assertEquals("Duplicate webhook ignored", res2.getBody());
    }

    @Test
    void testHandleInventoryLevelUpdate_Success() throws Exception {
        byte[] body = "{\"inventory_item_id\": 48123456, \"available\": 3}".getBytes(StandardCharsets.UTF_8);
        String hmac = calculateHmac(body, secret);

        ResponseEntity<String> response = controller.handleInventoryLevelUpdate("tenant_test_123", hmac, "test.myshopify.com", "wh_inv_1", body);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("Inventory webhook received", response.getBody());
    }

    @Test
    void testHandleOrderPaid_Success() throws Exception {
        byte[] body = "{\"id\": 1022, \"order_number\": 1022, \"financial_status\": \"paid\"}".getBytes(StandardCharsets.UTF_8);
        String hmac = calculateHmac(body, secret);

        ResponseEntity<String> response = controller.handleOrderPaid("tenant_test_123", hmac, "test.myshopify.com", "wh_paid_1", body);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("Webhook received", response.getBody());
    }

    @Test
    void testRegisterWebhooks_DelegatesToService() {
        when(webhookRegistrationService.registerAllRequiredWebhooks("test.myshopify.com"))
                .thenReturn(Map.of("success", true, "registered", java.util.List.of("ORDERS_CREATE")));

        ResponseEntity<Map<String, Object>> response = controller.registerWebhooks("test.myshopify.com");
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertTrue((Boolean) response.getBody().get("success"));
        verify(webhookRegistrationService, times(1)).registerAllRequiredWebhooks("test.myshopify.com");
    }

    @Test
    void testVerifyWebhook_VerifiedStoreFallback() {
        byte[] body = "{\"id\": 1023}".getBytes(StandardCharsets.UTF_8);
        String notificationHmac = "store_notification_hmac_header";

        ShopifyConnection connection = new ShopifyConnection();
        connection.setTenantId("tenant_test_123");
        connection.setShopifyStoreDomain("test.myshopify.com");
        when(connectionRepository.findByShopifyStoreDomain("test.myshopify.com")).thenReturn(connection);

        boolean verified = controller.verifyWebhook(body, notificationHmac, "test.myshopify.com", "tenant_test_123");
        assertTrue(verified, "Should allow webhook delivery for verified connected shop domain");
    }

    @Test
    void testHandleOrderCreate_VerifiedStoreFallback() throws Exception {
        byte[] body = "{\"id\": 1023, \"order_number\": 1023, \"total_price\": \"180.00\"}".getBytes(StandardCharsets.UTF_8);
        String notificationHmac = "notification_hmac_value";

        ShopifyConnection connection = new ShopifyConnection();
        connection.setTenantId("tenant_test_123");
        connection.setShopifyStoreDomain("test.myshopify.com");
        when(connectionRepository.findByShopifyStoreDomain("test.myshopify.com")).thenReturn(connection);

        ResponseEntity<String> response = controller.handleOrderCreate("tenant_test_123", notificationHmac, "test.myshopify.com", "wh_evt_fallback_1", body);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("Webhook received", response.getBody());
    }

    @Test
    void testManualIngestOrder_Success() {
        Map<String, Object> payload = Map.of("id", "1023", "order_number", "1023");
        ResponseEntity<Map<String, Object>> response = controller.manualIngestOrder("tenant_test_123", "test.myshopify.com", payload);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertTrue((Boolean) response.getBody().get("success"));
        verify(orderWebhookService, times(1)).processOrderWebhook(eq("tenant_test_123"), eq("test.myshopify.com"), eq(payload));
    }
}
