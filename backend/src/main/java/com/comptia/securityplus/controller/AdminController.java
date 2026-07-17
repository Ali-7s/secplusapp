package com.comptia.securityplus.controller;

import com.comptia.securityplus.entity.ProgressEntity;
import com.comptia.securityplus.entity.UserEntity;
import com.comptia.securityplus.model.admin.ProgressUpdateRequest;
import com.comptia.securityplus.model.admin.UserSummary;
import com.comptia.securityplus.repository.UserRepository;
import com.comptia.securityplus.security.AuthenticatedUser;
import com.comptia.securityplus.service.ContentService;
import com.comptia.securityplus.service.ProgressService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {

    private final UserRepository userRepository;
    private final ProgressService progressService;
    private final ContentService contentService;

    public AdminController(UserRepository userRepository, ProgressService progressService,
                           ContentService contentService) {
        this.userRepository = userRepository;
        this.progressService = progressService;
        this.contentService = contentService;
    }

    /** How much of the content library is generated (total/cached/missing/generating). */
    @GetMapping("/warmup")
    public ResponseEntity<Map<String, Object>> warmupStatus() {
        return ResponseEntity.ok(contentService.warmupStatus());
    }

    /** Enqueue background generation for everything missing. Safe to call repeatedly. */
    @PostMapping("/warmup")
    public ResponseEntity<Map<String, Object>> startWarmup() {
        int enqueued = contentService.startWarmup();
        return ResponseEntity.ok(Map.of("enqueued", enqueued));
    }

    @GetMapping("/users")
    public ResponseEntity<List<UserSummary>> listUsers() {
        List<UserSummary> users = userRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(user -> {
                    Map<String, Object> summary = progressService.getSummary(user.getId());
                    return new UserSummary(
                            user.getId(), user.getEmail(), user.getRole().name(),
                            user.isEnabled(), user.getCreatedAt(), user.getLastLogin(), summary);
                })
                .toList();
        return ResponseEntity.ok(users);
    }

    @GetMapping("/users/{userId}/progress")
    public ResponseEntity<List<ProgressEntity>> getUserProgress(@PathVariable Long userId) {
        return ResponseEntity.ok(progressService.getAllProgress(userId));
    }

    @PutMapping("/users/{userId}/progress/{sectionId}")
    public ResponseEntity<ProgressEntity> updateUserProgress(
            @PathVariable Long userId,
            @PathVariable String sectionId,
            @RequestBody ProgressUpdateRequest request) {
        return ResponseEntity.ok(progressService.adminUpdateProgress(userId, sectionId, request));
    }

    @PutMapping("/users/{userId}/enabled")
    public ResponseEntity<Void> setEnabled(
            @PathVariable Long userId,
            @RequestBody Map<String, Boolean> body,
            @AuthenticationPrincipal AuthenticatedUser admin) {
        if (userId.equals(admin.getUserId())) {
            return ResponseEntity.badRequest().build();
        }
        UserEntity user = userRepository.findById(userId).orElseThrow();
        user.setEnabled(body.getOrDefault("enabled", true));
        userRepository.save(user);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/users/{userId}")
    @Transactional
    public ResponseEntity<Void> deleteUser(
            @PathVariable Long userId,
            @AuthenticationPrincipal AuthenticatedUser admin) {
        if (userId.equals(admin.getUserId())) {
            return ResponseEntity.badRequest().build();
        }
        userRepository.deleteById(userId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getStats() {
        long totalUsers = userRepository.count();
        long enabledUsers = userRepository.findAll().stream().filter(UserEntity::isEnabled).count();
        return ResponseEntity.ok(Map.of(
                "totalUsers", totalUsers,
                "enabledUsers", enabledUsers
        ));
    }
}
