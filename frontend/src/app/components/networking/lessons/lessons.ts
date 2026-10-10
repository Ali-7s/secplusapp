import { Lesson, LessonBody } from '../networking.model';
import { lessonBySlug } from './lesson-index';
import { LAYERS } from './01-layers';
import { ADDRESSES } from './02-addresses';
import { PORTS_TCP_UDP } from './03-ports-tcp-udp';
import { PORTS_TO_KNOW } from './04-ports-to-know';
import { DEVICES } from './05-devices';
import { VLANS } from './06-vlans';
import { HELPERS } from './07-helpers';
import { SECURITY_DEVICES } from './08-security-devices';
import { WEB_REQUEST } from './09-web-request';
import { HARDENING } from './10-hardening';

/** Lesson text, keyed by slug. The list, titles and related cards live in lesson-index.ts. */
export const LESSON_BODIES: Record<string, LessonBody> = {
  layers: LAYERS,
  addresses: ADDRESSES,
  'ports-tcp-udp': PORTS_TCP_UDP,
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
