package com.comptia.securityplus.controller;

import com.comptia.securityplus.model.*;
import com.comptia.securityplus.security.AuthenticatedUser;
import com.comptia.securityplus.service.ContentService;
import com.comptia.securityplus.service.ProgressService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/content")
public class ContentController {

    private final ContentService contentService;
    private final ProgressService progressService;

    public ContentController(ContentService contentService, ProgressService progressService) {
        this.contentService = contentService;
        this.progressService = progressService;
    }

    // ── Read ──────────────────────────────────────────────────────────────────

    @GetMapping("/explain/{sectionId}")
    public ResponseEntity<ConceptExplanation> getExplanation(
            @PathVariable String sectionId,
            @AuthenticationPrincipal AuthenticatedUser user) {
        ConceptExplanation explanation = contentService.getExplanation(sectionId);
        progressService.markConceptRead(user.getUserId(), sectionId);
        return ResponseEntity.ok(explanation);
    }

    @GetMapping("/flashcards/{sectionId}")
    public ResponseEntity<List<Flashcard>> getFlashcards(@PathVariable String sectionId) {
        return ResponseEntity.ok(contentService.getFlashcards(sectionId));
    }

    @PostMapping("/flashcards/{sectionId}/progress")
    public ResponseEntity<Void> updateFlashcardProgress(
            @PathVariable String sectionId,
            @RequestBody Map<String, Integer> body,
            @AuthenticationPrincipal AuthenticatedUser user) {
        progressService.updateFlashcardsReviewed(user.getUserId(), sectionId, body.getOrDefault("reviewed", 0));
        return ResponseEntity.ok().build();
    }

    @GetMapping("/questions/{sectionId}")
    public ResponseEntity<List<Question>> getPracticeQuestions(
        @PathVariable String sectionId,
        @RequestParam(defaultValue = "10") int count
    ) {
        return ResponseEntity.ok(contentService.getPracticeQuestions(sectionId, count));
    }

    @GetMapping("/exam/full")
    public ResponseEntity<List<Question>> getFullExam() {
        return ResponseEntity.ok(contentService.getFullPracticeExam());
    }

    @GetMapping("/exam/{sectionId}")
    public ResponseEntity<List<Question>> getSectionExam(@PathVariable String sectionId) {
        return ResponseEntity.ok(contentService.getSectionExamQuestions(sectionId));
    }

    @GetMapping("/lab/{sectionId}")
    public ResponseEntity<Lab> getLab(@PathVariable String sectionId) {
        return ResponseEntity.ok(contentService.getLab(sectionId));
    }

    @PostMapping("/lab/{sectionId}/complete")
    public ResponseEntity<Void> completeLab(
            @PathVariable String sectionId,
            @AuthenticationPrincipal AuthenticatedUser user) {
        progressService.markLabCompleted(user.getUserId(), sectionId);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/acronyms")
    public ResponseEntity<List<Acronym>> getAcronyms() {
        return ResponseEntity.ok(contentService.getAcronyms());
    }

    // ── Regenerate (evict DB entry then re-generate) ──────────────────────────

    @PostMapping("/explain/{sectionId}/regenerate")
    public ResponseEntity<ConceptExplanation> regenerateExplanation(
            @PathVariable String sectionId,
            @AuthenticationPrincipal AuthenticatedUser user) {
        contentService.evict("explanation:" + sectionId);
        ConceptExplanation result = contentService.getExplanation(sectionId);
        progressService.markConceptRead(user.getUserId(), sectionId);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/flashcards/{sectionId}/regenerate")
    public ResponseEntity<List<Flashcard>> regenerateFlashcards(@PathVariable String sectionId) {
        contentService.evict("flashcards:" + sectionId);
        return ResponseEntity.ok(contentService.getFlashcards(sectionId));
    }

    @PostMapping("/questions/{sectionId}/regenerate")
    public ResponseEntity<List<Question>> regenerateQuestions(
        @PathVariable String sectionId,
        @RequestParam(defaultValue = "10") int count
    ) {
        contentService.evict("questions:" + sectionId);
        return ResponseEntity.ok(contentService.getPracticeQuestions(sectionId, count));
    }

    @PostMapping("/exam/full/regenerate")
    public ResponseEntity<List<Question>> regenerateFullExam() {
        contentService.evict("fullExam:all");
        return ResponseEntity.ok(contentService.getFullPracticeExam());
    }

    @PostMapping("/exam/{sectionId}/regenerate")
    public ResponseEntity<List<Question>> regenerateSectionExam(@PathVariable String sectionId) {
        contentService.evict("sectionExam:" + sectionId);
        return ResponseEntity.ok(contentService.getSectionExamQuestions(sectionId));
    }

    @PostMapping("/lab/{sectionId}/regenerate")
    public ResponseEntity<Lab> regenerateLab(@PathVariable String sectionId) {
        contentService.evict("lab:" + sectionId);
        return ResponseEntity.ok(contentService.getLab(sectionId));
    }

    @PostMapping("/acronyms/regenerate")
    public ResponseEntity<List<Acronym>> regenerateAcronyms() {
        contentService.evict("acronyms:all");
        return ResponseEntity.ok(contentService.getAcronyms());
    }
}
