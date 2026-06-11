package com.comptia.securityplus.model;

import java.util.List;

public class ExamSubmission {
    private String sectionId;
    private String examType;
    private List<QuestionAnswer> answers;
    private long timeTakenSeconds;

    public ExamSubmission() {}

    public static class QuestionAnswer {
        private String questionId;
        private String selectedAnswer;
        private List<String> selectedAnswers;

        public QuestionAnswer() {}
        public String getQuestionId() { return questionId; }
        public void setQuestionId(String questionId) { this.questionId = questionId; }
        public String getSelectedAnswer() { return selectedAnswer; }
        public void setSelectedAnswer(String selectedAnswer) { this.selectedAnswer = selectedAnswer; }
        public List<String> getSelectedAnswers() { return selectedAnswers; }
        public void setSelectedAnswers(List<String> selectedAnswers) { this.selectedAnswers = selectedAnswers; }
    }

    public String getSectionId() { return sectionId; }
    public void setSectionId(String sectionId) { this.sectionId = sectionId; }
    public String getExamType() { return examType; }
    public void setExamType(String examType) { this.examType = examType; }
    public List<QuestionAnswer> getAnswers() { return answers; }
    public void setAnswers(List<QuestionAnswer> answers) { this.answers = answers; }
    public long getTimeTakenSeconds() { return timeTakenSeconds; }
    public void setTimeTakenSeconds(long timeTakenSeconds) { this.timeTakenSeconds = timeTakenSeconds; }
}
