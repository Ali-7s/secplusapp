package com.comptia.securityplus.service;

import com.comptia.securityplus.model.ExamResult;
import com.comptia.securityplus.model.ExamSubmission;
import com.comptia.securityplus.model.ExamSubmission.QuestionAnswer;
import com.comptia.securityplus.model.Question;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for exam grading across every question type — including PBQs.
 * No Mockito (the test JVM is too new for the bundled byte-buddy) — plain stubs instead.
 */
class ExamServiceTest {

    private final ObjectMapper mapper = new ObjectMapper();
    private final ExamService exam = new ExamService(null, null);

    private Question q(Question.QuestionType type) {
        Question q = new Question();
        q.setId("q1");
        q.setType(type);
        q.setDomainId("domain1");
        q.setDifficulty("Medium");
        return q;
    }

    private void setCorrect(Question q, String letter) throws Exception {
        q.setCorrectAnswer(mapper.readTree("\"" + letter + "\""));
    }

    private QuestionAnswer ans() {
        QuestionAnswer a = new QuestionAnswer();
        a.setQuestionId("q1");
        return a;
    }

    @Test
    void gradesMultipleChoice() throws Exception {
        Question q = q(Question.QuestionType.MULTIPLE_CHOICE);
        setCorrect(q, "B");
        QuestionAnswer right = ans(); right.setSelectedAnswer("B");
        QuestionAnswer wrong = ans(); wrong.setSelectedAnswer("A");
        assertThat(exam.checkAnswer(q, right)).isTrue();
        assertThat(exam.checkAnswer(q, wrong)).isFalse();
    }

    @Test
    void gradesMultiSelectOrderInsensitive() {
        Question q = q(Question.QuestionType.MULTI_SELECT);
        q.setCorrectAnswers(List.of("A", "C"));
        QuestionAnswer right = ans(); right.setSelectedAnswers(List.of("C", "A"));
        QuestionAnswer partial = ans(); partial.setSelectedAnswers(List.of("A"));
        assertThat(exam.checkAnswer(q, right)).isTrue();
        assertThat(exam.checkAnswer(q, partial)).isFalse();
    }

    @Test
    void gradesDragDropAndNetworkPlacement() {
        for (Question.QuestionType type : List.of(
                Question.QuestionType.DRAG_DROP, Question.QuestionType.NETWORK_PLACEMENT)) {
            Question q = q(type);
            q.setCorrectPairs(Map.of("a", "1", "b", "2"));
            QuestionAnswer right = ans(); right.setPairAnswers(Map.of("a", "1", "b", "2"));
            QuestionAnswer wrong = ans(); wrong.setPairAnswers(Map.of("a", "1", "b", "1"));
            assertThat(exam.checkAnswer(q, right)).as(type.name()).isTrue();
            assertThat(exam.checkAnswer(q, wrong)).as(type.name()).isFalse();
        }
    }

    @Test
    void gradesOrderList() {
        Question q = q(Question.QuestionType.ORDER_LIST);
        q.setCorrectOrder(List.of("X", "Y", "Z"));
        QuestionAnswer right = ans(); right.setOrderAnswer(List.of("X", "Y", "Z"));
        QuestionAnswer wrong = ans(); wrong.setOrderAnswer(List.of("Y", "X", "Z"));
        assertThat(exam.checkAnswer(q, right)).isTrue();
        assertThat(exam.checkAnswer(q, wrong)).isFalse();
    }

    @Test
    void gradesFirewallRulesCaseInsensitiveAndOrdered() {
        Question q = q(Question.QuestionType.FIREWALL_RULES);
        q.setFirewallColumns(List.of("Source", "Service", "Action"));
        q.setCorrectRules(List.of(
                new LinkedHashMap<>(Map.of("Source", "Any", "Service", "HTTPS (443)", "Action", "Allow")),
                new LinkedHashMap<>(Map.of("Source", "Any", "Service", "Any", "Action", "Deny"))));

        QuestionAnswer right = ans();
        right.setFirewallAnswer(List.of(
                Map.of("Source", "Any", "Service", "HTTPS (443)", "Action", "Allow"),
                Map.of("Source", "any", "Service", "any", "Action", "deny")));   // case-insensitive
        QuestionAnswer wrongAction = ans();
        wrongAction.setFirewallAnswer(List.of(
                Map.of("Source", "Any", "Service", "HTTPS (443)", "Action", "Allow"),
                Map.of("Source", "Any", "Service", "Any", "Action", "Allow")));  // last should be Deny
        QuestionAnswer tooFew = ans();
        tooFew.setFirewallAnswer(List.of(Map.of("Source", "Any", "Service", "Any", "Action", "Deny")));

        assertThat(exam.checkAnswer(q, right)).isTrue();
        assertThat(exam.checkAnswer(q, wrongAction)).isFalse();
        assertThat(exam.checkAnswer(q, tooFew)).isFalse();
    }

