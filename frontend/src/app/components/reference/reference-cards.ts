/**
 * The Reference deck: flashcards made from the Reference tables, studied in Review mode on the same schedule as
 * the Acronyms and Key Terms decks. Ports go both ways ("Port 22" and "SSH: which port?") because the exam asks
 * both. Tables that would repeat acronym cards (ciphers, hashes, auth and VPN protocols) are left out.
 *
 * Card ids are saved with your progress ("ref:port:22"), so they must not change when a row's wording does.
 */

import { StudyCard } from '../../utils/study-card';
import { AnswerCheck, expansionCheck, mentionAt, mentions, mentionsAny, numbersIn } from '../../utils/typed-answer';
import {
  ACCESS_MODELS, ATTACK_FRAMEWORKS, BACKUP_TYPES, BCDR_METRICS, CLOUD_MODELS, DATA_CLASSIFICATIONS, IR_PHASES, MFA_FACTORS, PORTS,
  RAID_LEVELS, REPLACEMENTS, RISK_FORMULAS, SITE_TYPES, WIRELESS,
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
  { key: 'access', label: 'Access Models' },
  { key: 'mfa', label: 'MFA Factors' },
  { key: 'frameworks', label: 'Attack Frameworks' },
];

const label = (key: string) => REFERENCE_DECK_SECTIONS.find(s => s.key === key)!.label;

const RATING: Record<string, string> = { secure: 'Secure', insecure: 'Weak or insecure', deprecated: 'Deprecated', neutral: 'Depends on how it is set up' };

/** Ends a table note with a full stop, so notes read as sentences on the card. */
const sentence = (text: string) => (/[.!?]$/.test(text.trim()) ? text.trim() : `${text.trim()}.`);

const card = (c: Omit<StudyCard, 'related' | 'examContext'>): StudyCard => ({ examContext: '', related: [], ...c });

// ── Typed answer checks ───────────────────────────────────────────────────────

/** The names accepted for each port's protocol. Every port in the table needs an entry (the spec checks). */
export const PORT_NAMES: Record<string, string[]> = {
  '20': ['FTP-DATA', 'FTP data', 'FTP'],
  '21': ['FTP'],
  '22': ['SSH', 'SFTP', 'SCP', 'Secure Shell'],
  '23': ['Telnet'],
  '25': ['SMTP'],
  '49': ['TACACS+', 'TACACS'],
  '53': ['DNS'],
  '67/68': ['DHCP', 'BOOTP'],
  '69': ['TFTP'],
  '80': ['HTTP'],
  '88': ['Kerberos'],
  '110': ['POP3', 'POP'],
  '119': ['NNTP'],
  '123': ['NTP'],
  '135': ['RPC', 'MSRPC', 'Microsoft RPC'],
  '137-139': ['NetBIOS'],
  '143': ['IMAP'],
  '161/162': ['SNMP'],
  '179': ['BGP'],
  '389': ['LDAP'],
  '443': ['HTTPS'],
  '445': ['SMB', 'CIFS'],
  '465': ['SMTPS', 'SMTP over TLS', 'SMTP over SSL'],
  '500': ['IKE', 'ISAKMP', 'IPsec'],
  '514': ['Syslog'],
  '587': ['SMTP submission', 'submission', 'SMTP with STARTTLS', 'SMTP STARTTLS'],
  '636': ['LDAPS', 'LDAP over TLS', 'LDAP over SSL'],
  '853': ['DoT', 'DNS over TLS'],
  '989/990': ['FTPS', 'FTP over TLS', 'FTP over SSL'],
  '993': ['IMAPS', 'IMAP over TLS', 'IMAP over SSL'],
  '995': ['POP3S', 'POP3 over TLS', 'POP3 over SSL'],
  '1194': ['OpenVPN'],
  '1433': ['MSSQL', 'SQL Server', 'Microsoft SQL'],
  '1521': ['Oracle'],
  '1701': ['L2TP'],
  '1723': ['PPTP'],
  '1812/1813': ['RADIUS'],
  '1883/8883': ['MQTT'],
  '3306': ['MySQL', 'MariaDB'],
  '3389': ['RDP', 'Remote Desktop'],
  '4500': ['NAT-T', 'NAT traversal', 'IPsec NAT traversal'],
  '5060/5061': ['SIP'],
  '5900': ['VNC'],
  '6514': ['Syslog over TLS', 'Syslog TLS', 'TLS syslog', 'Secure syslog', 'Syslog-TLS'],
  '8080': ['HTTP-Alt', 'HTTP alternate', 'alternate HTTP', 'HTTP proxy', 'HTTP'],
  '8443': ['HTTPS-Alt', 'HTTPS alternate', 'alternate HTTPS', 'HTTPS'],
  '51820': ['WireGuard'],
};

