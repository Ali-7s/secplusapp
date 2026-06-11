package com.comptia.securityplus.model;

import java.util.List;
import java.util.Map;

public class ExamResult {
    private String sectionId;
    private String examType;
    private int totalQuestions;
    private int correctAnswers;
    private double scorePercent;
    private boolean passed;
    private int passingScore;
    private long timeTakenSeconds;
    private List<QuestionResult> results;
    private Map<String, Integer> domainBreakdown;
    private String feedback;
    private String nextSteps;

    public ExamResult() {}
    public ExamResult(String sectionId, String examType, int totalQuestions, int correctAnswers,
                      double scorePercent, boolean passed, int passingScore, long timeTakenSeconds,
                      List<QuestionResult> results, Map<String, Integer> domainBreakdown,
                      String feedback, String nextSteps) {
        this.sectionId = sectionId; this.examType = examType; this.totalQuestions = totalQuestions;
        this.correctAnswers = correctAnswers; this.scorePercent = scorePercent; this.passed = passed;
        this.passingScore = passingScore; this.timeTakenSeconds = timeTakenSeconds;
        this.results = results; this.domainBreakdown = domainBreakdown;
        this.feedback = feedback; this.nextSteps = nextSteps;
    }

    public static class QuestionResult {
        private String questionId;
        private String stem;
        private String selectedAnswer;
        private String correctAnswer;
        private boolean correct;
        private String explanation;
        private String difficulty;

        public QuestionResult() {}
        public QuestionResult(String questionId, String stem, String selectedAnswer, String correctAnswer,
                              boolean correct, String explanation, String difficulty) {
            this.questionId = questionId; this.stem = stem; this.selectedAnswer = selectedAnswer;
            this.correctAnswer = correctAnswer; this.correct = correct;
            this.explanation = explanation; this.difficulty = difficulty;
        }
        public String getQuestionId() { return questionId; }
        public void setQuestionId(String questionId) { this.questionId = questionId; }
        public String getStem() { return stem; }
        public void setStem(String stem) { this.stem = stem; }
        public String getSelectedAnswer() { return selectedAnswer; }
        public void setSelectedAnswer(String selectedAnswer) { this.selectedAnswer = selectedAnswer; }
        public String getCorrectAnswer() { return correctAnswer; }
        public void setCorrectAnswer(String correctAnswer) { this.correctAnswer = correctAnswer; }
        public boolean isCorrect() { return correct; }
        public void setCorrect(boolean correct) { this.correct = correct; }
        public String getExplanation() { return explanation; }
        public void setExplanation(String explanation) { this.explanation = explanation; }
        public String getDifficulty() { return difficulty; }
        public void setDifficulty(String difficulty) { this.difficulty = difficulty; }
    }

    public String getSectionId() { return sectionId; }
    public void setSectionId(String id) { this.sectionId = id; }
    public String getExamType() { return examType; }
    public void setExamType(String t) { this.examType = t; }
    public int getTotalQuestions() { return totalQuestions; }
    public void setTotalQuestions(int n) { this.totalQuestions = n; }
    public int getCorrectAnswers() { return correctAnswers; }
    public void setCorrectAnswers(int n) { this.correctAnswers = n; }
    public double getScorePercent() { return scorePercent; }
    public void setScorePercent(double s) { this.scorePercent = s; }
    public boolean isPassed() { return passed; }
    public void setPassed(boolean p) { this.passed = p; }
    public int getPassingScore() { return passingScore; }
    public void setPassingScore(int s) { this.passingScore = s; }
    public long getTimeTakenSeconds() { return timeTakenSeconds; }
    public void setTimeTakenSeconds(long t) { this.timeTakenSeconds = t; }
    public List<QuestionResult> getResults() { return results; }
    public void setResults(List<QuestionResult> r) { this.results = r; }
    public Map<String, Integer> getDomainBreakdown() { return domainBreakdown; }
    public void setDomainBreakdown(Map<String, Integer> d) { this.domainBreakdown = d; }
    public String getFeedback() { return feedback; }
    public void setFeedback(String f) { this.feedback = f; }
    public String getNextSteps() { return nextSteps; }
    public void setNextSteps(String n) { this.nextSteps = n; }
}
