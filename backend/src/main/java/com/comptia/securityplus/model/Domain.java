package com.comptia.securityplus.model;

import java.util.List;

public class Domain {
    private String id;
    private String number;
    private String name;
    private String description;
    private int examWeight;
    private List<Section> sections;
    private String icon;
    private String color;

    public Domain() {}
    public Domain(String id, String number, String name, String description,
                  int examWeight, List<Section> sections, String icon, String color) {
        this.id = id; this.number = number; this.name = name; this.description = description;
        this.examWeight = examWeight; this.sections = sections; this.icon = icon; this.color = color;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getNumber() { return number; }
    public void setNumber(String number) { this.number = number; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public int getExamWeight() { return examWeight; }
    public void setExamWeight(int examWeight) { this.examWeight = examWeight; }
    public List<Section> getSections() { return sections; }
    public void setSections(List<Section> sections) { this.sections = sections; }
    public String getIcon() { return icon; }
    public void setIcon(String icon) { this.icon = icon; }
    public String getColor() { return color; }
    public void setColor(String color) { this.color = color; }
}
