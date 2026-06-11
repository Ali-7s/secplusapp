package com.comptia.securityplus.controller;

import com.comptia.securityplus.model.ExamResult;
import com.comptia.securityplus.model.ExamSubmission;
import com.comptia.securityplus.security.AuthenticatedUser;
import com.comptia.securityplus.service.ExamService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/exam")
public class ExamController {

    private final ExamService examService;

    public ExamController(ExamService examService) {
        this.examService = examService;
    }

    @PostMapping("/submit")
    public ResponseEntity<ExamResult> submitExam(
            @RequestBody ExamSubmission submission,
            @AuthenticationPrincipal AuthenticatedUser user) {
        return ResponseEntity.ok(examService.gradeExam(submission, user.getUserId()));
    }
}
