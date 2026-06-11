package com.comptia.securityplus.model;

import java.util.List;

public class Section {
    private String id;
    private String domainId;
    private String objectiveNumber;
    private String name;
    private String description;
    private List<String> keyTopics;
    private List<String> keyTerms;
    private int order;
    private int passingScore;

    public Section() {}
    public Section(String id, String domainId, String objectiveNumber, String name,
                   String description, List<String> keyTopics, List<String> keyTerms,
                   int order, int passingScore) {
        this.id = id; this.domainId = domainId; this.objectiveNumber = objectiveNumber;
        this.name = name; this.description = description; this.keyTopics = keyTopics;
        this.keyTerms = keyTerms; this.order = order; this.passingScore = passingScore;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getDomainId() { return domainId; }
    public void setDomainId(String domainId) { this.domainId = domainId; }
    public String getObjectiveNumber() { return objectiveNumber; }
    public void setObjectiveNumber(String objectiveNumber) { this.objectiveNumber = objectiveNumber; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public List<String> getKeyTopics() { return keyTopics; }
    public void setKeyTopics(List<String> keyTopics) { this.keyTopics = keyTopics; }
    public List<String> getKeyTerms() { return keyTerms; }
    public void setKeyTerms(List<String> keyTerms) { this.keyTerms = keyTerms; }
    public int getOrder() { return order; }
    public void setOrder(int order) { this.order = order; }
    public int getPassingScore() { return passingScore; }
    public void setPassingScore(int passingScore) { this.passingScore = passingScore; }
}
