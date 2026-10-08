package com.kiyuziyu.api.controller;

import com.google.firebase.auth.FirebaseToken;
import com.kiyuziyu.api.exception.GlobalExceptionHandler;
import com.kiyuziyu.api.exception.UnauthorizedException;
import com.kiyuziyu.api.security.AdminSecurityInterceptor;
import com.kiyuziyu.api.security.ApiKeyInterceptor;
import com.kiyuziyu.api.security.FirebaseAuthenticationService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AuthController.class)
@Import(GlobalExceptionHandler.class)
@AutoConfigureMockMvc(addFilters = false)
class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private FirebaseAuthenticationService firebaseAuthService;

    @MockBean
    private ApiKeyInterceptor apiKeyInterceptor;

    @MockBean
    private AdminSecurityInterceptor adminSecurityInterceptor;

    @Test
    void testGetMeWithoutHeaderReturnsUnauthorized() throws Exception {
        when(firebaseAuthService.verifyToken(null))
                .thenThrow(new UnauthorizedException("Authorization header is required (format: 'Bearer <Firebase ID Token>')"));

        mockMvc.perform(get("/api/v1/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Authorization header is required (format: 'Bearer <Firebase ID Token>')"));
    }

    @Test
    void testGetMeWithInvalidHeaderReturnsUnauthorized() throws Exception {
        when(firebaseAuthService.verifyToken("Basic 12345"))
                .thenThrow(new UnauthorizedException("Invalid Authorization format. Expected 'Bearer <Firebase ID Token>'"));

        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Basic 12345"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Invalid Authorization format. Expected 'Bearer <Firebase ID Token>'"));
    }

    @Test
    void testGetMeWithValidTokenReturnsUserIdentity() throws Exception {
        FirebaseToken mockToken = Mockito.mock(FirebaseToken.class);
        when(mockToken.getUid()).thenReturn("firebase_uid_test123");
        when(mockToken.getEmail()).thenReturn("test@kiyuziyu.com");
        when(mockToken.isEmailVerified()).thenReturn(true);
        when(mockToken.getName()).thenReturn("Test User");

        when(firebaseAuthService.verifyToken("Bearer valid_mock_token")).thenReturn(mockToken);

        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer valid_mock_token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.uid").value("firebase_uid_test123"))
                .andExpect(jsonPath("$.email").value("test@kiyuziyu.com"))
                .andExpect(jsonPath("$.emailVerified").value(true))
                .andExpect(jsonPath("$.name").value("Test User"));
    }
}
