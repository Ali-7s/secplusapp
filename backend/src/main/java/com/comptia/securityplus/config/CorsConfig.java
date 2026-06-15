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

    // Default to localhost dev origins — never silently fall back to "*".
    @Value("${cors.allowed-origins:http://localhost:4200,http://localhost}")
    private String allowedOrigins;

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();

        List<String> origins = Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();

        if (origins.contains("*")) {
            // Reflecting any origin AND allowing credentials is an OWASP misconfiguration.
            // Auth here is a Bearer token (not cookies), so disable credentials when wildcard.
            config.addAllowedOriginPattern("*");
            config.setAllowCredentials(false);
        } else {
            origins.forEach(config::addAllowedOrigin);
            config.setAllowCredentials(true);
        }

        config.addAllowedHeader("*");
        config.addAllowedMethod("*");
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
