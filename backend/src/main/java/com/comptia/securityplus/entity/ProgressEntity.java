package com.comptia.securityplus.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "progress",
       uniqueConstraints = @UniqueConstraint(name = "uk_user_section", columnNames = {"user_id", "section_id"}))
public class ProgressEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @JsonIgnore
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "section_id", nullable = false)
    private String sectionId;

    @Column(nullable = false)
    private String domainId;

    private boolean examPassed = false;
    private double bestExamScore = 0.0;
    private int examAttempts = 0;
    private int flashcardsReviewed = 0;
    private int practiceQuestionsAnswered = 0;
    private int practiceQuestionsCorrect = 0;
    private boolean labCompleted = false;
    private boolean conceptRead = false;
    private boolean unlocked = false;
    private int totalTimeMinutes = 0;

    @Column(updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
    private LocalDateTime updatedAt = LocalDateTime.now();
    private LocalDateTime lastExamAt;

    @PreUpdate
    public void preUpdate() { updatedAt = LocalDateTime.now(); }

    public ProgressEntity() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getSectionId() { return sectionId; }
    public void setSectionId(String sectionId) { this.sectionId = sectionId; }
    public String getDomainId() { return domainId; }
    public void setDomainId(String domainId) { this.domainId = domainId; }
    public boolean isExamPassed() { return examPassed; }
    public void setExamPassed(boolean examPassed) { this.examPassed = examPassed; }
    public double getBestExamScore() { return bestExamScore; }
    public void setBestExamScore(double bestExamScore) { this.bestExamScore = bestExamScore; }
    public int getExamAttempts() { return examAttempts; }
    public void setExamAttempts(int examAttempts) { this.examAttempts = examAttempts; }
    public int getFlashcardsReviewed() { return flashcardsReviewed; }
    public void setFlashcardsReviewed(int flashcardsReviewed) { this.flashcardsReviewed = flashcardsReviewed; }
    public int getPracticeQuestionsAnswered() { return practiceQuestionsAnswered; }
    public void setPracticeQuestionsAnswered(int practiceQuestionsAnswered) { this.practiceQuestionsAnswered = practiceQuestionsAnswered; }
    public int getPracticeQuestionsCorrect() { return practiceQuestionsCorrect; }
    public void setPracticeQuestionsCorrect(int practiceQuestionsCorrect) { this.practiceQuestionsCorrect = practiceQuestionsCorrect; }
    public boolean isLabCompleted() { return labCompleted; }
    public void setLabCompleted(boolean labCompleted) { this.labCompleted = labCompleted; }
    public boolean isConceptRead() { return conceptRead; }
    public void setConceptRead(boolean conceptRead) { this.conceptRead = conceptRead; }
    public boolean isUnlocked() { return unlocked; }
    public void setUnlocked(boolean unlocked) { this.unlocked = unlocked; }
    public int getTotalTimeMinutes() { return totalTimeMinutes; }
    public void setTotalTimeMinutes(int totalTimeMinutes) { this.totalTimeMinutes = totalTimeMinutes; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public LocalDateTime getLastExamAt() { return lastExamAt; }
    public void setLastExamAt(LocalDateTime lastExamAt) { this.lastExamAt = lastExamAt; }
}
