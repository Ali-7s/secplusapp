/**
 * The Reference deck: flashcards made from the Reference tables, studied in Review mode on the same schedule as
 * the Acronyms and Key Terms decks. Ports go both ways ("Port 22" and "SSH: which port?") because the exam asks
 * both. Tables that would repeat acronym cards (ciphers, hashes, auth and VPN protocols) are left out.
 *
 * Card ids are saved with your progress ("ref:port:22"), so they must not change when a row's wording does.
 */

import { DumpCard } from '../../utils/brain-dump';
import {
  BACKUP_TYPES, BCDR_METRICS, CLOUD_MODELS, DATA_CLASSIFICATIONS, IR_PHASES, PORTS, RAID_LEVELS, REPLACEMENTS,
  RISK_FORMULAS, SITE_TYPES, WIRELESS,
} from './reference-data';

/** The Reference sections the deck covers, by the key and label the Reference page uses for them. */
export const REFERENCE_DECK_SECTIONS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'ports', label: 'Network Ports' },
  { key: 'wireless', label: 'Wireless Security' },
  { key: 'legacy', label: 'Legacy → Modern' },
  { key: 'ir', label: 'IR Phases' },
  { key: 'bcdr', label: 'BCP/DR Metrics' },
  { key: 'backups', label: 'Backup Types' },
  { key: 'raid', label: 'RAID Levels' },
  { key: 'sites', label: 'Site Types' },
  { key: 'cloud', label: 'Cloud Models' },
  { key: 'risk', label: 'Risk Formulas' },
  { key: 'data', label: 'Data Classification' },
];

const label = (key: string) => REFERENCE_DECK_SECTIONS.find(s => s.key === key)!.label;

const RATING: Record<string, string> = { secure: 'Secure', insecure: 'Weak or insecure', deprecated: 'Deprecated', neutral: 'Depends on how it is set up' };

/** Ends a table note with a full stop, so notes read as sentences on the card. */
const sentence = (text: string) => (/[.!?]$/.test(text.trim()) ? text.trim() : `${text.trim()}.`);

const card = (c: Omit<DumpCard, 'related' | 'examContext'>): DumpCard => ({ examContext: '', related: [], ...c });

function portCards(): { toProtocol: DumpCard[]; toPort: DumpCard[] } {
  const toProtocol = PORTS.map(p => card({
    id: `port:${p.port}`,
    name: `${/[/-]/.test(p.port) ? 'Ports' : 'Port'} ${p.port}`,
    prompt: 'Which protocol uses it?',
    category: label('ports'),
    expansion: `${p.protocol} (${p.transport})`,
    definition: `${p.service}. ${sentence(p.notes)}`,
    notes: [{ label: 'Rated', text: RATING[p.status] }],
  }));
  const toPort = PORTS.map(p => card({
    id: `proto:${p.protocol}`,
    name: p.protocol,
    prompt: 'Which port, and TCP or UDP?',
    category: label('ports'),
    expansion: `${p.transport} ${p.port}`,
    definition: `${p.service}. ${sentence(p.notes)}`,
    notes: [{ label: 'Rated', text: RATING[p.status] }],
  }));
  return { toProtocol, toPort };
}

const wirelessCards = () => WIRELESS.map(w => card({
  id: `wifi:${w.name}`,
  name: w.name,
  prompt: 'How safe is it, and why?',
  category: label('wireless'),
  expansion: RATING[w.status],
  definition: sentence(w.notes),
  notes: w.port !== 'N/A' ? [{ label: 'Works with', text: w.port }] : undefined,
}));

const withPort = (name: string, port: string) => (port === 'N/A' ? name : `${name} (${port})`);

const legacyCards = () => REPLACEMENTS.map(r => card({
  id: `legacy:${r.from.name}`,
  name: withPort(r.from.name, r.from.port),
  prompt: 'What replaces it, and why?',
  category: label('legacy'),
  expansion: withPort(r.to.name, r.to.port),
  definition: r.reason,
  notes: [{ label: 'Problem', text: sentence(r.from.why) }, { label: 'Fix', text: sentence(r.to.why) }],
}));

