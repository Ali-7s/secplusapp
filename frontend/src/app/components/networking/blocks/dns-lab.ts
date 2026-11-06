import { LabCase, LabLine, LabRound } from './malware-lab';

const bad = (text: string): LabLine => ({ text, bad: true });

/** The real answer for the payroll portal, from Fernco's own name servers. */
const REAL = '198.51.100.20';

export const DNS_OPTIONS = ['DNS poisoning: the hosts file', 'DNS poisoning: the resolver cache', 'Domain hijacking', 'URL hijacking (typosquatting)', 'Not an attack: a DNS outage'];

export const DNS_CASES: LabCase[] = [
  {
    machine: 'Case 1 · Sam\'s laptop',
    ticket: 'Sam says the payroll portal, payroll.fernco.example, shows a sign-in page that never accepts his password. Nobody else has complained.',
    tools: {
      browser: [{ text: 'Address bar: https://payroll.fernco.example' }, bad('Certificate warning: issued to *.cheap-hosting.example, not payroll.fernco.example')],
      ping: [bad('ping payroll.fernco.example → 203.0.113.66')],
      hosts: [{ text: '127.0.0.1    localhost' }, bad('203.0.113.66    payroll.fernco.example    # added Tuesday 14:02')],
      local: [{ text: 'Server: dns1.corp.example' }, { text: `payroll.fernco.example → ${REAL}` }],
      others: [bad('Only Sam\'s laptop is affected. Every other PC reaches the real portal.')],
    },
    answer: 'DNS poisoning: the hosts file',
    why: 'The company resolver gives the right address, yet this laptop connects somewhere else. The hosts file is checked before DNS, and malware added a line there, so only this machine is fooled.',
    near: { option: 'DNS poisoning: the resolver cache', why: 'A poisoned resolver would fool every PC that uses it, and nslookup against dns1 would show the bad address. Here dns1 is right and only one machine is wrong.' },
  },
  {
    machine: 'Case 2 · The whole office',
    ticket: 'Since this morning, everyone in the office who opens the payroll portal gets a sign-in page that rejects their password. People working from home are fine.',
    tools: {
      browser: [{ text: 'Address bar: https://payroll.fernco.example' }, bad('Certificate warning: the certificate is not trusted')],
      ping: [bad('ping payroll.fernco.example → 203.0.113.66')],
      local: [{ text: 'Server: dns1.corp.example' }, bad('payroll.fernco.example → 203.0.113.66')],
      public: [{ text: 'Server: a public resolver' }, bad(`payroll.fernco.example → ${REAL} (the correct address)`)],
      cache: [bad('payroll.fernco.example  A  203.0.113.66  TTL 86400  ·  cached 02:13 from a response that arrived before the real one')],
      others: [{ text: 'Every office PC using dns1 is affected. Staff at home use other resolvers and are fine.' }],
    },
    answer: 'DNS poisoning: the resolver cache',
    why: 'The company resolver has a forged record in its cache, so everyone who asks it gets the attacker\'s address, while public resolvers still give the right one. DNSSEC lets a resolver reject forged answers.',
    near: { option: 'Domain hijacking', why: 'If the domain were hijacked, every resolver on the internet would give the wrong answer. A public resolver still gives the right one, so only dns1\'s cache is wrong.' },
  },
  {
    machine: 'Case 3 · Everyone, everywhere',
    ticket: 'The payroll portal shows a parking page with adverts. Staff at home, customers and partners all see the same thing.',
    tools: {
      ping: [bad('ping payroll.fernco.example → 203.0.113.80')],
      local: [{ text: 'Server: dns1.corp.example' }, bad('payroll.fernco.example → 203.0.113.80')],
      public: [{ text: 'Server: a public resolver' }, bad('payroll.fernco.example → 203.0.113.80')],
      cache: [{ text: 'payroll.fernco.example  A  203.0.113.80  TTL 3600  ·  matches what the authoritative servers now say' }],
      whois: [{ text: 'Domain: fernco.example  ·  registrar: an example registrar' }, bad('Name servers changed yesterday 23:40 to ns1.parked-dns.example'), bad('Registrar account: sign-in from a new country 20 minutes before; registrar lock: off')],
      others: [bad('Everyone on the internet sees the parking page, not just the office.')],
    },
    answer: 'Domain hijacking',
    why: 'Someone signed in to the registrar account and pointed the domain at their own name servers, so every resolver in the world now gets their answer. Registrar lock and MFA on the registrar account prevent it.',
    near: { option: 'DNS poisoning: the resolver cache', why: 'Cache poisoning fools one resolver. Here every resolver agrees on the wrong address, because the domain\'s own name servers were changed at the registrar.' },
  },
  {
    machine: 'Case 4 · The email link',
    ticket: 'Three people entered their payroll password on a page linked from Tuesday\'s "update your bank details" email. The real portal works fine for everyone.',
    tools: {
      browser: [bad('Address bar: https://payroll.fernc0.example (a zero, not the letter o)'), { text: 'Certificate: valid, issued to payroll.fernc0.example yesterday' }],
      ping: [{ text: `ping payroll.fernco.example → ${REAL}` }],
      local: [{ text: 'Server: dns1.corp.example' }, { text: `payroll.fernco.example → ${REAL}` }, { text: 'payroll.fernc0.example → 203.0.113.91' }],
      whois: [{ text: 'fernco.example: unchanged for two years, registrar lock on' }, bad('fernc0.example: registered 3 days ago through a privacy service')],
      others: [{ text: 'Only the people who clicked the email link were affected.' }],
    },
    answer: 'URL hijacking (typosquatting)',
    why: 'Every DNS answer for the real name is correct. The attacker registered a look-alike domain and got people there with a link. It even has a valid certificate, for the wrong name. Watch the address bar.',
    near: { option: 'Domain hijacking', why: 'Fernco\'s own domain is untouched and still locked. The attacker registered a different domain that looks like it.' },
  },
  {
    machine: 'Case 5 · Nothing loads',
    ticket: 'Since 08:55 nobody in the office can reach any website or internal system by name. Typing an IP address directly works.',
    tools: {
      browser: [bad('"Server not found" for every site')],
      ping: [bad('ping payroll.fernco.example → could not find host'), { text: `ping ${REAL} → replies normally` }],
      local: [{ text: 'Server: dns1.corp.example' }, bad('Request timed out (no answer)')],
      public: [{ text: 'Server: a public resolver' }, { text: `payroll.fernco.example → ${REAL}` }],
      cache: [bad('Resolver service stopped at 08:55 after a failed update. Cache empty.')],
      whois: [{ text: 'fernco.example: unchanged for two years, registrar lock on' }],
    },
    answer: 'Not an attack: a DNS outage',
    why: 'No wrong answers anywhere, just no answers from the company resolver, which stopped after a failed update. It is an availability problem with a mundane cause. A second resolver would have kept things working.',
    near: { option: 'DNS poisoning: the resolver cache', why: 'Poisoning returns a wrong address. Here dns1 returns nothing at all, and the service log shows it stopped.' },
  },
];

