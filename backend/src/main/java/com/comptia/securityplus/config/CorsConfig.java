package com.comptia.securityplus.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

@Configuration
public class CorsConfig {

    // Default: any localhost port (dev servers move between 4200/4201/...). Same-origin
    // POSTs still carry an Origin header, so an exact-port default breaks local dev.
    // Production sets CORS_ORIGINS to the real frontend origin(s) — never "*".
    @Value("${cors.allowed-origins:http://localhost:[*],http://127.0.0.1:[*]}")
    private String allowedOrigins;

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();

        List<String> origins = Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();

        config.setAllowCredentials(true);
        for (String origin : origins) {
            if (origin.equals("*")) {
                // Reflecting any origin AND allowing credentials is an OWASP misconfiguration.
                // Auth here is a Bearer token (not cookies), so drop credentials for a true wildcard.
                config.addAllowedOriginPattern("*");
                config.setAllowCredentials(false);
            } else if (origin.contains("*")) {
                config.addAllowedOriginPattern(origin);   // e.g. http://localhost:[*]
            } else {
                config.addAllowedOrigin(origin);
            }
        }

        config.addAllowedHeader("*");
        config.addAllowedMethod("*");
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