function irCards(): DumpCard[] {
  const phases = [...IR_PHASES].sort((a, b) => a.order - b.order);
  const total = phases.length;
  const steps = phases.map((p, i) => {
    const before = phases[i - 1]?.phase, after = phases[i + 1]?.phase;
    const place = [before && `after ${before}`, after && `before ${after}`].filter(Boolean).join(' and ');
    return card({
      id: `ir:${p.order}`,
      name: p.phase,
      prompt: 'Which step of incident response is it, and what happens in it?',
      category: label('ir'),
      expansion: `Step ${p.order} of ${total}, ${place}`,
      definition: sentence(p.description),
      notes: [{ label: 'Key activities', text: sentence(p.keyActivities) }],
    });
  });
  const order = card({
    id: 'ir:order',
    name: 'Incident response',
    prompt: `Name the ${total} phases in order.`,
    category: label('ir'),
    expansion: phases.map(p => p.phase).join(' → '),
    definition: 'Preparation happens before any incident. Once one starts, the team detects and analyses it, then contains, eradicates and recovers, and finishes with lessons learned.',
  });
  return [order, ...steps];
}

const metricCards = () => BCDR_METRICS.map(m => card({
  id: `metric:${m.abbr}`,
  name: m.abbr,
  prompt: 'What does it stand for, and what does it measure?',
  category: label('bcdr'),
  expansion: m.name,
  definition: sentence(m.definition),
  notes: [{ label: 'Example', text: sentence(m.example) }],
}));

const BACKUP_PROMPTS: Record<string, string> = {
  'Full Backup': 'What does it copy, and what does a restore need?',
  'Incremental Backup': 'What does it copy, and what does a restore need?',
  'Differential Backup': 'What does it copy, and what does a restore need?',
  'Snapshot': 'What is it, and can it replace a backup?',
  '3-2-1 Backup Rule': 'What does the rule say?',
};

const backupCards = () => BACKUP_TYPES.map(b => card({
  id: `backup:${b.name}`,
  name: b.name,
  prompt: BACKUP_PROMPTS[b.name] ?? 'What is it?',
  category: label('backups'),
  expansion: b.summary,
  definition: sentence(b.detail),
}));

const raidCards = () => RAID_LEVELS.map(r => card({
  id: `raid:${r.level}`,
  name: r.level,
  prompt: 'How many disks at least, and how many failures can it survive?',
  category: label('raid'),
  expansion: `${r.minDisks} disks minimum. ${sentence(r.faultTolerance)}`,
  definition: sentence(r.notes),
  notes: [{ label: 'Performance', text: sentence(r.performance) }],
}));

const siteCards = () => SITE_TYPES.map(s => card({
  id: `site:${s.type}`,
  name: s.type,
  prompt: 'How fast is recovery, and how much does it cost?',
  category: label('sites'),
  expansion: `${s.recoveryTime} to recover · ${s.cost.toLowerCase()} cost`,
  definition: sentence(s.description),
}));

const cloudCards = () => CLOUD_MODELS.map(c => card({
  id: `cloud:${c.name}`,
  name: c.name,
  prompt: c.category === 'Service Model' ? 'What does it stand for, and what do you manage?' : 'Who uses it, and what is the trade-off?',
  category: label('cloud'),
  expansion: c.summary,
  definition: sentence(c.detail),
}));

const riskCards = () => RISK_FORMULAS.map(f => card({
  id: `risk:${f.name}`,
  name: f.name,
  prompt: f.formula.includes('=') ? 'What is the formula?' : f.name.startsWith('Qualitative') ? 'How do they differ?' : 'How is it worked out?',
  category: label('risk'),
  expansion: f.formula,
  definition: sentence(f.variables),
  notes: [{ label: 'Example', text: sentence(f.example) }],
}));

const dataCards = () => DATA_CLASSIFICATIONS.map(d => card({
  id: `data:${d.name}`,
  name: d.name,
  prompt: 'What kind of information gets this label?',
  category: label('data'),
  expansion: d.summary,
  definition: sentence(d.detail),
}));

/**
 * Every card in the deck. Review mode deals new cards in this order, so the sections are interleaved (a day's new
 * cards are not all ports), and the two cards for one port are kept far apart so one does not give the other away.
 */
export function referenceCards(): DumpCard[] {
  const { toProtocol, toPort } = portCards();
  const half = Math.floor(toPort.length / 2);
  const lists = [
    toProtocol, [...toPort.slice(half), ...toPort.slice(0, half)], legacyCards(), wirelessCards(), irCards(),
    metricCards(), backupCards(), raidCards(), siteCards(), cloudCards(), riskCards(), dataCards(),
  ];
  const out: DumpCard[] = [];
  for (let i = 0; out.length < lists.reduce((n, l) => n + l.length, 0); i++) {
    for (const list of lists) if (i < list.length) out.push(list[i]);
  }
  return out;
}