    @Test
    void gradesConfigForm() {
        Question q = q(Question.QuestionType.CONFIG_FORM);
        Question.ConfigField f1 = new Question.ConfigField();
        f1.setGroup("Gateway A — Phase 1"); f1.setLabel("Encryption");
        f1.setOptions(List.of("DES", "3DES", "AES-256")); f1.setCorrect("AES-256");
        Question.ConfigField f2 = new Question.ConfigField();
        f2.setGroup("Gateway A — Phase 1"); f2.setLabel("Authentication");
        f2.setOptions(List.of("Pre-shared key", "Certificates")); f2.setCorrect("Certificates");
        q.setConfigFields(List.of(f1, f2));

        QuestionAnswer right = ans(); right.setConfigAnswer(List.of("aes-256", "Certificates")); // case-insensitive
        QuestionAnswer wrong = ans(); wrong.setConfigAnswer(List.of("AES-256", "Pre-shared key"));
        QuestionAnswer tooFew = ans(); tooFew.setConfigAnswer(List.of("AES-256"));

        assertThat(exam.checkAnswer(q, right)).isTrue();
        assertThat(exam.checkAnswer(q, wrong)).isFalse();
        assertThat(exam.checkAnswer(q, tooFew)).isFalse();
        assertThat(exam.checkAnswer(q, ans())).isFalse();   // no answer at all
    }

    @Test
    void gradesLogAnalysisLikeMultipleChoice() throws Exception {
        Question q = q(Question.QuestionType.LOG_ANALYSIS);
        setCorrect(q, "A");
        QuestionAnswer right = ans(); right.setSelectedAnswer("A");
        QuestionAnswer wrong = ans(); wrong.setSelectedAnswer("C");
        assertThat(exam.checkAnswer(q, right)).isTrue();
        assertThat(exam.checkAnswer(q, wrong)).isFalse();
    }

    @Test
    void scoresAndPassesAtSeventyFivePercent() throws Exception {
        Question a = mc("a", "A"), b = mc("b", "B"), c = mc("c", "C"), d = mc("d", "D");
        List<Question> questions = List.of(a, b, c, d);

        // Stub services (no Mockito): content returns our questions; progress is a no-op.
        ContentService content = new ContentService(null, null, null) {
            @Override public List<Question> getSectionExamQuestions(String id) { return questions; }
        };
        ProgressService progress = new ProgressService(null, null) {
            @Override public void recordExamAttempt(Long userId, String sectionId, double score, boolean passed) { }
        };
        ExamService svc = new ExamService(content, progress);

        ExamSubmission sub = new ExamSubmission();
        sub.setSectionId("1.1");
        sub.setExamType("SECTION");
        sub.setAnswers(List.of(
                pick("a", "A"), pick("b", "B"), pick("c", "C"), pick("d", "X")));  // 3 of 4 right

        ExamResult r = svc.gradeExam(sub, 1L);
        assertThat(r.getTotalQuestions()).isEqualTo(4);
        assertThat(r.getCorrectAnswers()).isEqualTo(3);
        assertThat(r.getScorePercent()).isEqualTo(75.0);
        assertThat(r.isPassed()).isTrue();
    }

    private Question mc(String id, String correct) throws Exception {
        Question q = new Question();
        q.setId(id);
        q.setType(Question.QuestionType.MULTIPLE_CHOICE);
        q.setDomainId("domain1");
        q.setDifficulty("Medium");
        q.setCorrectAnswer(mapper.readTree("\"" + correct + "\""));
        return q;
    }

    private QuestionAnswer pick(String id, String letter) {
        QuestionAnswer a = new QuestionAnswer();
        a.setQuestionId(id);
        a.setSelectedAnswer(letter);
        return a;
    }
}
