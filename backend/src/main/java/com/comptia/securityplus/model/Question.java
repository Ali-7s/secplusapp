package com.comptia.securityplus.model;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonSetter;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@JsonIgnoreProperties(ignoreUnknown = true)
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
    private Integer points;

    // PBQ: Matching
    private List<PairItem> dragPairs;
    private List<PairItem> dropTargets;
    private Map<String, String> correctPairs;

    // PBQ: Sequencing
    private List<String> orderItems;
    private List<String> correctOrder;

    // PBQ: Log / attack identification (renders a log block above standard options)
    private String logText;

    // PBQ: Firewall ruleset — user fills a table of dropdowns
    private List<String> firewallColumns;              // e.g. ["Source","Destination","Service","Action"]
    private Map<String, List<String>> firewallOptions; // column -> allowed dropdown values
    private List<Map<String, String>> correctRules;    // ordered correct rows (column -> value)

    // PBQ: Configuration form — grouped per-field dropdowns (VPN config, host
    // compromise classification, subnet-zone placement, ...)
    private List<ConfigField> configFields;

    public enum QuestionType {
        MULTIPLE_CHOICE, MULTI_SELECT, SCENARIO, DRAG_DROP, ORDER_LIST,
        FIREWALL_RULES, NETWORK_PLACEMENT, LOG_ANALYSIS, CONFIG_FORM
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ConfigField {
        private String group;           // optional section header, e.g. "Gateway A — Phase 1"
        private String label;           // e.g. "Encryption algorithm" or "SRV-02"
        private List<String> options;   // dropdown values for this field
        private String correct;         // must be one of options
        public String getGroup() { return group; }
        public void setGroup(String group) { this.group = group; }
        public String getLabel() { return label; }
        public void setLabel(String label) { this.label = label; }
        public List<String> getOptions() { return options; }
        public void setOptions(List<String> options) { this.options = options; }
        public String getCorrect() { return correct; }
        @JsonAlias({"answer", "correctOption", "correctValue", "correctAnswer"})
        public void setCorrect(String correct) { this.correct = correct; }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class PairItem {
        private String id;
        private String label;
        public String getId() { return id; }
        public void setId(String id) { this.id = id; }
        public String getLabel() { return label; }
        public void setLabel(String label) { this.label = label; }
    }

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
    @JsonAlias({"question", "q", "prompt", "text"})
    public void setStem(String stem) { this.stem = stem; }
    public List<String> getOptions() { return options; }
    public void setOptions(List<String> options) { this.options = options; }
    public String getCorrectAnswer() { return correctAnswer; }
    @JsonSetter
    public void setCorrectAnswer(JsonNode node) {
        if (node == null || node.isNull()) { this.correctAnswer = null; return; }
        if (node.isArray()) {
            this.correctAnswer = node.size() > 0 ? node.get(0).asText() : null;
            if (node.size() > 1 && (this.correctAnswers == null || this.correctAnswers.isEmpty())) {
                List<String> list = new ArrayList<>();
                for (JsonNode n : node) list.add(n.asText());
                this.correctAnswers = list;
            }
        } else {
            this.correctAnswer = node.asText();
        }
    }
    public List<String> getCorrectAnswers() { return correctAnswers; }
    public void setCorrectAnswers(List<String> correctAnswers) { this.correctAnswers = correctAnswers; }
    public String getExplanation() { return explanation; }
    public void setExplanation(String explanation) { this.explanation = explanation; }
    public String getDifficulty() { return difficulty; }
    public void setDifficulty(String difficulty) { this.difficulty = difficulty; }
    public List<String> getTags() { return tags; }
    public void setTags(List<String> tags) { this.tags = tags; }
    public Integer getPoints() { return points; }
    public void setPoints(Integer points) { this.points = points; }

    public List<PairItem> getDragPairs() { return dragPairs; }
    public void setDragPairs(List<PairItem> dragPairs) { this.dragPairs = dragPairs; }
    public List<PairItem> getDropTargets() { return dropTargets; }
    public void setDropTargets(List<PairItem> dropTargets) { this.dropTargets = dropTargets; }
    public Map<String, String> getCorrectPairs() { return correctPairs; }
    public void setCorrectPairs(Map<String, String> correctPairs) { this.correctPairs = correctPairs; }
    public List<String> getOrderItems() { return orderItems; }
    public void setOrderItems(List<String> orderItems) { this.orderItems = orderItems; }
    public List<String> getCorrectOrder() { return correctOrder; }
    public void setCorrectOrder(List<String> correctOrder) { this.correctOrder = correctOrder; }

    public String getLogText() { return logText; }
    public void setLogText(String logText) { this.logText = logText; }
    public List<String> getFirewallColumns() { return firewallColumns; }
    public void setFirewallColumns(List<String> firewallColumns) { this.firewallColumns = firewallColumns; }
    public Map<String, List<String>> getFirewallOptions() { return firewallOptions; }
    public void setFirewallOptions(Map<String, List<String>> firewallOptions) { this.firewallOptions = firewallOptions; }
    public List<Map<String, String>> getCorrectRules() { return correctRules; }
    public void setCorrectRules(List<Map<String, String>> correctRules) { this.correctRules = correctRules; }
    public List<ConfigField> getConfigFields() { return configFields; }
    public void setConfigFields(List<ConfigField> configFields) { this.configFields = configFields; }
}
