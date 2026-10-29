/**
 * Syncing progress between devices. Each device keeps its own copy in localStorage and works offline; when sync is
 * on, the copies are combined (mergeSynced) and an encrypted copy is kept in the cloud under a sync code.
 *
 * The sync code is the only secret. It is turned into two things that cannot be worked back to it: the id of the
 * cloud document, and the key that encrypts it. The cloud only ever holds scrambled data, and without the code
 * nobody can find the document, let alone read it.
 */

import { dayKey } from './srs';
import { CARD_KINDS, CardKind, LessonRecord, ProgressData, parseProgress } from './progress';

/** When each card in a brain dump deck was rated, and when the deck was last cleared. */
export interface DeckTimes {
  cleared?: number;
  cards: Record<string, number>;
}

/** Brain dump ratings ("missed", "partly", "nailed") per deck and card, with when each was made. */
export interface SyncedBrainDump {
  ratings: Record<string, Record<string, string>>;
  times: Record<string, DeckTimes>;
}

/** Everything that syncs. Device preferences (theme, lesson view) and an exam in progress stay on each device. */
export interface SyncPayload {
  progress: ProgressData;
  braindump: SyncedBrainDump;
}

// ── Combining two copies ──────────────────────────────────────────────

const newer = <T extends { at: number }>(a: T | undefined, b: T | undefined): T | undefined =>
  !a ? b : !b ? a : b.at > a.at ? b : a;

/** The record with the later timestamp for every key in either map. */
function mergeByTime<T extends { at: number }>(a: Record<string, T>, b: Record<string, T>): Record<string, T> {
  const out: Record<string, T> = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = newer(out[k], v)!;
  return out;
}

const lessonTime = (l: LessonRecord) => l.at ?? Math.max(l.completedAt ?? 0, l.check?.at ?? 0);

function mergeLesson(a: LessonRecord | undefined, b: LessonRecord | undefined): LessonRecord {
  if (!a || !b) return (a ?? b)!;
  const [older, latest] = lessonTime(b) > lessonTime(a) ? [a, b] : [b, a];
  const pbqs = { ...older.pbqs };
  for (const [id, f] of Object.entries(latest.pbqs)) pbqs[id] = Math.max(pbqs[id] ?? 0, f);
  const done = [a.completedAt, b.completedAt].filter((t): t is number => t !== undefined);
  const out: LessonRecord = { ...older, ...latest, pbqs };
  if (a.work || b.work) out.work = mergeByTime(older.work ?? {}, latest.work ?? {});
  const check = newer(a.check, b.check);
  if (check) out.check = check;
  if (done.length) out.completedAt = Math.min(...done);
  return out;
}

/** Drops everything recorded before a reset, so a reset on one device is not undone by another device's old copy. */
function sinceReset(d: ProgressData, resetAt: number): ProgressData {
  if (!resetAt) return d;
  const keep = <T extends { at: number }>(m: Record<string, T>) => Object.fromEntries(Object.entries(m).filter(([, v]) => v.at >= resetAt));
  const resetDay = dayKey(resetAt);
  return {
    ...d,
    exams: d.exams.filter(e => e.at >= resetAt),
    questions: keep(d.questions),
    cards: keep(d.cards),
    lessons: Object.fromEntries(Object.entries(d.lessons).filter(([, l]) => lessonTime(l) >= resetAt)),
    days: Object.fromEntries(Object.entries(d.days).filter(([day]) => day >= resetDay)),
  };
}

/**
 * Combines two copies of the study progress so nothing studied on either device is lost: for each card, question
 * and lesson the most recent result wins, exams from both are kept, and settings come from whichever changed last.
 */
