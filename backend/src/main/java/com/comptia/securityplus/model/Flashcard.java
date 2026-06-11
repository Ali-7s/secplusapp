package com.comptia.securityplus.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public class Flashcard {
    private String id;
    private String sectionId;
    private String front;
    private String back;
    private String category;
    private String difficulty;
    private String mnemonic;
    private String examTip;

    public Flashcard() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getSectionId() { return sectionId; }
    public void setSectionId(String sectionId) { this.sectionId = sectionId; }
    public String getFront() { return front; }
    public void setFront(String front) { this.front = front; }
    public String getBack() { return back; }
    public void setBack(String back) { this.back = back; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public String getDifficulty() { return difficulty; }
    public void setDifficulty(String difficulty) { this.difficulty = difficulty; }
    public String getMnemonic() { return mnemonic; }
    public void setMnemonic(String mnemonic) { this.mnemonic = mnemonic; }
    public String getExamTip() { return examTip; }
    public void setExamTip(String examTip) { this.examTip = examTip; }
}
