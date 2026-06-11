package com.comptia.securityplus.model;

import java.util.List;

public class Lab {
    private String id;
    private String sectionId;
    private String title;
    private String objective;
    private String scenario;
    private String background;
    private List<LabStep> steps;
    private List<String> tools;
    private String difficulty;
    private int estimatedMinutes;
    private List<LabQuestion> questions;
    private String walkthrough;

    public Lab() {}

    public static class LabStep {
        private int stepNumber;
        private String title;
        private String instruction;
        private String command;
        private String expectedOutput;
        private String hint;

        public LabStep() {}
        public int getStepNumber() { return stepNumber; }
        public void setStepNumber(int stepNumber) { this.stepNumber = stepNumber; }
        public String getTitle() { return title; }
        public void setTitle(String title) { this.title = title; }
        public String getInstruction() { return instruction; }
        public void setInstruction(String instruction) { this.instruction = instruction; }
        public String getCommand() { return command; }
        public void setCommand(String command) { this.command = command; }
        public String getExpectedOutput() { return expectedOutput; }
        public void setExpectedOutput(String expectedOutput) { this.expectedOutput = expectedOutput; }
        public String getHint() { return hint; }
        public void setHint(String hint) { this.hint = hint; }
    }

    public static class LabQuestion {
        private String question;
        private String answer;
        private String explanation;

        public LabQuestion() {}
        public String getQuestion() { return question; }
        public void setQuestion(String question) { this.question = question; }
        public String getAnswer() { return answer; }
        public void setAnswer(String answer) { this.answer = answer; }
        public String getExplanation() { return explanation; }
        public void setExplanation(String explanation) { this.explanation = explanation; }
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getSectionId() { return sectionId; }
    public void setSectionId(String sectionId) { this.sectionId = sectionId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getObjective() { return objective; }
    public void setObjective(String objective) { this.objective = objective; }
    public String getScenario() { return scenario; }
    public void setScenario(String scenario) { this.scenario = scenario; }
    public String getBackground() { return background; }
    public void setBackground(String background) { this.background = background; }
    public List<LabStep> getSteps() { return steps; }
    public void setSteps(List<LabStep> steps) { this.steps = steps; }
    public List<String> getTools() { return tools; }
    public void setTools(List<String> tools) { this.tools = tools; }
    public String getDifficulty() { return difficulty; }
    public void setDifficulty(String difficulty) { this.difficulty = difficulty; }
    public int getEstimatedMinutes() { return estimatedMinutes; }
    public void setEstimatedMinutes(int estimatedMinutes) { this.estimatedMinutes = estimatedMinutes; }
    public List<LabQuestion> getQuestions() { return questions; }
    public void setQuestions(List<LabQuestion> questions) { this.questions = questions; }
    public String getWalkthrough() { return walkthrough; }
    public void setWalkthrough(String walkthrough) { this.walkthrough = walkthrough; }
}
