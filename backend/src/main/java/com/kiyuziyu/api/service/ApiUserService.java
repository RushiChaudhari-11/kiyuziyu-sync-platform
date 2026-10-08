package com.kiyuziyu.api.service;

import com.google.cloud.Timestamp;
import com.google.firebase.auth.FirebaseToken;
import com.kiyuziyu.api.dto.user.UpdateUserRequest;
import com.kiyuziyu.api.dto.user.UserResponse;
import com.kiyuziyu.api.exception.ConflictException;
import com.kiyuziyu.api.exception.NotFoundException;
import com.kiyuziyu.api.model.ApiUser;
import com.kiyuziyu.api.model.UserRole;
import com.kiyuziyu.api.model.UserStatus;
import com.kiyuziyu.api.repository.ApiUserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.concurrent.ExecutionException;

@Service
public class ApiUserService {

    private static final Logger log = LoggerFactory.getLogger(ApiUserService.class);

    @Autowired
    private ApiUserRepository apiUserRepository;

    public UserResponse getCurrentUser(FirebaseToken token) throws ExecutionException, InterruptedException {
        String uid = token.getUid();
        ApiUser user = apiUserRepository.findById(uid);
        if (user == null) {
            log.warn("[ApiUserService] apiUsers record not found for authenticated UID: {}", uid);
            throw new NotFoundException("User profile not found for UID: " + uid + ". Please create your profile via POST /api/v1/users/me");
        }
        return UserResponse.from(user);
    }

    public UserResponse createCurrentUser(FirebaseToken token) throws ExecutionException, InterruptedException {
        String uid = token.getUid();
        if (apiUserRepository.existsById(uid)) {
            log.warn("[ApiUserService] Cannot create: apiUsers record already exists for UID: {}", uid);
            throw new ConflictException("User profile already exists for UID: " + uid);
        }

        ApiUser newUser = new ApiUser();
        newUser.setUid(uid);
        newUser.setEmail(token.getEmail());
        newUser.setEmailVerified(token.isEmailVerified());
        newUser.setName(token.getName());
        newUser.setRole(UserRole.OWNER.name());
        newUser.setStatus(UserStatus.ACTIVE.name());
        newUser.setCreatedAt(Timestamp.now());
        newUser.setUpdatedAt(Timestamp.now());

        apiUserRepository.save(newUser);
        log.info("[ApiUserService] Created new apiUser record: UID={}, Email={}, Role={}, Status={}",
                uid, newUser.getEmail(), newUser.getRole(), newUser.getStatus());
        return UserResponse.from(newUser);
    }

    public UserResponse updateCurrentUser(FirebaseToken token, UpdateUserRequest request) throws ExecutionException, InterruptedException {
        String uid = token.getUid();
        ApiUser existing = apiUserRepository.findById(uid);
        if (existing == null) {
            throw new NotFoundException("User profile not found for UID: " + uid);
        }

        boolean changed = false;
        if (request != null) {
            if (request.getName() != null && !request.getName().trim().isEmpty()) {
                existing.setName(request.getName().trim());
                changed = true;
            }
            if (request.getEmailVerified() != null) {
                existing.setEmailVerified(request.getEmailVerified());
                changed = true;
            }
        }

        // Sync emailVerified status if verified in Firebase Auth token
        if (token.isEmailVerified() && !Boolean.TRUE.equals(existing.getEmailVerified())) {
            existing.setEmailVerified(true);
            changed = true;
        }

        if (changed) {
            existing.setUpdatedAt(Timestamp.now());
            apiUserRepository.save(existing);
            log.info("[ApiUserService] Updated apiUser record: UID={}", uid);
        }

        return UserResponse.from(existing);
    }
}
