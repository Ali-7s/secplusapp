package com.comptia.securityplus.service;

import com.comptia.securityplus.model.ExamResult;
import com.comptia.securityplus.model.ExamSubmission;
import com.comptia.securityplus.model.Question;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class ExamService {

    private final ContentService contentService;
    private final ProgressService progressService;

    public ExamService(ContentService contentService, ProgressService progressService) {
        this.contentService = contentService;
        this.progressService = progressService;
    }

    public ExamResult gradeExam(ExamSubmission submission, Long userId) {
        List<Question> questions;
        if ("FULL".equals(submission.getExamType())) {
            questions = contentService.getFullPracticeExam();
        } else {
            questions = contentService.getSectionExamQuestions(submission.getSectionId());
        }

        Map<String, Question> questionMap = new HashMap<>();
        for (Question q : questions) questionMap.put(q.getId(), q);

        List<ExamResult.QuestionResult> results = new ArrayList<>();
        int correct = 0;
        Map<String, Integer> domainBreakdown = new LinkedHashMap<>();
        Map<String, Integer> domainTotal = new LinkedHashMap<>();

        for (ExamSubmission.QuestionAnswer answer : submission.getAnswers()) {
            Question q = questionMap.get(answer.getQuestionId());
            if (q == null) continue;
            boolean isCorrect = checkAnswer(q, answer);
            if (isCorrect) correct++;
            String domainId = q.getDomainId() != null ? q.getDomainId() : "unknown";
            domainBreakdown.merge(domainId, isCorrect ? 1 : 0, Integer::sum);
            domainTotal.merge(domainId, 1, Integer::sum);
            results.add(new ExamResult.QuestionResult(
                    q.getId(), q.getStem(), describeYourAnswer(q, answer),
                    describeCorrectAnswer(q), isCorrect, q.getExplanation(), q.getDifficulty()));
        }

        int total = submission.getAnswers().size();
        double scorePercent = total > 0 ? (double) correct / total * 100 : 0;
        boolean passed = scorePercent >= 75.0;

        Map<String, Integer> domainScores = new LinkedHashMap<>();
        for (Map.Entry<String, Integer> e : domainBreakdown.entrySet()) {
            int tot = domainTotal.getOrDefault(e.getKey(), 1);
            domainScores.put(e.getKey(), (int) ((double) e.getValue() / tot * 100));
        }

        if (submission.getSectionId() != null) {
            progressService.recordExamAttempt(userId, submission.getSectionId(), scorePercent, passed);
        }

        return new ExamResult(
                submission.getSectionId(), submission.getExamType(),
                total, correct, scorePercent, passed, 75,
                submission.getTimeTakenSeconds(), results, domainScores,
                buildFeedback(scorePercent, passed, domainScores),
                buildNextSteps(scorePercent, passed, submission.getSectionId()));
    }

    // package-private for unit testing
    boolean checkAnswer(Question q, ExamSubmission.QuestionAnswer answer) {
        if (q.getType() == null) {
            return q.getCorrectAnswer() != null && q.getCorrectAnswer().equals(answer.getSelectedAnswer());
        }
        switch (q.getType()) {
            case MULTI_SELECT: {
                List<String> selected = answer.getSelectedAnswers() != null ? answer.getSelectedAnswers() : Collections.emptyList();
                List<String> correct = q.getCorrectAnswers() != null ? q.getCorrectAnswers() : Collections.emptyList();
                return !correct.isEmpty() && new HashSet<>(selected).equals(new HashSet<>(correct));
            }
            case DRAG_DROP:
            case NETWORK_PLACEMENT: {
                Map<String, String> correct = q.getCorrectPairs();
                if (correct == null || correct.isEmpty()) return false;
                Map<String, String> given = answer.getPairAnswers() != null ? answer.getPairAnswers() : Collections.emptyMap();
                return correct.entrySet().stream().allMatch(e -> e.getValue().equals(given.get(e.getKey())));
            }
            case ORDER_LIST:
                return q.getCorrectOrder() != null && !q.getCorrectOrder().isEmpty()
                        && q.getCorrectOrder().equals(answer.getOrderAnswer());
            case FIREWALL_RULES:
                return firewallMatches(q, answer.getFirewallAnswer());
            default: // MULTIPLE_CHOICE, SCENARIO, LOG_ANALYSIS
                return q.getCorrectAnswer() != null && q.getCorrectAnswer().equals(answer.getSelectedAnswer());
        }
    }

    private boolean firewallMatches(Question q, List<Map<String, String>> given) {
        List<Map<String, String>> correct = q.getCorrectRules();
        List<String> cols = q.getFirewallColumns();
        if (correct == null || correct.isEmpty() || cols == null || cols.isEmpty()) return false;
        if (given == null || given.size() != correct.size()) return false;
        for (int i = 0; i < correct.size(); i++) {
            Map<String, String> cr = correct.get(i);
            Map<String, String> gr = given.get(i);
            if (gr == null) return false;
            for (String col : cols) {
                String c = cr.getOrDefault(col, "").trim();
                String g = gr.getOrDefault(col, "").trim();
                if (!c.equalsIgnoreCase(g)) return false;
            }
        }
        return true;
    }

    /** Readable "your answer" string for the review screen, per question type. */
    private String describeYourAnswer(Question q, ExamSubmission.QuestionAnswer a) {
        Question.QuestionType t = q.getType();
        if (t == Question.QuestionType.ORDER_LIST) {
            return a.getOrderAnswer() != null ? String.join(" → ", a.getOrderAnswer()) : "Not answered";
        }
        if (t == Question.QuestionType.DRAG_DROP || t == Question.QuestionType.NETWORK_PLACEMENT) {
            return a.getPairAnswers() != null && !a.getPairAnswers().isEmpty() ? "(your matches — see below)" : "Not answered";
        }
        if (t == Question.QuestionType.FIREWALL_RULES) {
            return a.getFirewallAnswer() != null && !a.getFirewallAnswer().isEmpty() ? "(your ruleset — see below)" : "Not answered";
        }
        if (t == Question.QuestionType.MULTI_SELECT) {
            return a.getSelectedAnswers() != null ? String.join(", ", a.getSelectedAnswers()) : "Not answered";
        }
        return a.getSelectedAnswer() != null ? a.getSelectedAnswer() : "Not answered";
    }

    private String describeCorrectAnswer(Question q) {
        Question.QuestionType t = q.getType();
        if (t == Question.QuestionType.ORDER_LIST && q.getCorrectOrder() != null) {
            return String.join(" → ", q.getCorrectOrder());
        }
        if (t == Question.QuestionType.MULTI_SELECT && q.getCorrectAnswers() != null) {
            return String.join(", ", q.getCorrectAnswers());
        }
        if (t == Question.QuestionType.DRAG_DROP || t == Question.QuestionType.NETWORK_PLACEMENT
                || t == Question.QuestionType.FIREWALL_RULES) {
            return "See explanation";
        }
        return q.getCorrectAnswer() != null ? q.getCorrectAnswer() : "";
    }

    private String buildFeedback(double score, boolean passed, Map<String, Integer> domains) {
        if (passed) {
            if (score >= 90) return "Outstanding performance! You have mastered this section.";
            if (score >= 80) return "Great work! You're well prepared for this topic.";
            return "Good job! You've passed and can move to the next section.";
        }
        if (score >= 65) return "Almost there! Review the topics where you struggled and try again.";
        if (score >= 50) return "More review needed. Focus on the key concepts and retry.";
        return "This section needs significant study. Review the material thoroughly before retrying.";
    }

    private String buildNextSteps(double score, boolean passed, String sectionId) {
        if (passed) return "You've unlocked the next section. Continue your study journey!";
        return "Review the concept explanations and flashcards for this section, then reattempt the exam.";
    }
}
