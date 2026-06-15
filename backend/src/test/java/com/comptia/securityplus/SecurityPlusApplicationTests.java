package com.comptia.securityplus;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

/** Smoke test: the full Spring context wires up (security config, JWT, CORS, JPA) under the test profile. */
@SpringBootTest
class SecurityPlusApplicationTests {

    @Test
    void contextLoads() {
        // Fails if any bean (including the hardened JwtService / CorsConfig) can't be constructed.
    }
}
