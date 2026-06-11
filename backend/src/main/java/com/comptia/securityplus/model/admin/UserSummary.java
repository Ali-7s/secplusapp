package com.comptia.securityplus.model.admin;

import java.time.LocalDateTime;
import java.util.Map;

public class UserSummary {

    private Long id;
    private String email;
    private String role;
    private boolean enabled;
    private LocalDateTime createdAt;
    private LocalDateTime lastLogin;
    private Map<String, Object> progressSummary;

    public UserSummary(Long id, String email, String role, boolean enabled,
                       LocalDateTime createdAt, LocalDateTime lastLogin,
                       Map<String, Object> progressSummary) {
        this.id = id;
        this.email = email;
        this.role = role;
        this.enabled = enabled;
        this.createdAt = createdAt;
        this.lastLogin = lastLogin;
        this.progressSummary = progressSummary;
    }

    public Long getId() { return id; }
    public String getEmail() { return email; }
    public String getRole() { return role; }
    public boolean isEnabled() { return enabled; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getLastLogin() { return lastLogin; }
    public Map<String, Object> getProgressSummary() { return progressSummary; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
}