export function mergeProgress(a: ProgressData, b: ProgressData): ProgressData {
  const resetAt = Math.max(a.resetAt ?? 0, b.resetAt ?? 0);
  const x = sinceReset(a, resetAt), y = sinceReset(b, resetAt);

  const exams = [...x.exams];
  const seen = new Set(exams.map(e => `${e.at}|${e.length}|${e.scaled}`));
  for (const e of y.exams) if (!seen.has(`${e.at}|${e.length}|${e.scaled}`)) exams.push(e);
  exams.sort((p, q) => p.at - q.at);

  const lessons: Record<string, LessonRecord> = { ...x.lessons };
  for (const [slug, l] of Object.entries(y.lessons)) lessons[slug] = mergeLesson(lessons[slug], l);

  const days = { ...x.days };
  for (const [day, n] of Object.entries(y.days)) days[day] = Math.max(days[day] ?? 0, n);

  const settings = (y.settingsAt ?? 0) > (x.settingsAt ?? 0) ? y : x;
  const counts = x.review.day === y.review.day
    ? Object.fromEntries(CARD_KINDS.map(k => [k, Math.max(x.review.newToday[k], y.review.newToday[k])])) as Record<CardKind, number>
    : (x.review.day > y.review.day ? x : y).review.newToday;

  const out: ProgressData = {
    version: 1,
    exams,
    questions: mergeByTime(x.questions, y.questions),
    cards: mergeByTime(x.cards, y.cards),
    lessons,
    review: { newPerDay: settings.review.newPerDay, day: x.review.day > y.review.day ? x.review.day : y.review.day, newToday: { ...counts } },
    plan: { ...settings.plan },
    days,
  };
  const settingsAt = Math.max(x.settingsAt ?? 0, y.settingsAt ?? 0);
  if (settingsAt) out.settingsAt = settingsAt;
  if (resetAt) out.resetAt = resetAt;
  return out;
}

/**
 * Combines brain dump ratings card by card: the latest rating of each card wins, and a card rated before its deck
 * was cleared, or before all progress was reset, is dropped.
 */
export function mergeBrainDump(a: SyncedBrainDump, b: SyncedBrainDump, resetAt = 0): SyncedBrainDump {
  const out: SyncedBrainDump = { ratings: {}, times: {} };
  for (const deck of new Set([...Object.keys(a.ratings), ...Object.keys(b.ratings), ...Object.keys(a.times), ...Object.keys(b.times)])) {
    const ta = a.times[deck], tb = b.times[deck];
    const cleared = Math.max(ta?.cleared ?? 0, tb?.cleared ?? 0);
    const after = Math.max(cleared, resetAt);
    const ratings: Record<string, string> = {}, cards: Record<string, number> = {};
    for (const id of new Set([...Object.keys(a.ratings[deck] ?? {}), ...Object.keys(b.ratings[deck] ?? {})])) {
      const atA = a.ratings[deck]?.[id] !== undefined ? ta?.cards[id] ?? 0 : -1;
      const atB = b.ratings[deck]?.[id] !== undefined ? tb?.cards[id] ?? 0 : -1;
      const [rating, at] = atB > atA ? [b.ratings[deck][id], atB] : [a.ratings[deck][id], atA];
      if (after && at < after) continue;
      ratings[id] = rating;
      cards[id] = at;
    }
    out.ratings[deck] = ratings;
    out.times[deck] = cleared ? { cleared, cards } : { cards };
  }
  return out;
}

/** Combines two whole synced copies. */
export function mergeSynced(a: SyncPayload, b: SyncPayload): SyncPayload {
  const progress = mergeProgress(a.progress, b.progress);
  return { progress, braindump: mergeBrainDump(a.braindump, b.braindump, progress.resetAt) };
}

