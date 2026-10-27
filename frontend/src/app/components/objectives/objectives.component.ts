import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { forkJoin } from 'rxjs';
import { ContentService } from '../../services/content.service';
import { ProgressService, cardKey } from '../../services/progress.service';
import { DOMAIN_NAMES, ExamDomain, OBJECTIVE_NAMES } from '../../models/exam.model';
import { OBJECTIVE_OUTLINES } from '../../content/objectives';
import {
  CoverageQuestion, ExamObjective, GlossaryCard, ObjectiveTopic, TopicCoverage, buildObjectives, collectText, glossaryIndex,
  normalize, objectiveCoverage,
} from '../../utils/coverage';
import { isMature } from '../../utils/srs';

/** CompTIA's weighting of each domain on the exam. */
const DOMAIN_WEIGHTS: Record<ExamDomain, number> = { 1: 12, 2: 22, 3: 18, 4: 28, 5: 20 };

type CardState = 'new' | 'learning' | 'young' | 'mature';

interface TopicRow {
  depth: number;
  name: string;
  /** Leaf rows carry their coverage; headings do not. */
  cov?: TopicCoverage;
}

interface ObjectiveView {
  id: string;
  domain: ExamDomain;
  name: string;
  title: string;
  rows: TopicRow[];
  topics: number;
  questionCount: number;
  cards: GlossaryCard[];
}

/**
 * Every SY0-701 objective with every topic CompTIA lists under it, each linked to the glossary cards that teach
 * it and counted against the practice questions that test it, plus how far you have got with each objective.
 */
@Component({
  selector: 'app-objectives',
  standalone: true,
  imports: [RouterLink, MatButtonModule, MatIconModule],
  templateUrl: './objectives.component.html',
  styleUrl: './objectives.component.scss',
})
export class ObjectivesComponent implements OnInit {
  private content = inject(ContentService);
  readonly progress = inject(ProgressService);

  readonly domains = [1, 2, 3, 4, 5] as ExamDomain[];
  readonly domainNames = DOMAIN_NAMES;
  readonly weights = DOMAIN_WEIGHTS;

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly domain = signal<ExamDomain | null>(null);
  readonly search = signal('');
  private readonly views = signal<ObjectiveView[]>([]);
  /** Question ids per objective, for your accuracy on it. */
  private readonly questionIds = signal<Record<string, string[]>>({});

  ngOnInit() {
    forkJoin([this.content.getAcronyms(), this.content.getTerms(), this.content.getPracticeExam()]).subscribe({
      next: ([acronyms, terms, pool]) => {
        const cards: GlossaryCard[] = [
          ...acronyms.map(a => ({ kind: 'acr' as const, name: a.acronym, expansion: a.expansion })),
          ...terms.map(t => ({ kind: 'term' as const, name: t.term })),
        ];
        const index = glossaryIndex(cards);
        const questions: CoverageQuestion[] = pool.map(q => ({ id: q.id, objective: q.objective, text: normalize(collectText(q)) }));
        const ids: Record<string, string[]> = {};
        for (const q of pool) (ids[q.objective] ??= []).push(q.id);
        this.questionIds.set(ids);
        this.views.set(buildObjectives(OBJECTIVE_OUTLINES).map(o => this.view(o, objectiveCoverage(o, index, questions), ids[o.id]?.length ?? 0)));
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  private view(o: ExamObjective, coverage: TopicCoverage[], questionCount: number): ObjectiveView {
    const byPath = new Map(coverage.map(c => [c.path, c]));
    const rows: TopicRow[] = [];
    const walk = (topics: ObjectiveTopic[], path: string[]) => {
      for (const t of topics) {
        const here = [...path, t.name];
        rows.push({ depth: path.length, name: t.name, cov: t.sub?.length ? undefined : byPath.get(here.join(' > ')) });
        if (t.sub?.length) walk(t.sub, here);
      }
    };
    walk(o.topics, []);
    const cards: GlossaryCard[] = [];
    for (const c of coverage.flatMap(t => t.cards)) if (!cards.includes(c)) cards.push(c);
    return {
      id: o.id, domain: o.domain as ExamDomain, name: OBJECTIVE_NAMES[o.id] ?? o.id, title: o.title,
      rows, topics: coverage.length, questionCount, cards,
    };
  }

  // ── Filtering ───────────────────────────────────────────────────────────

  /** Objectives in the chosen domain, with rows narrowed to topics matching the search (and their headings). */
  readonly shown = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.views()
      .filter(v => this.domain() === null || v.domain === this.domain())
      .map(v => {
        if (!q) return v;
        if (v.name.toLowerCase().includes(q) || v.title.toLowerCase().includes(q) || v.id === q) return v;
        const keep = new Set<number>();
        v.rows.forEach((r, i) => {
          const hit = r.name.toLowerCase().includes(q) || r.cov?.cards.some(c => c.name.toLowerCase().includes(q));
          if (!hit) return;
          keep.add(i);
          // Keep the headings above a match so it reads in context.
          let depth = r.depth;
          for (let j = i - 1; j >= 0 && depth > 0; j--) if (v.rows[j].depth < depth) { keep.add(j); depth = v.rows[j].depth; }
        });
        return keep.size ? { ...v, rows: v.rows.filter((_, i) => keep.has(i)) } : null;
      })
      .filter((v): v is ObjectiveView => !!v);
  });

  setDomain(d: ExamDomain | null) { this.domain.set(d); }
  onSearch(event: Event) { this.search.set((event.target as HTMLInputElement).value); }

  // ── Coverage and your progress ──────────────────────────────────────────

  readonly totals = computed(() => {
    const leaves = this.views().flatMap(v => v.rows.filter(r => r.cov).map(r => r.cov!));
    return {
      topics: leaves.length,
      covered: leaves.filter(c => c.status === 'covered').length,
      cardOnly: leaves.filter(c => c.status === 'partial' && c.cards.length).length,
      questionOnly: leaves.filter(c => c.status === 'partial' && !c.cards.length).length,
    };
  });

  /** Your record on one objective: questions answered and how often right, and its cards studied. */
  stats(v: ObjectiveView) {
    const answered = this.progress.data().questions;
    let seen = 0, right = 0, distinct = 0;
    for (const id of this.questionIds()[v.id] ?? []) {
      const r = answered[id];
      if (!r) continue;
      distinct++;
      seen += r.seen;
      right += r.right;
    }
    const states = v.cards.map(c => this.cardState(c));
    return {
      distinct,
      rate: seen ? Math.round((right / seen) * 100) : null,
      studied: states.filter(s => s !== 'new').length,
      mature: states.filter(s => s === 'mature').length,
      cards: v.cards.length,
    };
  }

  readonly testedCount = computed(() => {
    this.progress.data();
    return this.views().filter(v => this.stats(v).distinct > 0).length;
  });

  cardState(c: GlossaryCard): CardState {
    const r = this.progress.data().cards[cardKey(c.kind, c.name)];
    if (!r) return 'new';
    if (r.state !== 'review') return 'learning';
    return isMature(r) ? 'mature' : 'young';
  }

  stateLabel(state: CardState): string {
    return { new: 'not studied yet', learning: 'learning', young: 'studied', mature: 'mature (well learned)' }[state];
  }

  cardLink(c: GlossaryCard): string { return c.kind === 'acr' ? '/acronyms' : '/terms'; }

  trackRow(i: number, r: TopicRow) { return `${i}:${r.name}`; }
}
