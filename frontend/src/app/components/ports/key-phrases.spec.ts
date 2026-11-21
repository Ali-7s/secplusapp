import { FACTS, factPort } from './firewall-generator';
import { NO_PORT } from './firewall-scenarios';
import { CUES } from './key-phrases';
import { CUE_FACTS, answerOf } from './port-phrases.component';
import { PORT_NAMES } from '../reference/reference-cards';
import { PORTS } from '../reference/reference-data';

describe('Port cheat sheet', () => {
  it('says what every firewall rule sounds like, once each, in the order the tables use', () => {
    expect([...CUE_FACTS].sort()).toEqual([...FACTS].sort());
    expect(Object.keys(CUES).sort()).toEqual([...FACTS].sort());
    for (const fact of FACTS) expect(CUES[fact].length).withContext(fact).toBeGreaterThan(0);
  });

  it('describes a rule in plain words, without its acronym or any port number', () => {
    const ports = new Set(PORTS.flatMap(p => {
      const [a, b] = p.port.split(/[/-]/).map(Number);
      return p.port.includes('-') ? Array.from({ length: b - a + 1 }, (_, i) => String(a + i)) : p.port.split('/');
    }));
    const acronym = (fact: string) => {
      const entry = PORTS.find(p => p.port.split(/[/-]/).includes(factPort(fact)) || p.port === factPort(fact));
      const name = entry && PORT_NAMES[entry.port]?.[0];
      return name && /^[A-Z0-9+-]{2,}$/.test(name) ? name : undefined;
    };
    for (const fact of FACTS) {
      for (const cue of CUES[fact]) {
        expect((cue.match(/\b\d{2,5}\b/g) ?? []).filter(n => ports.has(n))).withContext(`${fact}: "${cue}"`).toEqual([]);
        const name = acronym(fact);
        if (name) expect(new RegExp(`(^|\\W)${name.replace(/[+]/g, '\\+')}($|\\W)`, 'i').test(cue)).withContext(`${fact}: "${cue}" names ${name}`).toBeFalse();
      }
    }
  });

  it('shows each rule\'s answer from the rule itself', () => {
    expect(answerOf('pop3')).toEqual({ name: 'POP3', where: 'TCP 110' });
    expect(answerOf('kerberos')).toEqual({ name: 'Kerberos', where: 'TCP/UDP 88' });
    expect(answerOf('dns')).toEqual({ name: 'DNS lookups', where: 'UDP 53' });
    expect(answerOf('esp')).toEqual({ name: 'ESP', where: 'IP protocol 50' });
    expect(answerOf('ping')).toEqual({ name: 'ICMP', where: 'no port' });
    expect(FACTS.filter(f => factPort(f) === NO_PORT).length).toBe(3);
  });
});