/** Reads a payload from the cloud defensively, the same way stored progress is read. */
export function parsePayload(value: unknown): SyncPayload {
  const v = (value && typeof value === 'object' ? value : {}) as Partial<SyncPayload>;
  const dump = (v.braindump && typeof v.braindump === 'object' ? v.braindump : {}) as Partial<SyncedBrainDump> & { at?: number };
  const ratings = dump.ratings && typeof dump.ratings === 'object' ? dump.ratings : {};
  let times = dump.times && typeof dump.times === 'object' ? dump.times : {};
  if (typeof dump.at === 'number' && !dump.times) {
    // The first sync build dated the ratings as a whole; give every card that date.
    const at = dump.at;
    times = Object.fromEntries(Object.entries(ratings).map(([deck, r]) => [deck, { cards: Object.fromEntries(Object.keys(r).map(id => [id, at])) }]));
  }
  return { progress: parseProgress(JSON.stringify(v.progress ?? null)), braindump: { ratings, times } };
}

/** JSON with object keys sorted, so two copies holding the same data compare equal whatever order they were built in. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).filter(([, v]) => v !== undefined).sort(([p], [q]) => (p < q ? -1 : p > q ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

// ── Sync codes ────────────────────────────────────────────────────────

/** Crockford's base 32: digits and capitals without I, L, O and U, so nothing is mistaken for something else. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const CODE_LENGTH = 12;

/** A new random sync code: 12 characters, 60 bits, shown as "K7P2-9XMA-QR4T". */
export function newSyncCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  return [...bytes].map(b => ALPHABET[b % 32]).join('');
}

/**
 * Reads a typed sync code, forgiving case, spaces, dashes and the look-alikes O (zero) and I or L (one).
 * Returns null when it cannot be a sync code.
 */
export function normalizeSyncCode(input: string): string | null {
  const code = input.toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  return code.length === CODE_LENGTH && [...code].every(c => ALPHABET.includes(c)) ? code : null;
}

export const formatSyncCode = (code: string) => code.match(/.{1,4}/g)?.join('-') ?? code;

// ── Encryption ────────────────────────────────────────────────────────

/** Slows down guessing codes against a stolen copy of the cloud data. */
const PBKDF2_ROUNDS = 210_000;
const SALT = new TextEncoder().encode('secplus-study-sync-v1');

export interface SyncKeys {
  /** The cloud document's name: 64 hex characters. */
  id: string;
  key: CryptoKey;
}

const hex = (bytes: Uint8Array) => [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');

/** Turns a sync code into the document id and the encryption key, the same way on every device. */
export async function deriveSyncKeys(code: string): Promise<SyncKeys> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(code), 'PBKDF2', false, ['deriveBits']);
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: SALT, iterations: PBKDF2_ROUNDS }, base, 512));
  const key = await crypto.subtle.importKey('raw', bits.slice(32), 'AES-GCM', false, ['encrypt', 'decrypt']);
  return { id: hex(bits.slice(0, 32)), key };
}

/** What is stored in the cloud: the encrypted, compressed payload and the random value it was encrypted with. */
export interface Sealed {
  iv: string;
  data: string;
  /** Whether the payload was compressed before encrypting (every current browser can). */
  z: boolean;
}

const toBase64 = (bytes: Uint8Array) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const fromBase64 = (text: string) => Uint8Array.from(atob(text), c => c.charCodeAt(0));

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

const canCompress = () => typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';

export async function seal(keys: SyncKeys, payload: SyncPayload): Promise<Sealed> {
  const z = canCompress();
  const plain = new TextEncoder().encode(JSON.stringify(payload));
  const body = z ? await pipe(plain, new CompressionStream('deflate-raw')) : plain;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, keys.key, body as BufferSource));
  return { iv: toBase64(iv), data: toBase64(data), z };
}

/** Decrypts a stored copy. Throws when the key is wrong or the data was changed. */
export async function unseal(keys: SyncKeys, sealed: Sealed): Promise<SyncPayload> {
  const body = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(sealed.iv) as BufferSource }, keys.key, fromBase64(sealed.data) as BufferSource));
  const plain = sealed.z ? await pipe(body, new DecompressionStream('deflate-raw')) : body;
  return parsePayload(JSON.parse(new TextDecoder().decode(plain)));
}
