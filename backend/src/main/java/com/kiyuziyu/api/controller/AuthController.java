package com.kiyuziyu.api.controller;

import com.google.firebase.auth.FirebaseToken;
import com.kiyuziyu.api.security.FirebaseAuthenticationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private static final Logger log = LoggerFactory.getLogger(AuthController.class);

    @Autowired
    private FirebaseAuthenticationService firebaseAuthService;

    /**
     * Endpoint to verify Firebase ID Token and return authenticated user identity.
     * Required header: Authorization: Bearer <Firebase ID Token>
     */
    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> getCurrentUser(
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        
        FirebaseToken token = firebaseAuthService.verifyToken(authHeader);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("uid", token.getUid());
        response.put("email", token.getEmail());
        response.put("emailVerified", token.isEmailVerified());
        if (token.getName() != null) {
            response.put("name", token.getName());
        }

        log.info("[AuthController] GET /api/v1/auth/me -> Authenticated as UID={}, Email={}", token.getUid(), token.getEmail());
        return ResponseEntity.ok(response);
    }
}
