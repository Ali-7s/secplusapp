import { Injectable } from '@angular/core';
import { Question, QuestionAnswer, ExamResult, QuestionResult } from '../models/question.model';

const PASSING_PERCENT = 75.0;

@Injectable({ providedIn: 'root' })
export class ExamGradingService {

  gradeExam(questions: Question[], answers: QuestionAnswer[], timeTakenSeconds: number): ExamResult {
    const questionMap = new Map(questions.map(q => [q.id, q]));
    const results: QuestionResult[] = [];
    let correct = 0;
    const domainCorrect: Record<string, number> = {};
    const domainTotal: Record<string, number> = {};

    for (const answer of answers) {
      const q = questionMap.get(answer.questionId);
      if (!q) continue;
      const isCorrect = this.checkAnswer(q, answer);
      if (isCorrect) correct++;
      const domainId = q.domainId || 'unknown';
      domainCorrect[domainId] = (domainCorrect[domainId] ?? 0) + (isCorrect ? 1 : 0);
      domainTotal[domainId] = (domainTotal[domainId] ?? 0) + 1;
      results.push({
        questionId: q.id,
        stem: q.stem,
        selectedAnswer: this.describeYourAnswer(q, answer),
        correctAnswer: this.describeCorrectAnswer(q),
        correct: isCorrect,
        explanation: q.explanation,
        difficulty: q.difficulty,
      });
    }

    const total = answers.length;
    const scorePercent = total > 0 ? (correct / total) * 100 : 0;
    const passed = scorePercent >= PASSING_PERCENT;

    const domainBreakdown: Record<string, number> = {};
    for (const domainId of Object.keys(domainCorrect)) {
      domainBreakdown[domainId] = Math.round((domainCorrect[domainId] / (domainTotal[domainId] || 1)) * 100);
    }

    return {
      sectionId: '',
      examType: 'FULL',
      totalQuestions: total,
      correctAnswers: correct,
      scorePercent,
      passed,
      passingScore: PASSING_PERCENT,
      timeTakenSeconds,
      results,
      domainBreakdown,
      feedback: this.buildFeedback(scorePercent, passed),
      nextSteps: this.buildNextSteps(passed),
    };
  }

  private checkAnswer(q: Question, answer: QuestionAnswer): boolean {
    switch (q.type) {
      case 'MULTI_SELECT': {
        const selected = new Set(answer.selectedAnswers ?? []);
        const correctSet = new Set(q.correctAnswers ?? []);
        return correctSet.size > 0 && selected.size === correctSet.size && [...correctSet].every(c => selected.has(c));
      }
      case 'DRAG_DROP':
      case 'NETWORK_PLACEMENT': {
        const correctPairs = q.correctPairs ?? {};
        if (Object.keys(correctPairs).length === 0) return false;
        const given = answer.pairAnswers ?? {};
        return Object.entries(correctPairs).every(([k, v]) => given[k] === v);
      }
      case 'ORDER_LIST':
        return !!q.correctOrder?.length && JSON.stringify(q.correctOrder) === JSON.stringify(answer.orderAnswer ?? []);
      case 'FIREWALL_RULES':
        return this.firewallMatches(q, answer.firewallAnswer);
      case 'CONFIG_FORM':
        return this.configMatches(q, answer.configAnswer);
      default: // MULTIPLE_CHOICE, SCENARIO, LOG_ANALYSIS
        return !!q.correctAnswer && q.correctAnswer === answer.selectedAnswer;
    }
  }

  private firewallMatches(q: Question, given?: Record<string, string>[]): boolean {
    const correct = q.correctRules, cols = q.firewallColumns;
    if (!correct?.length || !cols?.length) return false;
    if (!given || given.length !== correct.length) return false;
    for (let i = 0; i < correct.length; i++) {
      const gr = given[i];
      if (!gr) return false;
      for (const col of cols) {
        if ((correct[i][col] ?? '').trim().toLowerCase() !== (gr[col] ?? '').trim().toLowerCase()) return false;
      }
    }
    return true;
  }

  private configMatches(q: Question, given?: string[]): boolean {
    const fields = q.configFields;
    if (!fields?.length || !given || given.length !== fields.length) return false;
    return fields.every((f, i) => !!f.correct && !!given[i] && f.correct.trim().toLowerCase() === given[i].trim().toLowerCase());
  }

  private describeYourAnswer(q: Question, a: QuestionAnswer): string {
    switch (q.type) {
      case 'ORDER_LIST':
        return a.orderAnswer?.length ? a.orderAnswer.join(' → ') : 'Not answered';
      case 'DRAG_DROP':
      case 'NETWORK_PLACEMENT':
        return a.pairAnswers && Object.keys(a.pairAnswers).length ? '(your matches — see below)' : 'Not answered';
      case 'FIREWALL_RULES':
        return a.firewallAnswer?.length ? '(your ruleset — see below)' : 'Not answered';
      case 'CONFIG_FORM':
        return a.configAnswer?.length ? '(your configuration — see explanation)' : 'Not answered';
      case 'MULTI_SELECT':
        return a.selectedAnswers?.length ? a.selectedAnswers.join(', ') : 'Not answered';
      default:
        return a.selectedAnswer ?? 'Not answered';
    }
  }

  private describeCorrectAnswer(q: Question): string {
    if (q.type === 'ORDER_LIST' && q.correctOrder) return q.correctOrder.join(' → ');
    if (q.type === 'MULTI_SELECT' && q.correctAnswers) return q.correctAnswers.join(', ');
    if (['DRAG_DROP', 'NETWORK_PLACEMENT', 'FIREWALL_RULES', 'CONFIG_FORM'].includes(q.type)) return 'See explanation';
    return q.correctAnswer ?? '';
  }

  private buildFeedback(score: number, passed: boolean): string {
    if (passed) {
      if (score >= 90) return 'Outstanding performance! You have mastered this material.';
      if (score >= 80) return "Great work! You're well prepared for the exam.";
      return "Good job! You've passed — you're ready for exam day.";
    }
    if (score >= 65) return 'Almost there! Review the topics where you struggled and try again.';
    if (score >= 50) return 'More review needed. Focus on the key concepts and retry.';
    return 'This needs significant study. Review the material thoroughly before retrying.';
  }

  private buildNextSteps(passed: boolean): string {
    return passed
      ? 'Keep your skills sharp with another attempt, and review any domain you scored below 80% on.'
      : 'Review the explanations below, focus on your weakest domains, then retake the exam.';
  }
}
