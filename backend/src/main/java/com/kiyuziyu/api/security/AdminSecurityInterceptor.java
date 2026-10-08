package com.kiyuziyu.api.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
public class AdminSecurityInterceptor implements HandlerInterceptor {

    @Value("${KIYUZIYU_ADMIN_TOKEN:}")
    private String adminToken;

    public void setAdminToken(String adminToken) {
        this.adminToken = adminToken;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        if (adminToken == null || adminToken.trim().isEmpty()) {
            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
            response.getWriter().write("Forbidden: Admin token is not configured on server");
            return false;
        }

        String token = request.getHeader("X-Admin-Token");
        if (token == null || token.trim().isEmpty() || !adminToken.equals(token)) {
            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
            response.getWriter().write("Forbidden: Invalid Admin Token");
            return false;
        }

        return true;
    }
}

