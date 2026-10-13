/**
 * Guards the Quick Check questions on every card (public/data/acronyms.json and terms.json).
 *
 * The questions follow the exam style: a scenario stem that asks for the BEST answer, three plausible
 * distractors, and a short explanation shown after answering. These tests keep the format intact and keep the
 * answer key from drifting toward a pattern a learner could game (always the same letter, always the longest option).
 */
interface QuizCard {
  detail: {
    quizQuestion: string;
    quizOptions: string[];
    quizAnswer: string;
    explanation?: string;
  };
  [field: string]: unknown;
}

describe('quick check questions', () => {
  const decks = [
    { deck: 'acronyms', key: 'acronym' },
    { deck: 'terms', key: 'term' },
  ] as const;

  const letters = ['A', 'B', 'C', 'D'];
  const wordCount = (text: string) => text.trim().split(/\s+/).length;
  const textOf = (option: string) => option.slice(3);

  for (const { deck, key } of decks) {
    describe(deck, () => {
      let cards: QuizCard[];
      const nameOf = (card: QuizCard) => String(card[key]);

      beforeAll(async () => {
        const response = await fetch(`/data/${deck}.json`);
        expect(response.ok).toBeTrue();
        cards = (await response.json()) as QuizCard[];
      });

      it('gives every card four lettered options and a valid answer', () => {
        const problems: string[] = [];
        for (const card of cards) {
          const { quizOptions, quizAnswer } = card.detail;
          if (!Array.isArray(quizOptions) || quizOptions.length !== 4) {
            problems.push(`${nameOf(card)}: ${quizOptions?.length} options`);
            continue;
          }
          quizOptions.forEach((option, i) => {
            if (!option.startsWith(`${letters[i]}) `)) problems.push(`${nameOf(card)}: option ${i + 1} is not labelled ${letters[i]})`);
          });
          if (!letters.includes(quizAnswer)) problems.push(`${nameOf(card)}: answer "${quizAnswer}"`);
        }
        expect(problems).toEqual([]);
      });

      it('asks a question in a scenario sized stem', () => {
        const problems: string[] = [];
        for (const card of cards) {
          const stem = card.detail.quizQuestion;
          if (!stem.trim().endsWith('?')) problems.push(`${nameOf(card)}: stem is not a question`);
          if (wordCount(stem) < 14 || wordCount(stem) > 100) problems.push(`${nameOf(card)}: stem has ${wordCount(stem)} words`);
        }
        expect(problems).toEqual([]);
      });

      it('keeps the options distinct and free of cross references', () => {
        const banned = /\b(all of the above|none of the above|both a and b|a and b|b and c|a and c|the above|option [a-d]|answer [a-d])\b/i;
        const problems: string[] = [];
        for (const card of cards) {
          const texts = card.detail.quizOptions.map(textOf);
          if (new Set(texts.map(text => text.toLowerCase())).size !== texts.length) problems.push(`${nameOf(card)}: repeated option`);
          for (const text of texts) {
            if (banned.test(text)) problems.push(`${nameOf(card)}: refers to another option "${text}"`);
            if (text.endsWith('.')) problems.push(`${nameOf(card)}: option ends with a period "${text}"`);
          }
        }
        expect(problems).toEqual([]);
      });

      it('explains every answer in a few sentences', () => {
        const problems: string[] = [];
        for (const card of cards) {
          const explanation = card.detail.explanation ?? '';
          if (wordCount(explanation) < 8 || wordCount(explanation) > 90) problems.push(`${nameOf(card)}: explanation has ${explanation ? wordCount(explanation) : 0} words`);
        }
        expect(problems).toEqual([]);
      });

      it('avoids dashes in the question, options and explanation', () => {
        const dash = /[–—]|\s-\s/;
        const problems: string[] = [];
        for (const card of cards) {
          const { quizQuestion, quizOptions, explanation } = card.detail;
          if (dash.test([quizQuestion, ...quizOptions.map(textOf), explanation ?? ''].join(' '))) problems.push(nameOf(card));
        }
        expect(problems).toEqual([]);
      });

      it('spreads the correct answer evenly across the four letters', () => {
        const tally: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
        for (const card of cards) tally[card.detail.quizAnswer]++;
        for (const letter of letters) {
          const share = tally[letter] / cards.length;
          expect(share).withContext(`Letter ${letter} is correct ${(share * 100).toFixed(1)}% of the time`).toBeGreaterThan(0.2);
          expect(share).withContext(`Letter ${letter} is correct ${(share * 100).toFixed(1)}% of the time`).toBeLessThan(0.3);
        }
      });

      it('does not make the correct option the longest one too often', () => {
        let longest = 0;
        for (const card of cards) {
          const lengths = card.detail.quizOptions.map(option => textOf(option).length);
          const correct = lengths[letters.indexOf(card.detail.quizAnswer)];
          if (correct === Math.max(...lengths) && lengths.filter(length => length === correct).length === 1) longest++;
        }
        const share = longest / cards.length;
        expect(share).withContext(`The correct option is strictly the longest in ${(share * 100).toFixed(1)}% of questions`).toBeLessThan(0.32);
      });
    });
  }
});
