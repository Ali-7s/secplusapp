package com.comptia.securityplus.controller;

import com.comptia.securityplus.entity.NoteEntity;
import com.comptia.securityplus.repository.NoteRepository;
import com.comptia.securityplus.security.AuthenticatedUser;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notes")
public class NoteController {

    private final NoteRepository repo;

    public NoteController(NoteRepository repo) {
        this.repo = repo;
    }

    /** All of the current user's notes, newest first (drives the Notes page). */
    @GetMapping
    public ResponseEntity<List<NoteEntity>> getAll(@AuthenticationPrincipal AuthenticatedUser user) {
        return ResponseEntity.ok(repo.findByUserIdOrderByCreatedAtDesc(user.getUserId()));
    }

    /** Notes for one section (drives inline highlights + the section's notes panel). */
    @GetMapping("/section/{sectionId}")
    public ResponseEntity<List<NoteEntity>> getForSection(
            @PathVariable String sectionId,
            @AuthenticationPrincipal AuthenticatedUser user) {
        return ResponseEntity.ok(repo.findByUserIdAndSectionIdOrderByCreatedAtDesc(user.getUserId(), sectionId));
    }

    @PostMapping
    public ResponseEntity<?> create(
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal AuthenticatedUser user) {
        String note = body.getOrDefault("note", "").trim();
        String sectionId = body.getOrDefault("sectionId", "").trim();
        if (note.isEmpty() || sectionId.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "note and sectionId are required"));
        }
        NoteEntity n = new NoteEntity();
        n.setUserId(user.getUserId());
        n.setSectionId(sectionId);
        n.setSectionName(body.get("sectionName"));
        n.setQuote(body.get("quote"));
        n.setNote(note);
        return ResponseEntity.status(HttpStatus.CREATED).body(repo.save(n));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @PathVariable Long id,
            @AuthenticationPrincipal AuthenticatedUser user) {
        return repo.findById(id)
                .filter(n -> n.getUserId().equals(user.getUserId()))   // never delete another user's note
                .map(n -> { repo.delete(n); return ResponseEntity.noContent().<Void>build(); })
                .orElse(ResponseEntity.notFound().build());
    }
}
