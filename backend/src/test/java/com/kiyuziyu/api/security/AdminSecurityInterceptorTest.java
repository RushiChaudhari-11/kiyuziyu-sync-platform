package com.kiyuziyu.api.security;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.junit.jupiter.api.Assertions.*;

class AdminSecurityInterceptorTest {

    private AdminSecurityInterceptor interceptor;
    private MockHttpServletRequest request;
    private MockHttpServletResponse response;

    @BeforeEach
    void setUp() {
        interceptor = new AdminSecurityInterceptor();
        request = new MockHttpServletRequest();
        response = new MockHttpServletResponse();
    }

    @Test
    void preHandle_MissingConfiguredAdminToken_ReturnsForbidden() throws Exception {
        interceptor.setAdminToken(null);
        request.addHeader("X-Admin-Token", "someToken");

        boolean result = interceptor.preHandle(request, response, new Object());

        assertFalse(result);
        assertEquals(403, response.getStatus());
    }

    @Test
    void preHandle_BlankConfiguredAdminToken_ReturnsForbidden() throws Exception {
        interceptor.setAdminToken("   ");
        request.addHeader("X-Admin-Token", "someToken");

        boolean result = interceptor.preHandle(request, response, new Object());

        assertFalse(result);
        assertEquals(403, response.getStatus());
    }

    @Test
    void preHandle_MissingRequestToken_ReturnsForbidden() throws Exception {
        interceptor.setAdminToken("secretToken123");

        boolean result = interceptor.preHandle(request, response, new Object());

        assertFalse(result);
        assertEquals(403, response.getStatus());
    }

    @Test
    void preHandle_InvalidRequestToken_ReturnsForbidden() throws Exception {
        interceptor.setAdminToken("secretToken123");
        request.addHeader("X-Admin-Token", "wrongToken");

        boolean result = interceptor.preHandle(request, response, new Object());

        assertFalse(result);
        assertEquals(403, response.getStatus());
    }

    @Test
    void preHandle_ValidRequestToken_AllowsRequest() throws Exception {
        interceptor.setAdminToken("secretToken123");
        request.addHeader("X-Admin-Token", "secretToken123");

        boolean result = interceptor.preHandle(request, response, new Object());

        assertTrue(result);
        assertEquals(200, response.getStatus());
    }
}
