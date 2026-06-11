package com.comptia.securityplus.controller;

import com.comptia.securityplus.data.CurriculumData;
import com.comptia.securityplus.model.Domain;
import com.comptia.securityplus.model.Section;
import com.comptia.securityplus.service.ClaudeService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;

@RestController
@RequestMapping("/api")
public class CurriculumController {

    private final CurriculumData curriculum;
    private final ClaudeService claudeService;

    public CurriculumController(CurriculumData curriculum, ClaudeService claudeService) {
        this.curriculum = curriculum;
        this.claudeService = claudeService;
    }

    @GetMapping("/curriculum")
    public ResponseEntity<List<Domain>> getCurriculum() {
        return ResponseEntity.ok(curriculum.getAllDomains());
    }

    @GetMapping("/domains")
    public ResponseEntity<List<Domain>> getDomains() {
        return ResponseEntity.ok(curriculum.getAllDomains());
    }

    @GetMapping("/domains/{domainId}")
    public ResponseEntity<Domain> getDomain(@PathVariable String domainId) {
        return curriculum.getAllDomains().stream()
            .filter(d -> d.getId().equals(domainId))
            .findFirst()
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/sections/{sectionId}")
    public ResponseEntity<Section> getSection(@PathVariable String sectionId) {
        return curriculum.getAllDomains().stream()
            .flatMap(d -> d.getSections().stream())
            .filter(s -> s.getId().equals(sectionId))
            .findFirst()
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getStatus() {
        return ResponseEntity.ok(Map.of(
            "configured", claudeService.isConfigured(),
            "version", "1.0.0",
            "exam", "CompTIA Security+ SY0-701"
        ));
    }
}
