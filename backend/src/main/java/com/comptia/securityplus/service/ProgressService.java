package com.comptia.securityplus.service;

import com.comptia.securityplus.data.CurriculumData;
import com.comptia.securityplus.entity.ProgressEntity;
import com.comptia.securityplus.model.Domain;
import com.comptia.securityplus.model.Section;
import com.comptia.securityplus.model.admin.ProgressUpdateRequest;
import com.comptia.securityplus.repository.ProgressRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class ProgressService {

    private final ProgressRepository repo;
    private final CurriculumData curriculum;

    public ProgressService(ProgressRepository repo, CurriculumData curriculum) {
        this.repo = repo;
        this.curriculum = curriculum;
    }

    @Transactional
    public void initUserProgress(Long userId) {
        List<Domain> domains = curriculum.getAllDomains();
        for (Domain domain : domains) {
            for (Section section : domain.getSections()) {
                if (repo.findByUserIdAndSectionId(userId, section.getId()).isEmpty()) {
                    ProgressEntity p = new ProgressEntity();
                    p.setUserId(userId);
                    p.setSectionId(section.getId());
                    p.setDomainId(domain.getId());
                    p.setUnlocked(true);
                    repo.save(p);
                }
            }
        }
    }

    public List<ProgressEntity> getAllProgress(Long userId) {
        return repo.findByUserId(userId);
    }

    public ProgressEntity getProgress(Long userId, String sectionId) {
        return repo.findByUserIdAndSectionId(userId, sectionId)
                .orElseGet(() -> {
                    ProgressEntity p = new ProgressEntity();
                    p.setUserId(userId);
                    p.setSectionId(sectionId);
                    p.setDomainId("unknown");
                    p.setUnlocked(true);
                    return repo.save(p);
                });
    }

    public Map<String, Object> getSummary(Long userId) {
        List<ProgressEntity> all = repo.findByUserId(userId);
        long totalSections = curriculum.getAllDomains().stream()
                .filter(d -> !"foundations".equals(d.getId()))   // primer, not exam material
                .mapToLong(d -> d.getSections().size()).sum();
        long passed = all.stream().filter(ProgressEntity::isExamPassed).count();
        long unlocked = all.stream().filter(ProgressEntity::isUnlocked).count();

        int totalQuestions = all.stream().mapToInt(ProgressEntity::getPracticeQuestionsAnswered).sum();
        int totalCorrect = all.stream().mapToInt(ProgressEntity::getPracticeQuestionsCorrect).sum();
        int totalFlashcards = all.stream().mapToInt(ProgressEntity::getFlashcardsReviewed).sum();

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("totalSections", totalSections);
        summary.put("sectionsPassed", passed);
        summary.put("sectionsUnlocked", unlocked);
        summary.put("overallProgress", totalSections > 0 ? (double) passed / totalSections * 100 : 0);
        summary.put("totalQuestionsAnswered", totalQuestions);
        summary.put("totalCorrectAnswers", totalCorrect);
        summary.put("overallAccuracy", totalQuestions > 0 ? (double) totalCorrect / totalQuestions * 100 : 0);
        summary.put("totalFlashcardsReviewed", totalFlashcards);
        summary.put("domainProgress", getDomainProgress(userId));
        return summary;
    }

    private List<Map<String, Object>> getDomainProgress(Long userId) {
        return curriculum.getAllDomains().stream()
            .filter(d -> !"foundations".equals(d.getId()))   // primer, not exam material
            .map(domain -> {
            List<ProgressEntity> dp = repo.findByUserIdAndDomainId(userId, domain.getId());
            long passed = dp.stream().filter(ProgressEntity::isExamPassed).count();
            int total = domain.getSections().size();
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("domainId", domain.getId());
            result.put("domainName", domain.getName());
            result.put("totalSections", total);
            result.put("sectionsPassed", passed);
            result.put("progress", total > 0 ? (double) passed / total * 100 : 0);
            result.put("color", domain.getColor());
            return result;
        }).collect(Collectors.toList());
    }

    @Transactional
    public void recordExamAttempt(Long userId, String sectionId, double score, boolean passed) {
        ProgressEntity p = getProgress(userId, sectionId);
        p.setExamAttempts(p.getExamAttempts() + 1);
        p.setLastExamAt(LocalDateTime.now());
        if (score > p.getBestExamScore()) p.setBestExamScore(score);
        if (passed) p.setExamPassed(true);
        repo.save(p);
    }

    @Transactional
    public void updateFlashcardsReviewed(Long userId, String sectionId, int count) {
        ProgressEntity p = getProgress(userId, sectionId);
        p.setFlashcardsReviewed(Math.max(p.getFlashcardsReviewed(), count));
        repo.save(p);
    }

    @Transactional
    public void updatePracticeAnswered(Long userId, String sectionId, int answered, int correct) {
        ProgressEntity p = getProgress(userId, sectionId);
        p.setPracticeQuestionsAnswered(p.getPracticeQuestionsAnswered() + answered);
        p.setPracticeQuestionsCorrect(p.getPracticeQuestionsCorrect() + correct);
        repo.save(p);
    }

    @Transactional
    public void markLabCompleted(Long userId, String sectionId) {
        ProgressEntity p = getProgress(userId, sectionId);
        p.setLabCompleted(true);
        repo.save(p);
    }

    @Transactional
    public void markConceptRead(Long userId, String sectionId) {
        ProgressEntity p = getProgress(userId, sectionId);
        p.setConceptRead(true);
        repo.save(p);
    }

    @Transactional
    public void resetSection(Long userId, String sectionId) {
        ProgressEntity p = getProgress(userId, sectionId);
        p.setExamPassed(false);
        p.setBestExamScore(0);
        p.setExamAttempts(0);
        p.setFlashcardsReviewed(0);
        p.setPracticeQuestionsAnswered(0);
        p.setPracticeQuestionsCorrect(0);
        p.setLabCompleted(false);
        p.setConceptRead(false);
        repo.save(p);
    }

    @Transactional
    public ProgressEntity adminUpdateProgress(Long userId, String sectionId, ProgressUpdateRequest req) {
        ProgressEntity p = getProgress(userId, sectionId);
        if (req.getExamPassed() != null) p.setExamPassed(req.getExamPassed());
        if (req.getBestExamScore() != null) p.setBestExamScore(req.getBestExamScore());
        if (req.getExamAttempts() != null) p.setExamAttempts(req.getExamAttempts());
        if (req.getFlashcardsReviewed() != null) p.setFlashcardsReviewed(req.getFlashcardsReviewed());
        if (req.getPracticeQuestionsAnswered() != null) p.setPracticeQuestionsAnswered(req.getPracticeQuestionsAnswered());
        if (req.getPracticeQuestionsCorrect() != null) p.setPracticeQuestionsCorrect(req.getPracticeQuestionsCorrect());
        if (req.getLabCompleted() != null) p.setLabCompleted(req.getLabCompleted());
        if (req.getConceptRead() != null) p.setConceptRead(req.getConceptRead());
        if (req.getUnlocked() != null) p.setUnlocked(req.getUnlocked());
        return repo.save(p);
    }
}
