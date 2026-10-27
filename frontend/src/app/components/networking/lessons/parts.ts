import { Block, LessonBody } from '../networking.model';

/** One screen of a lesson in step-by-step reading: a heading's worth of blocks. */
export interface LessonPart {
  title: string;
  tone?: 'secure';
  /** The one or two lines worth remembering from the part. */
  keep?: string;
  /** Why the part can wait for a second pass, when it can. */
  optional?: string;
  blocks: Block[];
  minutes: number;
  /** The first part holds the lesson's goals, recap and new words. */
  intro: boolean;
}

/**
 * Reading speed for someone meeting the material for the first time. Technical text with new words reads far
 * slower than a novel, and the estimate should leave room to think, not set a pace that makes a learner feel slow.
 */
const WORDS_PER_MINUTE = 110;

/** Extra minutes for blocks you work through rather than read. */
const HANDS_ON: Partial<Record<Block['type'], number>> = { pbq: 5, pbqs: 6, layers: 3, cidr: 3, sequence: 2, spot: 3, harden: 1 };

function words(value: unknown): number {
  if (typeof value === 'string') return value.split(/\s+/).filter(Boolean).length;
  if (Array.isArray(value)) return value.reduce((n, v) => n + words(v), 0);
  if (value && typeof value === 'object') {
    return Object.entries(value).reduce((n, [k, v]) => n + (k === 'type' || k === 'question' ? 0 : words(v)), 0);
  }
  return 0;
}

/** Minutes to work through some blocks: reading time plus time for the hands-on ones. */
export function estimateMinutes(blocks: Block[]): number {
  const reading = blocks.reduce((n, b) => n + (b.type === 'pbq' || b.type === 'pbqs' ? 0 : words(b)), 0) / WORDS_PER_MINUTE;
  const doing = blocks.reduce((n, b) => n + (HANDS_ON[b.type] ?? 0), 0);
  return Math.max(1, Math.round(reading + doing));
}

/** Splits a lesson at its headings. Everything before the first heading becomes the "Before you start" part. */
export function lessonParts(lesson: LessonBody): LessonPart[] {
  const parts: LessonPart[] = [{ title: 'Before you start', blocks: [], minutes: 0, intro: true }];
  for (const b of lesson.blocks) {
    if (b.type === 'h') parts.push({ title: b.text, tone: b.tone, keep: b.keep, optional: b.optional, blocks: [], minutes: 0, intro: false });
    else parts[parts.length - 1].blocks.push(b);
  }
  for (const part of parts) {
    // New-word lists are looked up, not read through, so they do not add reading time.
    part.minutes = estimateMinutes(part.blocks.filter(b => !(b.type === 'table' && b.words)));
  }
  return parts;
}

/** Minutes for the self-check at the end. */
export const checkMinutes = (lesson: LessonBody) => Math.max(1, Math.round(lesson.check.length * 0.75));

/** The whole lesson's time, with the optional parts counted separately. */
export function lessonMinutes(lesson: LessonBody): { core: number; optional: number } {
  const parts = lessonParts(lesson);
  return {
    core: parts.filter(p => !p.optional).reduce((n, p) => n + p.minutes, 0) + checkMinutes(lesson),
    optional: parts.filter(p => p.optional).reduce((n, p) => n + p.minutes, 0),
  };
}
