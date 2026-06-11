package com.comptia.securityplus.model;

import java.util.List;

public class Question {
    private String id;
    private String sectionId;
    private String domainId;
    private QuestionType type;
    private String scenario;
    private String stem;
    private List<String> options;
    private String correctAnswer;
    private List<String> correctAnswers;
    private String explanation;
    private String difficulty;
    private List<String> tags;
    private int points;

    public enum QuestionType { MULTIPLE_CHOICE, MULTI_SELECT, SCENARIO, DRAG_DROP, ORDER_LIST }

    public Question() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getSectionId() { return sectionId; }
    public void setSectionId(String sectionId) { this.sectionId = sectionId; }
    public String getDomainId() { return domainId; }
    public void setDomainId(String domainId) { this.domainId = domainId; }
    public QuestionType getType() { return type; }
    public void setType(QuestionType type) { this.type = type; }
    public String getScenario() { return scenario; }
    public void setScenario(String scenario) { this.scenario = scenario; }
    public String getStem() { return stem; }
    public void setStem(String stem) { this.stem = stem; }
    public List<String> getOptions() { return options; }
    public void setOptions(List<String> options) { this.options = options; }
    public String getCorrectAnswer() { return correctAnswer; }
    public void setCorrectAnswer(String correctAnswer) { this.correctAnswer = correctAnswer; }
    public List<String> getCorrectAnswers() { return correctAnswers; }
    public void setCorrectAnswers(List<String> correctAnswers) { this.correctAnswers = correctAnswers; }
    public String getExplanation() { return explanation; }
    public void setExplanation(String explanation) { this.explanation = explanation; }
    public String getDifficulty() { return difficulty; }
    public void setDifficulty(String difficulty) { this.difficulty = difficulty; }
    public List<String> getTags() { return tags; }
    public void setTags(List<String> tags) { this.tags = tags; }
    public int getPoints() { return points; }
    public void setPoints(int points) { this.points = points; }
}
