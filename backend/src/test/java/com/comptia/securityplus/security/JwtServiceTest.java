package com.comptia.securityplus.security;

import com.comptia.securityplus.entity.UserEntity;
import io.jsonwebtoken.Claims;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JwtServiceTest {

    private static final String GOOD_SECRET = "a-strong-test-secret-at-least-32-bytes-long-xxxxx";

    private UserEntity user() {
        UserEntity u = new UserEntity("alice@example.com", "hash", UserEntity.Role.USER);
        u.setId(42L);
        return u;
    }

    @Test
    void rejectsShortSecret() {
        assertThatThrownBy(() -> new JwtService("too-short", 3600000))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("32");
    }

    @Test
    void rejectsNullSecret() {
        assertThatThrownBy(() -> new JwtService(null, 3600000))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void generatesAndVerifiesToken() {
        JwtService jwt = new JwtService(GOOD_SECRET, 3600000);
        String token = jwt.generateToken(user());

        assertThat(jwt.isValid(token)).isTrue();
        Claims claims = jwt.extractAllClaims(token);
        assertThat(claims.getSubject()).isEqualTo("alice@example.com");
        assertThat(claims.get("userId", Long.class)).isEqualTo(42L);
        assertThat(claims.get("role", String.class)).isEqualTo("USER");
    }

    @Test
    void rejectsTamperedToken() {
        JwtService jwt = new JwtService(GOOD_SECRET, 3600000);
        String token = jwt.generateToken(user());
        String tampered = token.substring(0, token.length() - 3) + "abc";
        assertThat(jwt.isValid(tampered)).isFalse();
    }

    @Test
    void rejectsExpiredToken() throws Exception {
        JwtService jwt = new JwtService(GOOD_SECRET, 1);   // 1ms expiry
        String token = jwt.generateToken(user());
        Thread.sleep(5);
        assertThat(jwt.isValid(token)).isFalse();
    }

    @Test
    void tokenFromOneSecretIsRejectedByAnother() {
        String token = new JwtService(GOOD_SECRET, 3600000).generateToken(user());
        JwtService other = new JwtService("a-completely-different-secret-key-32-bytes-min!!", 3600000);
        assertThat(other.isValid(token)).isFalse();
    }
}
