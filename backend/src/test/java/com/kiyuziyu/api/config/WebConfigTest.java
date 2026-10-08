package com.kiyuziyu.api.config;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.servlet.config.annotation.CorsRegistration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class WebConfigTest {

    private WebConfig webConfig;

    @BeforeEach
    void setUp() {
        webConfig = new WebConfig();
    }

    @Test
    void addCorsMappings_ConfiguredProductionAndLocalhostOrigins_RegistersCorrectCorsConfiguration() {
        ReflectionTestUtils.setField(webConfig, "allowedOrigins", "https://kiyuziyuofficial.com, http://localhost:3000, http://localhost:5173");

        CorsRegistry registry = new CorsRegistry();
        webConfig.addCorsMappings(registry);

        List<CorsRegistration> registrations = (List<CorsRegistration>) ReflectionTestUtils.getField(registry, "registrations");
        assertNotNull(registrations);
        assertEquals(1, registrations.size());

        CorsRegistration registration = registrations.get(0);
        String pathPattern = (String) ReflectionTestUtils.getField(registration, "pathPattern");
        assertEquals("/api/**", pathPattern);

        CorsConfiguration config = (CorsConfiguration) ReflectionTestUtils.getField(registration, "config");
        assertNotNull(config);

        List<String> allowedOrigins = config.getAllowedOrigins();
        assertNotNull(allowedOrigins);
        assertTrue(allowedOrigins.contains("https://kiyuziyuofficial.com"));
        assertTrue(allowedOrigins.contains("http://localhost:3000"));
        assertTrue(allowedOrigins.contains("http://localhost:5173"));
        assertFalse(allowedOrigins.contains("https://unauthorized-domain.com"));
        assertFalse(allowedOrigins.contains("*"));

        assertEquals(Boolean.FALSE, config.getAllowCredentials());
        assertTrue(config.getAllowedMethods().containsAll(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")));
        assertTrue(config.getAllowedHeaders().contains("*"));
    }

    @Test
    void addCorsMappings_BlankConfiguredOrigins_DoesNotRegisterMapping() {
        ReflectionTestUtils.setField(webConfig, "allowedOrigins", "   ");

        CorsRegistry registry = new CorsRegistry();
        webConfig.addCorsMappings(registry);

        List<CorsRegistration> registrations = (List<CorsRegistration>) ReflectionTestUtils.getField(registry, "registrations");
        assertTrue(registrations == null || registrations.isEmpty());
    }
}
