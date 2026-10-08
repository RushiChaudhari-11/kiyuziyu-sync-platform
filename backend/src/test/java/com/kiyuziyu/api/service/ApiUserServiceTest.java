package com.kiyuziyu.api.service;

import com.google.cloud.Timestamp;
import com.google.firebase.auth.FirebaseToken;
import com.kiyuziyu.api.dto.user.UserResponse;
import com.kiyuziyu.api.exception.ConflictException;
import com.kiyuziyu.api.exception.NotFoundException;
import com.kiyuziyu.api.model.ApiUser;
import com.kiyuziyu.api.model.UserRole;
import com.kiyuziyu.api.model.UserStatus;
import com.kiyuziyu.api.repository.ApiUserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.concurrent.ExecutionException;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ApiUserServiceTest {

    @Mock
    private ApiUserRepository apiUserRepository;

    @InjectMocks
    private ApiUserService apiUserService;

    @Test
    void testGetCurrentUserFound() throws ExecutionException, InterruptedException {
        FirebaseToken mockToken = Mockito.mock(FirebaseToken.class);
        when(mockToken.getUid()).thenReturn("firebase_uid_123");

        ApiUser existing = new ApiUser();
        existing.setUid("firebase_uid_123");
        existing.setEmail("test@kiyuziyu.com");
        existing.setEmailVerified(false);
        existing.setRole("OWNER");
        existing.setStatus("ACTIVE");
        existing.setCreatedAt(Timestamp.now());
        existing.setUpdatedAt(Timestamp.now());

        when(apiUserRepository.findById("firebase_uid_123")).thenReturn(existing);

        UserResponse response = apiUserService.getCurrentUser(mockToken);

        assertNotNull(response);
        assertEquals("firebase_uid_123", response.getUid());
        assertEquals("test@kiyuziyu.com", response.getEmail());
        assertEquals("OWNER", response.getRole());
        assertEquals("ACTIVE", response.getStatus());
        assertFalse(response.getEmailVerified());
    }

    @Test
    void testGetCurrentUserNotFoundThrows404() throws ExecutionException, InterruptedException {
        FirebaseToken mockToken = Mockito.mock(FirebaseToken.class);
        when(mockToken.getUid()).thenReturn("not_found_uid");

        when(apiUserRepository.findById("not_found_uid")).thenReturn(null);

        assertThrows(NotFoundException.class, () -> apiUserService.getCurrentUser(mockToken));
    }

    @Test
    void testCreateCurrentUserSuccessAndVerifyDataRules() throws ExecutionException, InterruptedException {
        FirebaseToken mockToken = Mockito.mock(FirebaseToken.class);
        when(mockToken.getUid()).thenReturn("new_firebase_uid");
        when(mockToken.getEmail()).thenReturn("test@kiyuziyu.com");
        when(mockToken.isEmailVerified()).thenReturn(true);
        when(mockToken.getName()).thenReturn("Test Owner");

        when(apiUserRepository.existsById("new_firebase_uid")).thenReturn(false);

        UserResponse response = apiUserService.createCurrentUser(mockToken);

        // Capture saved entity to verify data rules
        ArgumentCaptor<ApiUser> captor = ArgumentCaptor.forClass(ApiUser.class);
        verify(apiUserRepository, times(1)).save(captor.capture());

        ApiUser saved = captor.getValue();

        // 1. Document ID MUST be Firebase UID
        assertEquals("new_firebase_uid", saved.getUid());
        assertEquals("test@kiyuziyu.com", saved.getEmail());
        assertTrue(saved.getEmailVerified());
        assertEquals("Test Owner", saved.getName());

        // 2. Default role = OWNER
        assertEquals(UserRole.OWNER.name(), saved.getRole());

        // 3. Default status = ACTIVE
        assertEquals(UserStatus.ACTIVE.name(), saved.getStatus());

        // 4. Timestamps populated
        assertNotNull(saved.getCreatedAt());
        assertNotNull(saved.getUpdatedAt());

        // Response matches
        assertNotNull(response);
        assertEquals("new_firebase_uid", response.getUid());
        assertEquals("OWNER", response.getRole());
        assertEquals("ACTIVE", response.getStatus());
    }

    @Test
    void testCreateCurrentUserAlreadyExistsThrowsConflict() throws ExecutionException, InterruptedException {
        FirebaseToken mockToken = Mockito.mock(FirebaseToken.class);
        when(mockToken.getUid()).thenReturn("already_exists_uid");

        when(apiUserRepository.existsById("already_exists_uid")).thenReturn(true);

        assertThrows(ConflictException.class, () -> apiUserService.createCurrentUser(mockToken));
        verify(apiUserRepository, never()).save(any());
    }
}
