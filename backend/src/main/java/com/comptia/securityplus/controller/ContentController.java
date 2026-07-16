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
    public ResponseEntity<?> getExplanation(
            @PathVariable String sectionId,
            @AuthenticationPrincipal AuthenticatedUser user) {
        ContentService.AsyncContent<ConceptExplanation> r = contentService.getExplanationAsync(sectionId);
        if (r.status() == ContentService.GenStatus.READY) {
            progressService.markConceptRead(user.getUserId(), sectionId);
        }
        return asyncResponse(r);
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
    public ResponseEntity<?> getFullExam() {
        return examResponse(contentService.getFullExamAsync());
    }

    @GetMapping("/exam/{sectionId}")
    public ResponseEntity<?> getSectionExam(@PathVariable String sectionId) {
        return examResponse(contentService.getSectionExamAsync(sectionId));
    }

    @GetMapping("/exam/domain/{domainId}")
    public ResponseEntity<?> getDomainExam(@PathVariable String domainId) {
        return examResponse(contentService.getDomainExamAsync(domainId));
    }

    @PostMapping("/exam/domain/{domainId}/regenerate")
    public ResponseEntity<?> regenerateDomainExam(@PathVariable String domainId) {
        contentService.evict("domainExam2:" + domainId);
        return examResponse(contentService.getDomainExamAsync(domainId));
    }

    /**
     * Map an async-generation result to HTTP: 200 with the content when ready,
     * 202 while generating (client polls), 502 if the last attempt failed.
     */
    private ResponseEntity<?> asyncResponse(ContentService.AsyncContent<?> r) {
        return switch (r.status()) {
            case READY -> ResponseEntity.ok(r.data());
            case GENERATING -> ResponseEntity.accepted().body(Map.of("status", "generating"));
            case ERROR -> ResponseEntity.status(502)
                    .body(Map.of("message", r.error() != null ? r.error() : "Generation failed"));
        };
    }

    private ResponseEntity<?> examResponse(ContentService.AsyncContent<List<Question>> r) {
        return asyncResponse(r);
    }

    @PostMapping("/simplify")
    public ResponseEntity<Map<String, String>> simplify(@RequestBody Map<String, String> body) {
        String simplified = contentService.simplifyText(body.getOrDefault("text", ""));
        return ResponseEntity.ok(Map.of("simplified", simplified));
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

    @GetMapping("/acronyms/{acronym}/detail")
    public ResponseEntity<AcronymDetail> getAcronymDetail(
            @PathVariable String acronym,
            @RequestParam(required = false, defaultValue = "") String expansion) {
        return ResponseEntity.ok(contentService.getAcronymDetail(acronym, expansion));
    }

    @GetMapping("/terms")
    public ResponseEntity<List<Term>> getTerms() {
        return ResponseEntity.ok(contentService.getTerms());
    }

    @GetMapping("/terms/{term}/detail")
    public ResponseEntity<AcronymDetail> getTermDetail(
            @PathVariable String term,
            @RequestParam(required = false, defaultValue = "") String definition) {
        return ResponseEntity.ok(contentService.getTermDetail(term, definition));
    }

    @PostMapping("/terms/regenerate")
    public ResponseEntity<List<Term>> regenerateTerms() {
        contentService.evict("terms:all");
        return ResponseEntity.ok(contentService.getTerms());
    }

    @PostMapping("/terms/generate-missing")
    public ResponseEntity<List<Term>> generateMissingTerms(@RequestBody List<String> termNames) {
        return ResponseEntity.ok(contentService.generateMissingTerms(termNames));
    }

    // ── Regenerate (evict DB entry then re-generate) ──────────────────────────

    @PostMapping("/explain/{sectionId}/regenerate")
    public ResponseEntity<?> regenerateExplanation(@PathVariable String sectionId) {
        contentService.evict("explanation2:" + sectionId);
        return asyncResponse(contentService.getExplanationAsync(sectionId));
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
    public ResponseEntity<?> regenerateFullExam() {
        contentService.evict("fullExam:v3");
        return examResponse(contentService.getFullExamAsync());
    }

    @PostMapping("/exam/{sectionId}/regenerate")
    public ResponseEntity<?> regenerateSectionExam(@PathVariable String sectionId) {
        contentService.evict("sectionExam:" + sectionId);
        return examResponse(contentService.getSectionExamAsync(sectionId));
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
