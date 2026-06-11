package com.comptia.securityplus.model;

public class Acronym {
    private String acronym;
    private String expansion;
    private String definition;
    private String category;
    private String examContext;
    private String relatedAcronyms;

    public Acronym() {}

    public String getAcronym() { return acronym; }
    public void setAcronym(String acronym) { this.acronym = acronym; }
    public String getExpansion() { return expansion; }
    public void setExpansion(String expansion) { this.expansion = expansion; }
    public String getDefinition() { return definition; }
    public void setDefinition(String definition) { this.definition = definition; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public String getExamContext() { return examContext; }
    public void setExamContext(String examContext) { this.examContext = examContext; }
    public String getRelatedAcronyms() { return relatedAcronyms; }
    public void setRelatedAcronyms(String relatedAcronyms) { this.relatedAcronyms = relatedAcronyms; }
}
