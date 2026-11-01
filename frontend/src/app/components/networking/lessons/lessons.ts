import { Lesson, LessonBody } from '../networking.model';
import { LESSON_META, TRACKS, lessonBySlug } from './lesson-index';
import { isHandsOn, lessonParts } from './parts';
import { START } from './01-start';
import { LAYERS } from './04-layers';
import { ADDRESSES } from './02-addresses';
import { PORTS_TCP_UDP } from './03-ports-tcp-udp';
import { PORTS_TO_KNOW } from './05-ports-to-know';
import { DEVICES } from './06-devices';
import { VLANS } from './07-vlans';
import { HELPERS } from './08-helpers';
import { SECURITY_DEVICES } from './09-security-devices';
import { WEB_REQUEST } from './10-web-request';
import { HARDENING } from './11-hardening';
import { CRYPTO } from './topics/crypto';
import { PKI } from './topics/pki';
import { SIGN_IN } from './topics/sign-in';
import { INCIDENT_RESPONSE } from './topics/incident-response';
import { RISK } from './topics/risk';
import { ACCESS_CONTROL } from './topics/access-control';
import { BACKUPS } from './topics/backups';
import { LOGS } from './topics/logs';
import { ACCOUNTS } from './topics/accounts';
import { ENDPOINTS } from './topics/endpoints';
import { CONTROLS } from './topics/controls';
import { PHISHING } from './topics/phishing';
import { VULNERABILITIES } from './topics/vulnerabilities';

/** Lesson text, keyed by slug. The list, titles and related cards live in lesson-index.ts. */
export const LESSON_BODIES: Record<string, LessonBody> = {
  start: START,
  addresses: ADDRESSES,
  'ports-tcp-udp': PORTS_TCP_UDP,
  layers: LAYERS,
  'ports-to-know': PORTS_TO_KNOW,
  devices: DEVICES,
  vlans: VLANS,
  helpers: HELPERS,
  'security-devices': SECURITY_DEVICES,
  'web-request': WEB_REQUEST,
  hardening: HARDENING,
  crypto: CRYPTO,
  pki: PKI,
  'sign-in': SIGN_IN,
  'incident-response': INCIDENT_RESPONSE,
  risk: RISK,
  'access-control': ACCESS_CONTROL,
  backups: BACKUPS,
  logs: LOGS,
  accounts: ACCOUNTS,
  endpoints: ENDPOINTS,
  controls: CONTROLS,
  phishing: PHISHING,
  vulnerabilities: VULNERABILITIES,
};

export function getLesson(slug: string | null | undefined): Lesson | undefined {
  const meta = lessonBySlug(slug);
  const body = meta ? LESSON_BODIES[meta.slug] : undefined;
  return meta && body ? { ...meta, ...body } : undefined;
}

/** A lesson that teaches an objective, with the parts that do. `index` is the part's number for `?part=`. */
export interface ObjectiveLesson {
  slug: string;
  label: string;
  title: string;
  parts: { index: number; title: string; handsOn: boolean }[];
}

/** For each SY0-701 objective, the lessons and parts tagged with it, in teaching order. */
export function lessonsByObjective(): Record<string, ObjectiveLesson[]> {
  const out: Record<string, ObjectiveLesson[]> = {};
  for (const meta of LESSON_META) {
    const body = LESSON_BODIES[meta.slug];
    if (!body) continue;
    const parts = lessonParts(body).map((part, index) => ({ part, index }));
    for (const id of meta.objectives) {
      (out[id] ??= []).push({
        slug: meta.slug,
        label: `${TRACKS[meta.track].unit} ${meta.number}`,
        title: meta.title,
        parts: parts.filter(p => p.part.objective === id).map(p => ({ index: p.index, title: p.part.title, handsOn: isHandsOn(p.part) })),
      });
    }
  }
  return out;
}
