package com.comptia.securityplus.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public class ConceptExplanation {
    private String sectionId;
    private String title;
    private String overview;
    private String detailedExplanation;
    private List<String> keyPoints;
    private List<String> realWorldExamples;
    private List<String> examTips;
    private List<String> commonMistakes;
    private String analogyExplanation;
    private List<String> relatedTopics;
    private List<Diagram> diagrams;

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Diagram {
        private String title;
        private String description;   // one-line caption explaining what to look at
        private String mermaid;       // mermaid flowchart source
        public String getTitle() { return title; }
        public void setTitle(String title) { this.title = title; }
        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }
        public String getMermaid() { return mermaid; }
        public void setMermaid(String mermaid) { this.mermaid = mermaid; }
    }

    public ConceptExplanation() {}

    public String getSectionId() { return sectionId; }
    public void setSectionId(String sectionId) { this.sectionId = sectionId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getOverview() { return overview; }
    public void setOverview(String overview) { this.overview = overview; }
    public String getDetailedExplanation() { return detailedExplanation; }
    public void setDetailedExplanation(String detailedExplanation) { this.detailedExplanation = detailedExplanation; }
    public List<String> getKeyPoints() { return keyPoints; }
    public void setKeyPoints(List<String> keyPoints) { this.keyPoints = keyPoints; }
    public List<String> getRealWorldExamples() { return realWorldExamples; }
    public void setRealWorldExamples(List<String> realWorldExamples) { this.realWorldExamples = realWorldExamples; }
    public List<String> getExamTips() { return examTips; }
    public void setExamTips(List<String> examTips) { this.examTips = examTips; }
    public List<String> getCommonMistakes() { return commonMistakes; }
    public void setCommonMistakes(List<String> commonMistakes) { this.commonMistakes = commonMistakes; }
    public String getAnalogyExplanation() { return analogyExplanation; }
    public void setAnalogyExplanation(String analogyExplanation) { this.analogyExplanation = analogyExplanation; }
    public List<String> getRelatedTopics() { return relatedTopics; }
    public void setRelatedTopics(List<String> relatedTopics) { this.relatedTopics = relatedTopics; }
    public List<Diagram> getDiagrams() { return diagrams; }
    public void setDiagrams(List<Diagram> diagrams) { this.diagrams = diagrams; }
}
