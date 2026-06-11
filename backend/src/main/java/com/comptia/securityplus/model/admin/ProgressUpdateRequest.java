package com.comptia.securityplus.model.admin;

public class ProgressUpdateRequest {

    private Boolean examPassed;
    private Double bestExamScore;
    private Integer examAttempts;
    private Integer flashcardsReviewed;
    private Integer practiceQuestionsAnswered;
    private Integer practiceQuestionsCorrect;
    private Boolean labCompleted;
    private Boolean conceptRead;
    private Boolean unlocked;

    public Boolean getExamPassed() { return examPassed; }
    public void setExamPassed(Boolean examPassed) { this.examPassed = examPassed; }
    public Double getBestExamScore() { return bestExamScore; }
    public void setBestExamScore(Double bestExamScore) { this.bestExamScore = bestExamScore; }
    public Integer getExamAttempts() { return examAttempts; }
    public void setExamAttempts(Integer examAttempts) { this.examAttempts = examAttempts; }
    public Integer getFlashcardsReviewed() { return flashcardsReviewed; }
    public void setFlashcardsReviewed(Integer flashcardsReviewed) { this.flashcardsReviewed = flashcardsReviewed; }
    public Integer getPracticeQuestionsAnswered() { return practiceQuestionsAnswered; }
    public void setPracticeQuestionsAnswered(Integer practiceQuestionsAnswered) { this.practiceQuestionsAnswered = practiceQuestionsAnswered; }
    public Integer getPracticeQuestionsCorrect() { return practiceQuestionsCorrect; }
    public void setPracticeQuestionsCorrect(Integer practiceQuestionsCorrect) { this.practiceQuestionsCorrect = practiceQuestionsCorrect; }
    public Boolean getLabCompleted() { return labCompleted; }
    public void setLabCompleted(Boolean labCompleted) { this.labCompleted = labCompleted; }
    public Boolean getConceptRead() { return conceptRead; }
    public void setConceptRead(Boolean conceptRead) { this.conceptRead = conceptRead; }
    public Boolean getUnlocked() { return unlocked; }
    public void setUnlocked(Boolean unlocked) { this.unlocked = unlocked; }
}
