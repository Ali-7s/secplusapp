import { DNS_ROUND } from './dns-lab';
import { LAB_ROUNDS, LabRound } from './malware-lab';

/** Every investigation lab, by the name a lesson uses for it. */
export type LabId = 'spread' | 'hidden' | 'dns';

export const LABS: Record<LabId, LabRound> = { spread: LAB_ROUNDS['spread'], hidden: LAB_ROUNDS['hidden'], dns: DNS_ROUND };
