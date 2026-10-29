import { DEFAULT_NEW_PER_DAY } from '../../utils/progress';
import { PORT_NAMES, REFERENCE_DECK_SECTIONS, referenceCards } from './reference-cards';
import { PORTS, RAID_LEVELS, REPLACEMENTS } from './reference-data';

describe('Reference deck', () => {
  const cards = referenceCards();

  it('gives every card a unique id and a question with an answer', () => {
    expect(new Set(cards.map(c => c.id)).size).toBe(cards.length);
    for (const c of cards) {
      expect(c.name.trim()).withContext(c.id).not.toBe('');
      expect(c.prompt?.trim()).withContext(c.id).toBeTruthy();
      expect(c.expansion?.trim()).withContext(c.id).toBeTruthy();
      expect(c.definition.trim()).withContext(c.id).not.toBe('');
    }
  });

  it('asks every port both ways, without the answer on the front', () => {
    for (const p of PORTS) {
      const toProtocol = cards.find(c => c.id === `port:${p.port}`);
      const toPort = cards.find(c => c.id === `proto:${p.protocol}`);
      expect(toProtocol?.expansion).withContext(p.port).toContain(p.protocol);
      expect(toProtocol?.name).withContext(p.port).not.toContain(p.protocol);
      expect(toPort?.expansion).withContext(p.protocol).toContain(p.port);
      expect(toPort?.name).withContext(p.protocol).not.toContain(p.port);
    }
  });

  it('covers every listed section and nothing else', () => {
    const labels = REFERENCE_DECK_SECTIONS.map(s => s.label);
    for (const label of labels) expect(cards.some(c => c.category === label)).withContext(label).toBeTrue();
    for (const c of cards) expect(labels).withContext(c.id).toContain(c.category);
  });

  it('mixes the sections and keeps the two cards for one port on different days', () => {
    expect(new Set(cards.slice(0, DEFAULT_NEW_PER_DAY).map(c => c.category)).size).toBeGreaterThan(5);
    for (const p of PORTS) {
      const gap = Math.abs(cards.findIndex(c => c.id === `port:${p.port}`) - cards.findIndex(c => c.id === `proto:${p.protocol}`));
      expect(gap).withContext(p.port).toBeGreaterThanOrEqual(DEFAULT_NEW_PER_DAY);
    }
  });

  describe('typed answers', () => {
    const byId = (id: string) => cards.find(c => c.id === id)!;
    const mark = (id: string, typed: string) => byId(id).check!(typed).right;

    it('accepts the table\'s own answer for every port, both ways', () => {
      for (const p of PORTS) {
        expect(PORT_NAMES[p.port]).withContext(p.port).toBeDefined();
        expect(mark(`port:${p.port}`, p.protocol)).withContext(p.port).toBeTrue();
        expect(mark(`proto:${p.protocol}`, `${p.transport} ${p.port}`)).withContext(p.protocol).toBeTrue();
      }
    });

    it('rejects another port\'s protocol, and a list of guesses', () => {
      expect(mark('port:443', 'HTTP')).toBeFalse();
      expect(byId('port:443').check!('HTTP').note).toBe('HTTP is port 80.');
      expect(mark('port:22', 'telnet ssh ftp')).toBeFalse();
      expect(mark('port:587', 'SMTP submission')).toBeTrue();
      expect(mark('port:25', 'SMTP')).toBeTrue();
      expect(mark('port:995', 'POP3')).toBeFalse();
    });

    it('wants the port number and TCP or UDP, and nothing extra', () => {
      expect(mark('proto:SSH / SFTP / SCP', 'tcp 22')).toBeTrue();
      expect(mark('proto:SSH / SFTP / SCP', '22')).toBeFalse();
      expect(mark('proto:SSH / SFTP / SCP', '22 UDP')).toBeFalse();
      expect(mark('proto:SSH / SFTP / SCP', '21 22 23 tcp')).toBeFalse();
      expect(mark('proto:DHCP', 'UDP 67')).toBeFalse();
      expect(mark('proto:DHCP', '67 and 68 over udp')).toBeTrue();
      expect(mark('proto:DNS', 'port 53 TCP and UDP')).toBeTrue();
      expect(mark('proto:NetBIOS', 'TCP/UDP 137-139')).toBeTrue();
    });

    it('accepts the table\'s replacement for every legacy protocol', () => {
      for (const r of REPLACEMENTS) expect(mark(`legacy:${r.from.name}`, r.to.name)).withContext(r.from.name).toBeTrue();
      expect(mark('legacy:WEP', 'WPA')).toBeFalse();
    });

    it('checks RAID disks and failures in either order', () => {
      expect(mark('raid:RAID 5', '3 disks, survives 1 failure')).toBeTrue();
      expect(mark('raid:RAID 5', 'survives one, needs three')).toBeTrue();
      expect(mark('raid:RAID 5', '3 disks, survives 2')).toBeFalse();
      expect(mark('raid:RAID 0', '2 disks, no fault tolerance')).toBeTrue();
      expect(mark('raid:RAID 6', 'RAID 6 needs 4 and survives 2')).toBeTrue();
      expect(mark('raid:RAID 10 (1+0)', '4 disks, one per mirror')).toBeTrue();
      expect(RAID_LEVELS.every(r => byId(`raid:${r.level}`).check)).toBeTrue();
    });

    it('checks incident response steps and their order', () => {
      expect(mark('ir:4', 'step 4, stop it spreading')).toBeTrue();
      expect(mark('ir:4', 'step 3 or 4')).toBeFalse();
      expect(mark('ir:order', 'preparation, detection, analysis, containment, eradication, recovery, lessons learned')).toBeTrue();
      expect(mark('ir:order', 'preparation, detection, analysis, eradication, containment, recovery, lessons learned')).toBeFalse();
    });

    it('checks formulas and the names of metrics and service models', () => {
      expect(mark('risk:SLE (Single Loss Expectancy)', 'AV x EF')).toBeTrue();
      expect(mark('risk:SLE (Single Loss Expectancy)', 'SLE x ARO')).toBeFalse();
      expect(mark('risk:ALE (Annualized Loss Expectancy)', 'sle * aro')).toBeTrue();
      expect(mark('metric:RPO', 'recovery point objective')).toBeTrue();
      expect(mark('cloud:PaaS', 'platform as a service')).toBeTrue();
      expect(byId('cloud:Hybrid Cloud').check).toBeUndefined();
    });
  });
});
