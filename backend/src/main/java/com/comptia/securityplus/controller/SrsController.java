package com.comptia.securityplus.controller;

import com.comptia.securityplus.entity.SrsCardEntity;
import com.comptia.securityplus.security.AuthenticatedUser;
import com.comptia.securityplus.service.SrsService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/srs")
public class SrsController {

    private final SrsService srsService;

    public SrsController(SrsService srsService) {
        this.srsService = srsService;
    }

    /** All spaced-repetition cards for the current user (client splits into due / weak / forecast). */
    @GetMapping
    public ResponseEntity<List<SrsCardEntity>> getAll(@AuthenticationPrincipal AuthenticatedUser user) {
        return ResponseEntity.ok(srsService.getAll(user.getUserId()));
    }

    /** Record a review and reschedule the section. Returns the updated card. */
    @PostMapping("/review")
    public ResponseEntity<SrsCardEntity> review(
            @RequestBody ReviewRequest req,
            @AuthenticationPrincipal AuthenticatedUser user) {
        int quality = req.quality() != null ? req.quality() : 3;
        SrsCardEntity card = srsService.review(
                user.getUserId(), req.sectionId(), req.name(), quality, req.score());
        return ResponseEntity.ok(card);
    }

    /** One-time migration of a client's legacy localStorage schedule (server wins on conflict). */
    @PostMapping("/import")
    public ResponseEntity<List<SrsCardEntity>> importLegacy(
            @RequestBody List<SrsCardEntity> cards,
            @AuthenticationPrincipal AuthenticatedUser user) {
        return ResponseEntity.ok(srsService.importLegacy(user.getUserId(), cards));
    }

    public record ReviewRequest(String sectionId, String name, Integer quality, Integer score) {}
}