export const DNS_ROUND: LabRound = {
  title: 'Investigate: where does the name really go?',
  intro: 'Each case is a complaint about Fernco\'s payroll portal. Its real address is 198.51.100.20. Compare what each tool says, flag what is wrong, then name the cause.',
  icon: 'travel_explore',
  question: 'What is going on?',
  unit: 'case',
  tools: [
    { id: 'browser', name: 'Browser', icon: 'language', blurb: 'The address bar and the certificate the site presented' },
    { id: 'ping', name: 'ping', icon: 'terminal', blurb: 'Which address this machine actually connects to', mono: true },
    { id: 'hosts', name: 'Hosts file', icon: 'description', blurb: 'Local name overrides, checked before any DNS server', mono: true },
    { id: 'local', name: 'nslookup (company DNS)', icon: 'dns', blurb: 'Ask the company resolver, dns1', mono: true },
    { id: 'public', name: 'nslookup (public DNS)', icon: 'public', blurb: 'Ask a public resolver outside the company', mono: true },
    { id: 'cache', name: 'Resolver cache', icon: 'storage', blurb: 'What dns1 has cached, and its service log', mono: true },
    { id: 'whois', name: 'Registrar record', icon: 'badge', blurb: 'The domain\'s registration, name servers and recent changes' },
    { id: 'others', name: 'Who else?', icon: 'groups', blurb: 'Who else is affected' },
  ],
  baseline: {
    browser: ['Address bar: https://payroll.fernco.example', 'Certificate: valid, issued to payroll.fernco.example'],
    ping: [`ping payroll.fernco.example → ${REAL}`],
    hosts: ['127.0.0.1    localhost'],
    local: ['Server: dns1.corp.example', `payroll.fernco.example → ${REAL}`],
    public: ['Server: a public resolver', `payroll.fernco.example → ${REAL}`],
    cache: [`payroll.fernco.example  A  ${REAL}  TTL 3600`],
    whois: ['Domain: fernco.example  ·  name servers ns1.fernco.example, ns2.fernco.example  ·  registrar lock on'],
    others: ['No one else has reported a problem.'],
  },
  replace: ['browser', 'ping', 'hosts', 'local', 'public', 'cache', 'whois', 'others'],
  options: DNS_OPTIONS,
  cases: DNS_CASES,
  done: 'Every case solved. One machine wrong: hosts file. One resolver wrong: cache. The whole internet wrong: the registrar. Right DNS, wrong name: typosquatting.',
};