/**
 * "Port 22: which protocol?" Right when it names one of the port's protocols and no other port's, so listing
 * every protocol you can think of does not pass.
 */
export function protocolCheck(port: string): AnswerCheck {
  const own = PORT_NAMES[port] ?? [];
  return typed => {
    // "SMTP" inside "SMTP submission" is part of this port's own name, not a different answer.
    const wrong = Object.entries(PORT_NAMES).filter(([other]) => other !== port).flatMap(([other, names]) => names
      .filter(n => !own.includes(n) && mentions(typed, n) && !own.some(o => mentions(o, n) && mentions(typed, o)))
      .map(name => ({ name, other })));
    // Name the most specific one: "SMTP submission" is 587, not the SMTP inside it.
    const named = wrong.reduce<(typeof wrong)[number] | undefined>((a, b) => (!a || b.name.length > a.name.length ? b : a), undefined);
    if (named) return { right: false, note: `${named.name} is port ${named.other}.` };
    return own.some(n => mentions(typed, n)) ? { right: true } : { right: false };
  };
}

/** "SSH: which port, and TCP or UDP?" Right with every port number and transport, and nothing extra. */
function portCheck(port: string, transport: string): AnswerCheck {
  const ends = port.split(/[/-]/).map(Number);
  const allowed = port.includes('-') ? (n: number) => n >= ends[0] && n <= ends[1] : (n: number) => ends.includes(n);
  const transports = transport.split('/').map(t => t.trim().toUpperCase());
  return typed => {
    const got = numbersIn(typed);
    const extra = got.find(n => !allowed(n));
    if (extra !== undefined) return { right: false, note: `${extra} is not one of its ports.` };
    const missing = ends.filter(n => !got.includes(n));
    if (missing.length) return { right: false, note: got.length ? `Missing port ${missing.join(' and ')}.` : undefined };
    const wrongTransport = ['TCP', 'UDP'].find(t => mentions(typed, t) && !transports.includes(t));
    if (wrongTransport) return { right: false, note: `It does not use ${wrongTransport}.` };
    const missingTransport = transports.filter(t => !mentions(typed, t));
    if (missingTransport.length) return { right: false, note: `Right port, but say ${missingTransport.join(' and ')} too.` };
    return { right: true };
  };
}

