package com.kiyuziyu.api.security;

import com.google.firebase.auth.FirebaseToken;
import com.kiyuziyu.api.model.ApiCredential;
import com.kiyuziyu.api.service.ApiClientService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
public class ApiKeyInterceptor implements HandlerInterceptor {

    @Autowired
    private ApiClientService apiClientService;

    @Autowired(required = false)
    private FirebaseAuthenticationService firebaseAuthService;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        // 1. Check Authorization header for Firebase ID token
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ") && firebaseAuthService != null) {
            try {
                FirebaseToken token = firebaseAuthService.verifyToken(authHeader);
                if (token != null) {
                    request.setAttribute("clientId", token.getUid());
                    return true;
                }
            } catch (Exception e) {
                // fall through to X-API-Key check
            }
        }

        // 2. Fall back to X-API-Key header
        String apiKey = request.getHeader("X-API-Key");
        
        if (apiKey == null || apiKey.isEmpty()) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.getWriter().write("Missing X-API-Key or Authorization header");
            return false;
        }

        ApiCredential cred = apiClientService.authenticate(apiKey);
        if (cred == null) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.getWriter().write("Invalid or Revoked API Key");
            return false;
        }

        // Authentication successful, store clientId in request
        request.setAttribute("clientId", cred.getClientId());
        return true;
    }
}

