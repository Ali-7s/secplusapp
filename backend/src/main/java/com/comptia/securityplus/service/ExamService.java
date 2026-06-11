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
                    q.getId(), q.getStem(), answer.getSelectedAnswer(),
                    q.getCorrectAnswer(), isCorrect, q.getExplanation(), q.getDifficulty()));
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

    private boolean checkAnswer(Question q, ExamSubmission.QuestionAnswer answer) {
        if (q.getType() == Question.QuestionType.MULTI_SELECT) {
            List<String> selected = answer.getSelectedAnswers() != null ? answer.getSelectedAnswers() : Collections.emptyList();
            List<String> correct = q.getCorrectAnswers() != null ? q.getCorrectAnswers() : Collections.emptyList();
            return new HashSet<>(selected).equals(new HashSet<>(correct));
        }
        return q.getCorrectAnswer() != null && q.getCorrectAnswer().equals(answer.getSelectedAnswer());
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
