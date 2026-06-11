package com.comptia.securityplus.controller;

import com.comptia.securityplus.entity.ProgressEntity;
import com.comptia.securityplus.security.AuthenticatedUser;
import com.comptia.securityplus.service.ProgressService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/progress")
public class ProgressController {

    private final ProgressService progressService;

    public ProgressController(ProgressService progressService) {
        this.progressService = progressService;
    }

    @GetMapping
    public ResponseEntity<List<ProgressEntity>> getAllProgress(
            @AuthenticationPrincipal AuthenticatedUser user) {
        return ResponseEntity.ok(progressService.getAllProgress(user.getUserId()));
    }

    @GetMapping("/summary")
    public ResponseEntity<Map<String, Object>> getSummary(
            @AuthenticationPrincipal AuthenticatedUser user) {
        return ResponseEntity.ok(progressService.getSummary(user.getUserId()));
    }

    @GetMapping("/{sectionId}")
    public ResponseEntity<ProgressEntity> getProgress(
            @PathVariable String sectionId,
            @AuthenticationPrincipal AuthenticatedUser user) {
        return ResponseEntity.ok(progressService.getProgress(user.getUserId(), sectionId));
    }

    @PostMapping("/{sectionId}/practice")
    public ResponseEntity<Void> updatePractice(
            @PathVariable String sectionId,
            @RequestBody Map<String, Integer> body,
            @AuthenticationPrincipal AuthenticatedUser user) {
        progressService.updatePracticeAnswered(
                user.getUserId(), sectionId,
                body.getOrDefault("answered", 0),
                body.getOrDefault("correct", 0));
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{sectionId}/reset")
    public ResponseEntity<Void> resetSection(
            @PathVariable String sectionId,
            @AuthenticationPrincipal AuthenticatedUser user) {
        progressService.resetSection(user.getUserId(), sectionId);
        return ResponseEntity.ok().build();
    }
}
