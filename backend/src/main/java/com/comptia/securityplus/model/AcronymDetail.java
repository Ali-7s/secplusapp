package com.comptia.securityplus.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public class AcronymDetail {
    private String practicalScenario;
    private String quizQuestion;
    private List<String> quizOptions;
    private String quizAnswer;

    public AcronymDetail() {}

    public String getPracticalScenario() { return practicalScenario; }
    public void setPracticalScenario(String practicalScenario) { this.practicalScenario = practicalScenario; }
    public String getQuizQuestion() { return quizQuestion; }
    public void setQuizQuestion(String quizQuestion) { this.quizQuestion = quizQuestion; }
    public List<String> getQuizOptions() { return quizOptions; }
    public void setQuizOptions(List<String> quizOptions) { this.quizOptions = quizOptions; }
    public String getQuizAnswer() { return quizAnswer; }
    public void setQuizAnswer(String quizAnswer) { this.quizAnswer = quizAnswer; }
}
