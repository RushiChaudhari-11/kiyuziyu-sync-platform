package com.kiyuziyu.api.security;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseToken;
import com.kiyuziyu.api.exception.UnauthorizedException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class FirebaseAuthenticationService {

    private static final Logger log = LoggerFactory.getLogger(FirebaseAuthenticationService.class);
    private static final String BEARER_PREFIX = "Bearer ";

    /**
     * Verifies the Firebase ID token from the Authorization header using Firebase Admin SDK.
     *
     * @param authHeader The Authorization HTTP header (expected format: 'Bearer <idToken>')
     * @return FirebaseToken containing decoded UID, email, and claims
     * @throws UnauthorizedException if header is missing, malformed, expired, or invalid
     */
    public FirebaseToken verifyToken(String authHeader) {
        if (authHeader == null || authHeader.trim().isEmpty()) {
            throw new UnauthorizedException("Authorization header is required (format: 'Bearer <Firebase ID Token>')");
        }

        if (!authHeader.startsWith(BEARER_PREFIX)) {
            throw new UnauthorizedException("Invalid Authorization format. Expected 'Bearer <Firebase ID Token>'");
        }

        String idToken = authHeader.substring(BEARER_PREFIX.length()).trim();
        if (idToken.isEmpty()) {
            throw new UnauthorizedException("Firebase ID token cannot be empty");
        }

        try {
            // Official Firebase Admin SDK verification
            FirebaseToken decodedToken = FirebaseAuth.getInstance().verifyIdToken(idToken);
            log.info("[FirebaseAuthenticationService] Firebase ID token verified successfully: UID={}, Email={}",
                    decodedToken.getUid(), decodedToken.getEmail());
            return decodedToken;
        } catch (FirebaseAuthException e) {
            log.warn("[FirebaseAuthenticationService] Firebase ID token verification failed: code={}, message={}",
                    e.getAuthErrorCode(), e.getMessage());
            throw new UnauthorizedException("Invalid or expired Firebase ID token: " + e.getMessage());
        } catch (Exception e) {
            log.error("[FirebaseAuthenticationService] Unexpected error verifying Firebase ID token: {}", e.getMessage());
            throw new UnauthorizedException("Authentication failed: " + e.getMessage());
        }
    }
}