/** Accepted replacements for each legacy protocol, by its name in the Legacy → Modern table. */
const REPLACEMENT_NAMES: Record<string, string[]> = {
  'Telnet': ['SSH', 'Secure Shell'],
  'FTP': ['SFTP', 'SCP', 'FTPS'],
  'HTTP': ['HTTPS'],
  'POP3': ['POP3S', 'POP3 over TLS', '995'],
  'IMAP': ['IMAPS', 'IMAP over TLS', '993'],
  'SMTP (relay)': ['587', 'SMTP submission', 'submission', 'STARTTLS'],
  'LDAP': ['LDAPS', 'LDAP over TLS', '636', 'STARTTLS'],
  'Syslog (UDP)': ['Syslog over TLS', 'TLS syslog', 'Syslog TLS', 'Secure syslog', '6514'],
  'SNMPv1 / SNMPv2c': ['SNMPv3', 'SNMP v3', 'SNMP version 3'],
  'VNC (unauthenticated/cleartext)': ['SSH', 'RDP'],
  'PPTP': ['IKEv2', 'IPsec', 'WireGuard', 'OpenVPN'],
  'WEP': ['WPA3', 'WPA2'],
  'WPA / TKIP': ['WPA2', 'WPA3', 'AES', 'CCMP'],
  'WPS (PIN method)': ['disable', 'disabled', 'disabling', 'turn off', 'turn it off', 'switch off', 'remove'],
  'PAP': ['EAP-TLS', 'EAP', 'PEAP'],
  'NTLM': ['Kerberos'],
  'DES': ['AES'],
  '3DES / TDEA': ['AES'],
  'RC4': ['ChaCha20', 'ChaCha', 'AES'],
  'MD5': ['SHA-256', 'SHA-2', 'SHA-384', 'SHA-512', 'SHA-3'],
  'SHA-1': ['SHA-256', 'SHA-2', 'SHA-384', 'SHA-512', 'SHA-3'],
};

const replacementCheck = (from: string): AnswerCheck => typed => ({ right: mentionsAny(typed, REPLACEMENT_NAMES[from] ?? []) });

/** Words that name each incident response phase, in order. */
const IR_WORDS = [
  ['preparation', 'prepare', 'preparing'],
  ['detection', 'detect', 'identification', 'identify'],
  ['analysis', 'analyze', 'analyse'],
  ['containment', 'contain'],
  ['eradication', 'eradicate'],
  ['recovery', 'recover'],
  ['lessons learned', 'lessons', 'post incident', 'post-incident'],
];

/** Right when every step is named (by any of its words) and they come in order. */
const orderCheck = (steps: string[][]): AnswerCheck => typed => {
  const at = steps.map(names => Math.min(...names.map(n => mentionAt(typed, n)).filter(i => i >= 0)));
  const missing = at.map((i, k) => (Number.isFinite(i) ? null : steps[k][0])).filter(Boolean);
  if (missing.length) return { right: false, note: `Missing: ${missing.join(', ')}.` };
  const outOfOrder = at.findIndex((i, k) => k > 0 && i < at[k - 1]);
  if (outOfOrder > 0) return { right: false, note: `${steps[outOfOrder][0]} comes after ${steps[outOfOrder - 1][0]}.` };
  return { right: true };
};

const irOrderCheck = orderCheck(IR_WORDS);

const irStepCheck = (order: number, total: number): AnswerCheck => typed => {
  const steps = numbersIn(typed, true).filter(n => n >= 1 && n <= total);
  if (!steps.includes(order)) return { right: false };
  return steps.some(n => n !== order) ? { right: false, note: 'Give one step number.' } : { right: true };
};

/** "RAID 5: how many disks at least, and how many failures?" Both numbers, in either order. */
function raidCheck(minDisks: string, faultTolerance: string): AnswerCheck {
  const min = Number(minDisks);
  const survives = /^none/i.test(faultTolerance) ? [0] : /multiple/i.test(faultTolerance) ? [1, 2] : numbersIn(faultTolerance);
  return typed => {
    const got = numbersIn(typed.replace(/raid\s*\d+/gi, ' ').replace(/\bno\s+(?:disk\s+)?(?:failures?|fault tolerance|redundancy)\b/gi, ' 0 '), true);
    if (!got.includes(min)) return { right: false, note: got.length ? `It needs at least ${min} disks.` : undefined };
    const rest = got.filter(n => n !== min);
    const multiple = survives.length > 1 && mentionsAny(typed, ['multiple', 'one per mirror', 'one per pair', 'one in each mirror']);
    if (!multiple && !rest.some(n => survives.includes(n))) {
      return { right: false, note: 'Check how many disk failures it survives.' };
    }
    const extra = rest.find(n => !survives.includes(n));
    return extra !== undefined ? { right: false, note: `${extra} is not right for it.` } : { right: true };
  };
}

