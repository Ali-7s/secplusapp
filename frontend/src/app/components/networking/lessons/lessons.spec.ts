import { Block } from '../networking.model';
import { mcq } from './dsl';
import { LESSON_META, lessonBySlug, lessonsForCard } from './lesson-index';
import { LESSON_BODIES, getLesson } from './lessons';

describe('mcq', () => {
  it('keeps the right answer pointing at the right option', () => {
    const q = mcq('Which?', 'right', ['a', 'b', 'c'], 'because');
    expect(q.options.length).toBe(4);
    expect(q.options[q.answer]).toBe('right');
  });

  it('shuffles the same way every time', () => {
    const first = mcq('Same question', 'right', ['a', 'b', 'c'], 'x').options;
    const second = mcq('Same question', 'right', ['a', 'b', 'c'], 'x').options;
    expect(first).toEqual(second);
  });

  it('does not always put the right answer in the same slot', () => {
    const slots = new Set<number>();
    for (let i = 0; i < 40; i++) slots.add(mcq(`Question number ${i}`, 'right', ['a', 'b', 'c'], 'x').answer);
    expect(slots.size).toBeGreaterThan(2);
  });
});

describe('lesson list', () => {
  it('numbers the lessons 1..n in order with unique slugs', () => {
    expect(LESSON_META.map(l => l.number)).toEqual(LESSON_META.map((_, i) => i + 1));
    expect(new Set(LESSON_META.map(l => l.slug)).size).toBe(LESSON_META.length);
  });

  it('has a body for every lesson and none left over', () => {
    expect(Object.keys(LESSON_BODIES).sort()).toEqual(LESSON_META.map(l => l.slug).sort());
    for (const meta of LESSON_META) expect(getLesson(meta.slug)?.title).toBe(meta.title);
  });

  it('returns nothing for an unknown lesson', () => {
    expect(getLesson('nope')).toBeUndefined();
    expect(getLesson(null)).toBeUndefined();
    expect(lessonBySlug('nope')).toBeUndefined();
  });

  it('can find the lessons for a flashcard', () => {
    expect(lessonsForCard('acr', 'VLAN').map(l => l.slug)).toContain('vlans');
    expect(lessonsForCard('term', 'Hardening').map(l => l.slug)).toContain('hardening');
    expect(lessonsForCard('acr', 'No such card')).toEqual([]);
  });

  it('points a card at the lesson it is mainly about first', () => {
    const first = (kind: 'acr' | 'term', name: string) => lessonsForCard(kind, name)[0]?.slug;
    expect(first('acr', 'VLAN')).toBe('vlans');
    expect(first('acr', 'DNS')).toBe('helpers');
    expect(first('acr', 'ARP')).toBe('helpers');
    expect(first('acr', 'TCP')).toBe('ports-tcp-udp');
    expect(first('term', 'Hardening')).toBe('hardening');
    expect(first('term', 'Firewall')).toBe('security-devices');
    expect(first('term', 'Port security')).toBe('devices');
    expect(first('term', 'DNS poisoning')).toBe('helpers');
    expect(first('term', 'ARP poisoning')).toBe('helpers');
    expect(first('term', 'Switch')).toBe('devices');
    expect(first('term', 'Router')).toBe('devices');
    expect(first('term', 'Subnet')).toBe('addresses');
    expect(first('term', 'Default gateway')).toBe('addresses');
    expect(first('term', 'Network port')).toBe('ports-tcp-udp');
    expect(first('term', 'Three-way handshake')).toBe('ports-tcp-udp');
    expect(first('term', 'Trunk port')).toBe('vlans');
    expect(first('term', 'Encapsulation')).toBe('layers');
    expect(first('term', 'Screened subnet')).toBe('security-devices');
    expect(first('term', 'Stateful inspection')).toBe('security-devices');
    expect(first('term', 'Network segmentation')).toBe('vlans');
    expect(first('acr', 'NAC')).toBe('vlans');
    expect(lessonsForCard('acr', 'TLS').map(l => l.slug)).toContain('web-request');
  });

  it('never lets the capstone outrank the lesson a card belongs to', () => {
    for (const l of LESSON_META.filter(m => m.slug !== 'web-request')) {
      for (const card of l.related.slice(0, l.focus)) {
        expect(lessonsForCard(card.kind, card.name)[0].slug).withContext(`${card.name} in ${l.slug}`).not.toBe('web-request');
      }
    }
  });

  it('gives every lesson a summary, an icon, a duration and related cards without repeats', () => {
    for (const l of LESSON_META) {
      expect(l.summary.length).withContext(l.slug).toBeGreaterThan(30);
      expect(l.icon).withContext(l.slug).toBeTruthy();
      expect(l.minutes).withContext(l.slug).toBeGreaterThan(0);
      expect(l.related.length).withContext(l.slug).toBeGreaterThan(3);
      expect(l.focus).withContext(l.slug + ' focus').toBeLessThanOrEqual(l.related.length);
      const keys = l.related.map(r => r.kind + ':' + r.name);
      expect(new Set(keys).size).withContext(l.slug + ' related cards').toBe(keys.length);
    }
  });
});

