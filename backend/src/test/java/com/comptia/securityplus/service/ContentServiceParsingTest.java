package com.comptia.securityplus.service;

import com.comptia.securityplus.model.Question;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests the AI-JSON normalization in {@link ContentService#parseQuestions} — the part most
 * exposed to model drift. Dependencies are unused by parsing, so we pass nulls.
 */
class ContentServiceParsingTest {

    private final ContentService svc = new ContentService(null, null, null);

    private Question one(String json) throws Exception {
        List<Question> qs = svc.parseQuestions(json);
        assertThat(qs).hasSize(1);
        return qs.get(0);
    }

    @Test
    void addsLetterPrefixesToOptionsAndKeepsCorrectAnswerLetter() throws Exception {
        Question q = one("""
            [{"id":"q1","type":"MULTIPLE_CHOICE","stem":"Which?",
              "options":["Multi-factor authentication (MFA)","Single sign-on (SSO)","Federated identity","RBAC"],
              "correctAnswer":"A"}]""");
        assertThat(q.getOptions().get(0)).isEqualTo("A. Multi-factor authentication (MFA)");
        assertThat(q.getOptions().get(3)).isEqualTo("D. RBAC");
        assertThat(q.getCorrectAnswer()).isEqualTo("A");
        // the UI strips the 3-char prefix — verify it yields the full text again
        assertThat(q.getOptions().get(0).substring(3)).isEqualTo("Multi-factor authentication (MFA)");
    }

    @Test
    void remapsFullTextCorrectAnswerToLetter() throws Exception {
        Question q = one("""
            [{"id":"q1","type":"MULTIPLE_CHOICE","stem":"SoD?",
              "options":["Separation of duties","Least privilege","Need to know","Defense in depth"],
              "correctAnswer":"Least privilege"}]""");
        assertThat(q.getCorrectAnswer()).isEqualTo("B");
    }

    @Test
    void leavesAlreadyPrefixedOptionsUntouched() throws Exception {
        Question q = one("""
            [{"id":"q1","type":"MULTIPLE_CHOICE","stem":"x",
              "options":["A. Technical","B. Operational","C. Managerial","D. Physical"],
              "correctAnswer":"C"}]""");
        assertThat(q.getOptions().get(0)).isEqualTo("A. Technical");   // no double "A. A."
        assertThat(q.getCorrectAnswer()).isEqualTo("C");
    }

    @Test
    void coercesCorrectAnswerArrayToFirstElement() throws Exception {
        Question q = one("""
            [{"id":"q1","type":"MULTIPLE_CHOICE","stem":"x",
              "options":["A. a","B. b"],"correctAnswer":["B"]}]""");
        assertThat(q.getCorrectAnswer()).isEqualTo("B");
    }

    @Test
    void mapsQuestionFieldAndLowercaseTypeAndArrayCorrectAnswer() throws Exception {
        Question q = one("""
            [{"id":1,"type":"scenario","difficulty":"hard","question":"A long scenario about controls?",
              "options":["A. Technical","B. Operational","C. Managerial","D. Physical"],"correctAnswer":["C"]}]""");
        assertThat(q.getStem()).contains("scenario about controls");
        assertThat(q.getType()).isEqualTo(Question.QuestionType.SCENARIO);
        assertThat(q.getCorrectAnswer()).isEqualTo("C");
    }

    @Test
    void salvagesCorrectPairsArrayIntoMap() throws Exception {
        Question q = one("""
            [{"id":"q1","type":"DRAG_DROP","stem":"Match","options":[],
              "dragPairs":[{"id":"a","label":"AES"},{"id":"b","label":"RSA"}],
              "dropTargets":[{"id":"1","label":"Symmetric"},{"id":"2","label":"Asymmetric"}],
              "correctPairs":[{"a":"1"},{"b":"2"}]}]""");
        assertThat(q.getCorrectPairs()).containsEntry("a", "1").containsEntry("b", "2");
    }

    @Test
    void flattensOrderItemsArrayOfObjects() throws Exception {
        Question q = one("""
            [{"id":"q1","type":"ORDER_LIST","stem":"Order","options":[],
              "orderItems":[{"step":"Identification"},{"step":"Containment"}],
              "correctOrder":[{"item":"Identification"},{"item":"Containment"}]}]""");
        assertThat(q.getOrderItems()).containsExactly("Identification", "Containment");
        assertThat(q.getCorrectOrder()).containsExactly("Identification", "Containment");
    }

    @Test
    void toleratesUnquotedFieldNamesAndTrailingCommas() throws Exception {
        // malformed JSON: unquoted "points" key + trailing comma
        Question q = one("[{\"id\":\"q1\",\"type\":\"MULTIPLE_CHOICE\",\"stem\":\"x\","
                + "\"options\":[\"A. a\",\"B. b\"],\"correctAnswer\":\"A\",points: 1,}]");
        assertThat(q.getCorrectAnswer()).isEqualTo("A");
        assertThat(q.getPoints()).isEqualTo(1);
    }

    @Test
    void extractsQuestionsFromWrappedObject() throws Exception {
        Question q = one("""
            {"examTitle":"Section Exam","questions":[
              {"id":"q1","type":"MULTIPLE_CHOICE","stem":"x","options":["A. a","B. b"],"correctAnswer":"A"}]}""");
        assertThat(q.getCorrectAnswer()).isEqualTo("A");
    }

    @Test
    void parsesFirewallRulesShape() throws Exception {
        Question q = one("""
            [{"id":"q1","type":"firewall_rules","stem":"Build ACL","options":[],
              "firewallColumns":["Source","Action"],
              "firewallOptions":{"Source":["Any","10.0.0.0/24"],"Action":["Allow","Deny"]},
              "correctRules":[{"Source":"Any","Action":"Deny"}]}]""");
        assertThat(q.getType()).isEqualTo(Question.QuestionType.FIREWALL_RULES);
        assertThat(q.getFirewallColumns()).containsExactly("Source", "Action");
        assertThat(q.getFirewallOptions().get("Action")).contains("Deny");
        assertThat(q.getCorrectRules()).hasSize(1);
        assertThat(q.getCorrectRules().get(0)).containsEntry("Action", "Deny");
    }
}
