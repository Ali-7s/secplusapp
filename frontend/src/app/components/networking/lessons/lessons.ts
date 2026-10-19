import { Lesson, LessonBody } from '../networking.model';
import { lessonBySlug } from './lesson-index';
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
};

export function getLesson(slug: string | null | undefined): Lesson | undefined {
  const meta = lessonBySlug(slug);
  const body = meta ? LESSON_BODIES[meta.slug] : undefined;
  return meta && body ? { ...meta, ...body } : undefined;
}