describe('lesson content', () => {
  const eachBlock = (visit: (lesson: string, block: Block) => void) => {
    for (const slug of Object.keys(LESSON_BODIES)) for (const b of LESSON_BODIES[slug].blocks) visit(slug, b);
  };

  it('has goals and a self-check of three or four good questions', () => {
    for (const [slug, body] of Object.entries(LESSON_BODIES)) {
      expect(body.goals.length).withContext(slug).toBeGreaterThanOrEqual(3);
      expect(body.check.length).withContext(slug).toBeGreaterThanOrEqual(3);
      expect(body.check.length).withContext(slug).toBeLessThanOrEqual(5);
      for (const q of body.check) {
        expect(q.options.length).withContext(q.question).toBe(4);
        expect(new Set(q.options).size).withContext(q.question).toBe(4);
        expect(q.answer).withContext(q.question).toBeGreaterThanOrEqual(0);
        expect(q.answer).withContext(q.question).toBeLessThan(4);
        expect(q.explanation.length).withContext(q.question).toBeGreaterThan(20);
        // options are reordered, so none may point at another one
        for (const o of q.options) expect(/\b(all|none) of the above\b|\bboth [a-d]\b/i.test(o)).withContext(o).toBeFalse();
      }
    }
  });

  it('opens every lesson with its new words, and reminds later lessons what they build on', () => {
    for (const [slug, body] of Object.entries(LESSON_BODIES)) {
      const glossary = body.blocks.find(b => b.type === 'table' && b.columns[0] === 'Word');
      expect(glossary).withContext(`${slug} has a new words table`).toBeTruthy();
      expect(body.blocks.indexOf(glossary!)).withContext(`${slug} lists its words near the top`).toBeLessThan(3);
      if (slug !== 'start') {
        expect(body.blocks[0].type === 'callout' && body.blocks[0].title === 'From earlier lessons').withContext(`${slug} starts with a recap`).toBeTrue();
      }
    }
  });

  it('gives every guided PBQ a complete answer key with a reason for every part', () => {
    const words = (t: string) => t.trim().split(/\s+/).length;
    eachBlock((slug, b) => {
      if (b.type !== 'pbq') return;
      const q = b.question;
      expect(words(q.takeaway)).withContext(`${slug} ${q.id} takeaway`).toBeGreaterThanOrEqual(8);
      if (q.kind === 'firewall') {
        expect(q.rows.length).withContext(q.id).toBe(q.requirements.length);
        expect(b.given ?? 0).withContext(q.id).toBeLessThan(q.rows.length);
        q.rows.forEach((row, r) => {
          for (const c of q.columns) expect(q.choices[c]).withContext(`${q.id} rule ${r + 1} ${c}`).toContain(row.answer[c]);
          expect(words(row.why)).withContext(`${q.id} rule ${r + 1}`).toBeGreaterThanOrEqual(8);
        });
      } else if (q.kind === 'match') {
        for (const p of q.prompts) {
          expect(p.choices ?? q.choices ?? []).withContext(`${q.id}: ${p.label}`).toContain(p.answer);
          expect(words(p.why)).withContext(`${q.id}: ${p.label}`).toBeGreaterThanOrEqual(8);
        }
      } else {
        expect(q.items.length).withContext(q.id).toBeGreaterThanOrEqual(4);
        for (const it of q.items) expect(words(it.why)).withContext(`${q.id}: ${it.text}`).toBeGreaterThanOrEqual(8);
      }
    });
  });

  it('gives the firewall lesson a guided rule table to fill in', () => {
    expect(LESSON_BODIES['security-devices'].blocks.some(b => b.type === 'pbq' && b.question.kind === 'firewall')).toBeTrue();
  });

  it('spreads the correct answers over the options', () => {
    const slots = new Set<number>();
    for (const body of Object.values(LESSON_BODIES)) for (const q of body.check) slots.add(q.answer);
    expect(slots.size).toBe(4);
  });

  it('builds every table with rows that match the columns', () => {
    eachBlock((slug, b) => {
      if (b.type !== 'table') return;
      expect(b.columns.length).withContext(slug).toBeGreaterThan(1);
      expect(b.rows.length).withContext(slug).toBeGreaterThan(0);
      for (const row of b.rows) expect(row.length).withContext(`${slug}: ${row[0]}`).toBe(b.columns.length);
      for (const i of b.mono ?? []) expect(i).withContext(slug).toBeLessThan(b.columns.length);
    });
  });

  it('gives every switch-port diagram a legend entry for each port group', () => {
    eachBlock((slug, b) => {
      if (b.type !== 'ports') return;
      const groups = new Set(b.legend.map(l => l.group));
      for (const c of b.cells) expect(groups.has(c.group)).withContext(`${slug}: port ${c.label}`).toBeTrue();
    });
  });

  it('gives walkthroughs, flows, checklists and exercises real content', () => {
    eachBlock((slug, b) => {
      if (b.type === 'sequence') {
        expect(b.steps.length).withContext(slug).toBeGreaterThanOrEqual(3);
        for (const s of b.steps) {
          expect(s.from && s.to && s.label && s.note).withContext(`${slug}: ${s.label}`).toBeTruthy();
          for (const snap of s.snapshots ?? []) expect(snap.fields.length).withContext(`${slug}: ${snap.label}`).toBeGreaterThan(0);
        }
      }
      if (b.type === 'flow') expect(b.nodes.length).withContext(slug).toBeGreaterThanOrEqual(2);
      if (b.type === 'nested') expect(b.layers.length).withContext(slug).toBeGreaterThanOrEqual(2);
      if (b.type === 'harden') {
        expect(b.items.length).withContext(slug).toBeGreaterThanOrEqual(4);
        for (const item of b.items) expect(item.action && item.why).withContext(`${slug}: ${item.action}`).toBeTruthy();
      }
      if (b.type === 'spot') {
        const issues = b.lines.filter(l => l.issue);
        expect(issues.length).withContext(slug).toBeGreaterThanOrEqual(3);
        for (const l of b.lines) expect(!!l.issue !== !!l.fine).withContext(`${slug}: ${l.text}`).toBeTrue();
      }
    });
  });

  it('teaches how to secure things: hardening has its own lesson and the device lessons have checklists', () => {
    const hasSecurity = (slug: string) => LESSON_BODIES[slug].blocks.some(b => b.type === 'harden' || (b.type === 'h' && b.tone === 'secure'));
    for (const slug of ['devices', 'vlans', 'helpers', 'security-devices', 'hardening']) expect(hasSecurity(slug)).withContext(slug).toBeTrue();
    expect(LESSON_BODIES['hardening'].blocks.some(b => b.type === 'spot')).toBeTrue();
  });
});
