package com.kiyuziyu.api.controller;

import com.google.firebase.auth.FirebaseToken;
import com.kiyuziyu.api.dto.user.UpdateUserRequest;
import com.kiyuziyu.api.dto.user.UserResponse;
import com.kiyuziyu.api.security.FirebaseAuthenticationService;
import com.kiyuziyu.api.service.ApiUserService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ExecutionException;

@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    private static final Logger log = LoggerFactory.getLogger(UserController.class);

    @Autowired
    private FirebaseAuthenticationService firebaseAuthService;

    @Autowired
    private ApiUserService apiUserService;

    /**
     * Get the apiUsers profile for the currently authenticated Firebase user.
     * Header: Authorization: Bearer <Firebase ID Token>
     */
    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> getCurrentUser(
            @RequestHeader(value = "Authorization", required = false) String authHeader)
            throws ExecutionException, InterruptedException {
        FirebaseToken token = firebaseAuthService.verifyToken(authHeader);
        UserResponse user = apiUserService.getCurrentUser(token);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", user);
        return ResponseEntity.ok(response);
    }

    /**
     * Create the apiUsers profile for the currently authenticated Firebase user.
     * Header: Authorization: Bearer <Firebase ID Token>
     */
    @PostMapping("/me")
    public ResponseEntity<Map<String, Object>> createCurrentUser(
            @RequestHeader(value = "Authorization", required = false) String authHeader)
            throws ExecutionException, InterruptedException {
        FirebaseToken token = firebaseAuthService.verifyToken(authHeader);
        UserResponse created = apiUserService.createCurrentUser(token);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", created);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * Update allowed fields of the apiUsers profile for the currently authenticated Firebase user.
     * Header: Authorization: Bearer <Firebase ID Token>
     */
    @PatchMapping("/me")
    public ResponseEntity<Map<String, Object>> updateCurrentUser(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody(required = false) UpdateUserRequest request)
            throws ExecutionException, InterruptedException {
        FirebaseToken token = firebaseAuthService.verifyToken(authHeader);
        UserResponse updated = apiUserService.updateCurrentUser(token, request);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", updated);
        return ResponseEntity.ok(response);
    }
}
