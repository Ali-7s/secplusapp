package com.comptia.securityplus.model;

import java.util.List;
import java.util.Map;

public class ExamSubmission {
    private String sectionId;
    private String domainId;
    private String examType;   // SECTION | DOMAIN | FULL
    private List<QuestionAnswer> answers;
    private long timeTakenSeconds;

    public ExamSubmission() {}

    public static class QuestionAnswer {
        private String questionId;
        private String selectedAnswer;
        private List<String> selectedAnswers;
        // PBQ answers
        private Map<String, String> pairAnswers;          // DRAG_DROP / NETWORK_PLACEMENT: dragId -> targetId
        private List<String> orderAnswer;                 // ORDER_LIST: the user's ordering
        private List<Map<String, String>> firewallAnswer; // FIREWALL_RULES: rows of column -> value

        public QuestionAnswer() {}
        public String getQuestionId() { return questionId; }
        public void setQuestionId(String questionId) { this.questionId = questionId; }
        public String getSelectedAnswer() { return selectedAnswer; }
        public void setSelectedAnswer(String selectedAnswer) { this.selectedAnswer = selectedAnswer; }
        public List<String> getSelectedAnswers() { return selectedAnswers; }
        public void setSelectedAnswers(List<String> selectedAnswers) { this.selectedAnswers = selectedAnswers; }
        public Map<String, String> getPairAnswers() { return pairAnswers; }
        public void setPairAnswers(Map<String, String> pairAnswers) { this.pairAnswers = pairAnswers; }
        public List<String> getOrderAnswer() { return orderAnswer; }
        public void setOrderAnswer(List<String> orderAnswer) { this.orderAnswer = orderAnswer; }
        public List<Map<String, String>> getFirewallAnswer() { return firewallAnswer; }
        public void setFirewallAnswer(List<Map<String, String>> firewallAnswer) { this.firewallAnswer = firewallAnswer; }
    }

    public String getSectionId() { return sectionId; }
    public void setSectionId(String sectionId) { this.sectionId = sectionId; }
    public String getDomainId() { return domainId; }
    public void setDomainId(String domainId) { this.domainId = domainId; }
    public String getExamType() { return examType; }
    public void setExamType(String examType) { this.examType = examType; }
    public List<QuestionAnswer> getAnswers() { return answers; }
    public void setAnswers(List<QuestionAnswer> answers) { this.answers = answers; }
    public long getTimeTakenSeconds() { return timeTakenSeconds; }
    public void setTimeTakenSeconds(long timeTakenSeconds) { this.timeTakenSeconds = timeTakenSeconds; }
}