/** A formula: right when it names every input (by letters or in full) and none of the wrong ones. */
function formulaCheck(inputs: string[][], wrong: string[]): AnswerCheck {
  return typed => {
    const bad = wrong.find(w => mentions(typed, w));
    if (bad) return { right: false, note: `${bad} is not part of it.` };
    const missing = inputs.filter(names => !mentionsAny(typed, names)).map(names => names[0]);
    return missing.length ? { right: false, note: `Missing: ${missing.join(', ')}.` } : { right: true };
  };
}

const FORMULA_CHECKS: Record<string, AnswerCheck> = {
  'SLE (Single Loss Expectancy)': formulaCheck([['AV', 'asset value'], ['EF', 'exposure factor']], ['ARO', 'ALE']),
  'ALE (Annualized Loss Expectancy)': formulaCheck([['SLE', 'single loss expectancy'], ['ARO', 'annualized rate of occurrence', 'annualised rate of occurrence']], ['AV', 'EF']),
};

/** The ports in the order Review mode meets them: the core ones first (see PortEntry.core), as the Ports trainer does. */
const coreFirst = [...PORTS.filter(p => p.core), ...PORTS.filter(p => !p.core)];

function portCards(): { toProtocol: StudyCard[]; toPort: StudyCard[] } {
  const toProtocol = coreFirst.map(p => card({
    id: `port:${p.port}`,
    name: `${/[/-]/.test(p.port) ? 'Ports' : 'Port'} ${p.port}`,
    prompt: 'Which protocol uses it?',
    category: label('ports'),
    expansion: `${p.protocol} (${p.transport})`,
    definition: `${p.service}. ${sentence(p.notes)}`,
    notes: [{ label: 'Used for', text: `${p.role}. ${p.use}` }, { label: 'Rated', text: RATING[p.status] }],
    check: protocolCheck(p.port),
    sibling: `proto:${p.protocol}`,
  }));
  const toPort = coreFirst.map(p => card({
    id: `proto:${p.protocol}`,
    name: p.protocol,
    prompt: 'Which port, and TCP or UDP?',
    category: label('ports'),
    expansion: `${p.transport} ${p.port}`,
    definition: `${p.service}. ${sentence(p.notes)}`,
    notes: [{ label: 'Used for', text: `${p.role}. ${p.use}` }, { label: 'Rated', text: RATING[p.status] }],
    check: portCheck(p.port, p.transport),
    sibling: `port:${p.port}`,
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
  check: replacementCheck(r.from.name),
}));

function irCards(): StudyCard[] {
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
      check: irStepCheck(p.order, total),
    });
  });
  const order = card({
    id: 'ir:order',
    name: 'Incident response',
    prompt: `Name the ${total} phases in order.`,
    category: label('ir'),
    expansion: phases.map(p => p.phase).join(' → '),
    definition: 'Preparation happens before any incident. Once one starts, the team detects and analyses it, then contains, eradicates and recovers, and finishes with lessons learned.',
    check: irOrderCheck,
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
  check: expansionCheck(m.name),
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
  check: raidCheck(r.minDisks, r.faultTolerance),
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
  // A service model's name is checkable ("Platform as a Service"); a deployment model's trade-off is not.
  check: c.category === 'Service Model' ? expansionCheck(c.summary.split(' — ')[0]) : undefined,
}));

