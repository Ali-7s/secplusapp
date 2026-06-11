package com.comptia.securityplus.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public class Term {
    private String term;
    private String definition;
    private String category;
    private String examContext;
    private String analogy;
    private String relatedTerms;

    public Term() {}

    public String getTerm() { return term; }
    public void setTerm(String term) { this.term = term; }
    public String getDefinition() { return definition; }
    public void setDefinition(String definition) { this.definition = definition; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public String getExamContext() { return examContext; }
    public void setExamContext(String examContext) { this.examContext = examContext; }
    public String getAnalogy() { return analogy; }
    public void setAnalogy(String analogy) { this.analogy = analogy; }
    public String getRelatedTerms() { return relatedTerms; }
    public void setRelatedTerms(String relatedTerms) { this.relatedTerms = relatedTerms; }
}
