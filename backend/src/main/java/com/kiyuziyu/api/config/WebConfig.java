package com.kiyuziyu.api.config;

import com.kiyuziyu.api.security.ApiKeyInterceptor;
import com.kiyuziyu.api.security.AdminSecurityInterceptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.Arrays;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Value("${KIYUZIYU_ALLOWED_ORIGINS:http://localhost:3000,http://localhost:5173}")
    private String allowedOrigins;

    @Autowired
    private ApiKeyInterceptor apiKeyInterceptor;

    @Autowired
    private AdminSecurityInterceptor adminSecurityInterceptor;

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        if (allowedOrigins != null && !allowedOrigins.trim().isEmpty()) {
            String[] origins = Arrays.stream(allowedOrigins.split(","))
                    .map(String::trim)
                    .filter(s -> !s.isEmpty())
                    .toArray(String[]::new);

            if (origins.length > 0) {
                registry.addMapping("/api/**")
                        .allowedOrigins(origins)
                        .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
                        .allowedHeaders("*")
                        .allowCredentials(false);
            }
        }
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        // Protect external product APIs
        registry.addInterceptor(apiKeyInterceptor)
                .addPathPatterns("/api/v1/products/**", "/api/v1/orders/**", "/api/v1/integrations/shopify/products/**", "/api/v1/integrations/shopify/products/bulk-sync")
                .excludePathPatterns("/api/v1/internal/**", "/api/v1/auth/**", "/api/v1/users/**", "/api/v1/tenants/**", "/actuator/**");
                
        // Protect internal Admin APIs
        registry.addInterceptor(adminSecurityInterceptor)
                .addPathPatterns("/api/v1/internal/admin/**");
    }
}