const riskCards = () => RISK_FORMULAS.map(f => card({
  id: `risk:${f.name}`,
  name: f.name,
  prompt: f.formula.includes('=') ? 'What is the formula?' : f.name.startsWith('Qualitative') ? 'How do they differ?' : 'How is it worked out?',
  category: label('risk'),
  expansion: f.formula,
  definition: sentence(f.variables),
  notes: [{ label: 'Example', text: sentence(f.example) }],
  check: FORMULA_CHECKS[f.name],
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
 * "Which one is it?" among a few look-alikes: right when the answer names this one and no other. Full names are
 * read first, so "rule-based (RBAC)" counts as rule-based even though RBAC usually means role-based.
 */
function oneOfCheck(options: Record<string, { names: string[]; short?: string[] }>, own: string): AnswerCheck {
  return typed => {
    for (const field of ['names', 'short'] as const) {
      const hits = Object.keys(options).filter(k => mentionsAny(typed, options[k][field] ?? []));
      if (hits.length > 1) return { right: false, note: 'Give one answer.' };
      if (hits.length === 1) return hits[0] === own ? { right: true } : { right: false, note: `That describes ${hits[0]}.` };
    }
    return { right: false };
  };
}

/** Each access control model as a situation to recognise; the front avoids the words in the model's name. */
const ACCESS_SITUATIONS: Record<string, { front: string; names: string[]; short: string[] }> = {
  'DAC (Discretionary Access Control)': {
    front: 'The owner of a file decides who else may open it',
    names: ['discretionary'], short: ['DAC'],
  },
  'MAC (Mandatory Access Control)': {
    front: "The system compares a user's clearance with the data's classification label, and the owner cannot override it",
    names: ['mandatory'], short: ['MAC'],
  },
  'RBAC (Role-Based Access Control)': {
    front: 'Permissions belong to job functions, and people get them by being assigned one',
    names: ['role based', 'role'], short: ['RBAC'],
  },
  'ABAC (Attribute-Based Access Control)': {
    front: 'A policy allows access only when several properties match, such as department, managed device and time of day',
    names: ['attribute based', 'attribute', 'attributes'], short: ['ABAC'],
  },
  'Rule-Based Access Control': {
    front: "An administrator's if-then conditions decide access for everyone alike, as in a firewall's ACL",
    names: ['rule based', 'rule', 'rules'], short: ['RuBAC'],
  },
};

const accessCards = () => ACCESS_MODELS.map(m => card({
  id: `access:${m.name}`,
  name: ACCESS_SITUATIONS[m.name].front,
  prompt: 'Which access control model is it?',
  category: label('access'),
  expansion: m.name,
  definition: sentence(m.summary),
  notes: [{ label: 'In practice', text: sentence(m.detail) }],
  check: oneOfCheck(ACCESS_SITUATIONS, m.name),
}));

/** Each authentication factor as examples to recognise. */
const FACTOR_EXAMPLES: Record<string, { front: string; names: string[] }> = {
  'Something You Know': { front: 'A password, a PIN or the answer to a security question', names: ['something you know', 'knowledge'] },
  'Something You Have': { front: 'A hardware token, a smart card or an authenticator app on your phone', names: ['something you have', 'possession', 'ownership'] },
  'Something You Are': { front: 'A fingerprint, a face scan, an iris scan or a voice print', names: ['something you are', 'inherence', 'biometric', 'biometrics'] },
  'Somewhere You Are': { front: 'Your GPS position, where your IP address is, or being on a particular network', names: ['somewhere you are', 'location', 'geolocation'] },
};

const mfaCards = () => MFA_FACTORS.map(f => card({
  id: `mfa:${f.name}`,
  name: FACTOR_EXAMPLES[f.name].front,
  prompt: 'Which authentication factor is it?',
  category: label('mfa'),
  expansion: f.name.charAt(0) + f.name.slice(1).toLowerCase(),
  definition: sentence(f.summary),
  notes: [{ label: 'In practice', text: sentence(f.detail) }],
  check: oneOfCheck(FACTOR_EXAMPLES, f.name),
}));

const KILL_CHAIN = [
  ['reconnaissance', 'recon'],
  ['weaponization', 'weaponisation', 'weaponize', 'weaponise'],
  ['delivery', 'deliver'],
  ['exploitation', 'exploit'],
  ['installation', 'install'],
  ['command and control', 'command & control', 'C2'],
  ['actions on objectives', 'actions on objective', 'actions', 'objectives'],
];

const DIAMOND_POINTS = [['adversary', 'attacker'], ['infrastructure'], ['capability', 'capabilities'], ['victim', 'target']];

/** The frameworks, recognised from a description; the front avoids each framework's name. */
const FRAMEWORK_DESCRIPTIONS: Record<string, { front: string; names: string[] }> = {
  'MITRE ATT&CK': { front: 'A matrix of the tactics and techniques real attackers have used, for threat hunting and detection', names: ['ATT&CK', 'MITRE', 'ATTACK'] },
  'Cyber Kill Chain': { front: 'Splits an attack into seven stages, from reconnaissance to actions on objectives', names: ['kill chain'] },
  'Diamond Model': { front: 'Describes an intrusion by linking four points: adversary, infrastructure, capability and victim', names: ['diamond'] },
};

function frameworkCards(): StudyCard[] {
  const find = (name: string) => ATTACK_FRAMEWORKS.find(f => f.name === name)!;
  const killChain = find('Cyber Kill Chain');
  const diamond = find('Diamond Model');
  const contents = [
    card({
      id: 'framework:Cyber Kill Chain',
      name: 'Cyber Kill Chain',
      prompt: 'Name its seven stages, in order.',
      category: label('frameworks'),
      expansion: 'Reconnaissance → Weaponization → Delivery → Exploitation → Installation → Command and control (C2) → Actions on objectives',
      definition: sentence(killChain.detail),
      check: orderCheck(KILL_CHAIN),
      sibling: 'framework-name:Cyber Kill Chain',
    }),
    card({
      id: 'framework:Diamond Model',
      name: 'Diamond Model',
      prompt: 'What are its four points?',
      category: label('frameworks'),
      expansion: 'Adversary, infrastructure, capability and victim',
      definition: sentence(diamond.detail),
      check: formulaCheck(DIAMOND_POINTS, []),
      sibling: 'framework-name:Diamond Model',
    }),
  ];
  const names = ATTACK_FRAMEWORKS.map(f => card({
    id: `framework-name:${f.name}`,
    name: FRAMEWORK_DESCRIPTIONS[f.name].front,
    prompt: 'Which framework is it?',
    category: label('frameworks'),
    expansion: f.name,
    definition: sentence(f.summary),
    notes: [{ label: 'In practice', text: sentence(f.detail) }],
    check: oneOfCheck(FRAMEWORK_DESCRIPTIONS, f.name),
    sibling: f.name === 'MITRE ATT&CK' ? undefined : `framework:${f.name}`,
  }));
  return [...contents, ...names];
}

/**
 * Every card in the deck. Review mode deals new cards in this order, so the sections are interleaved (a day's new
 * cards are not all ports), and the two cards for one port are kept far apart so one does not give the other away:
 * the "which port?" cards are turned half way round, the core ports among themselves and the rest among themselves.
 */
export function referenceCards(): StudyCard[] {
  const { toProtocol, toPort } = portCards();
  // Half rounded up: with an odd count, rounding down would leave some pairs a card short of a day apart.
  const turned = (list: StudyCard[]) => { const half = Math.ceil(list.length / 2); return [...list.slice(half), ...list.slice(0, half)]; };
  const core = PORTS.filter(p => p.core).length;
  const lists = [
    toProtocol, [...turned(toPort.slice(0, core)), ...turned(toPort.slice(core))], legacyCards(), wirelessCards(), irCards(),
    metricCards(), backupCards(), raidCards(), siteCards(), cloudCards(), riskCards(), dataCards(), accessCards(), mfaCards(),
    frameworkCards(),
  ];
  const out: StudyCard[] = [];
  for (let i = 0; out.length < lists.reduce((n, l) => n + l.length, 0); i++) {
    for (const list of lists) if (i < list.length) out.push(list[i]);
  }
  return out;
}
