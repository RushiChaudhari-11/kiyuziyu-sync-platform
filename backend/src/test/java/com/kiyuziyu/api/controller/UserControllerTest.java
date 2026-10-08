package com.kiyuziyu.api.controller;

import com.google.firebase.auth.FirebaseToken;
import com.kiyuziyu.api.dto.user.UserResponse;
import com.kiyuziyu.api.exception.ConflictException;
import com.kiyuziyu.api.exception.GlobalExceptionHandler;
import com.kiyuziyu.api.exception.NotFoundException;
import com.kiyuziyu.api.exception.UnauthorizedException;
import com.kiyuziyu.api.security.AdminSecurityInterceptor;
import com.kiyuziyu.api.security.ApiKeyInterceptor;
import com.kiyuziyu.api.security.FirebaseAuthenticationService;
import com.kiyuziyu.api.service.ApiUserService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(UserController.class)
@Import(GlobalExceptionHandler.class)
@AutoConfigureMockMvc(addFilters = false)
class UserControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private FirebaseAuthenticationService firebaseAuthService;

    @MockBean
    private ApiUserService apiUserService;

    @MockBean
    private ApiKeyInterceptor apiKeyInterceptor;

    @MockBean
    private AdminSecurityInterceptor adminSecurityInterceptor;

    @Test
    void testGetMeWithoutAuthorizationReturnsUnauthorized() throws Exception {
        when(firebaseAuthService.verifyToken(null))
                .thenThrow(new UnauthorizedException("Authorization header is required (format: 'Bearer <Firebase ID Token>')"));

        mockMvc.perform(get("/api/v1/users/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Authorization header is required (format: 'Bearer <Firebase ID Token>')"));
    }

    @Test
    void testGetMeWithInvalidBearerTokenReturnsUnauthorized() throws Exception {
        when(firebaseAuthService.verifyToken("Bearer invalid_token"))
                .thenThrow(new UnauthorizedException("Invalid or expired Firebase ID token"));

        mockMvc.perform(get("/api/v1/users/me")
                        .header("Authorization", "Bearer invalid_token"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    void testGetMeWhenUserDoesNotExistReturnsNotFound() throws Exception {
        FirebaseToken mockToken = Mockito.mock(FirebaseToken.class);
        when(firebaseAuthService.verifyToken("Bearer valid_token")).thenReturn(mockToken);
        when(apiUserService.getCurrentUser(mockToken))
                .thenThrow(new NotFoundException("User profile not found for UID: user_123"));

        mockMvc.perform(get("/api/v1/users/me")
                        .header("Authorization", "Bearer valid_token"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("User profile not found for UID: user_123"));
    }

    @Test
    void testGetMeWithExistingUserReturns200() throws Exception {
        FirebaseToken mockToken = Mockito.mock(FirebaseToken.class);
        when(firebaseAuthService.verifyToken("Bearer valid_token")).thenReturn(mockToken);

        UserResponse mockResponse = new UserResponse();
        mockResponse.setUid("user_123");
        mockResponse.setEmail("test@kiyuziyu.com");
        mockResponse.setEmailVerified(true);
        mockResponse.setRole("OWNER");
        mockResponse.setStatus("ACTIVE");
        mockResponse.setCreatedAt("2026-09-22T10:00:00Z");
        mockResponse.setUpdatedAt("2026-09-22T10:00:00Z");

        when(apiUserService.getCurrentUser(mockToken)).thenReturn(mockResponse);

        mockMvc.perform(get("/api/v1/users/me")
                        .header("Authorization", "Bearer valid_token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.uid").value("user_123"))
                .andExpect(jsonPath("$.data.email").value("test@kiyuziyu.com"))
                .andExpect(jsonPath("$.data.role").value("OWNER"))
                .andExpect(jsonPath("$.data.status").value("ACTIVE"));
    }

    @Test
    void testCreateMeSuccessReturns201() throws Exception {
        FirebaseToken mockToken = Mockito.mock(FirebaseToken.class);
        when(firebaseAuthService.verifyToken("Bearer valid_token")).thenReturn(mockToken);

        UserResponse mockCreated = new UserResponse();
        mockCreated.setUid("user_new_456");
        mockCreated.setEmail("test@kiyuziyu.com");
        mockCreated.setEmailVerified(false);
        mockCreated.setRole("OWNER");
        mockCreated.setStatus("ACTIVE");
        mockCreated.setCreatedAt("2026-09-22T10:00:00Z");
        mockCreated.setUpdatedAt("2026-09-22T10:00:00Z");

        when(apiUserService.createCurrentUser(mockToken)).thenReturn(mockCreated);

        mockMvc.perform(post("/api/v1/users/me")
                        .header("Authorization", "Bearer valid_token"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.uid").value("user_new_456"))
                .andExpect(jsonPath("$.data.email").value("test@kiyuziyu.com"))
                .andExpect(jsonPath("$.data.role").value("OWNER"))
                .andExpect(jsonPath("$.data.status").value("ACTIVE"));
    }

    @Test
    void testCreateMeWhenAlreadyExistsReturns409() throws Exception {
        FirebaseToken mockToken = Mockito.mock(FirebaseToken.class);
        when(firebaseAuthService.verifyToken("Bearer valid_token")).thenReturn(mockToken);
        when(apiUserService.createCurrentUser(mockToken))
                .thenThrow(new ConflictException("User profile already exists for UID: user_existing"));

        mockMvc.perform(post("/api/v1/users/me")
                        .header("Authorization", "Bearer valid_token"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("User profile already exists for UID: user_existing"));
    }
}
