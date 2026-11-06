import { TestBed } from '@angular/core/testing';
import { CaptureLabComponent } from './capture-lab.component';
import { CAPTURES, answersOf, checkAnswer, packetsOf } from './captures';
import { FilterError, Pkt, bpfFilter, displayFilter, infoOf, layersOf, protocolOf, tcpdumpLine } from './packets';

const nos = (id: string, pred: (p: Pkt) => boolean) => packetsOf(CAPTURES.find(c => c.id === id)!).filter(pred).map(p => p.no);

describe('packet captures', () => {
  for (const c of CAPTURES) {
    describe(c.title, () => {
      const packets = packetsOf(c);

      it('numbers packets in order, in time order, with every column filled', () => {
        packets.forEach((p, i) => {
          expect(p.no).toBe(i + 1);
          if (i) expect(p.t).withContext(`packet ${p.no}`).toBeGreaterThanOrEqual(packets[i - 1].t);
          expect(protocolOf(p)).toBeTruthy();
          expect(infoOf(p)).withContext(`packet ${p.no}`).toBeTruthy();
          expect(tcpdumpLine(p)).toContain(p.arp ? 'ARP' : p.ip!.src);
          expect(layersOf(p).length).toBeGreaterThanOrEqual(2);
        });
      });

      it('answers every question from the packets, and refuses blanks and wrong answers', () => {
        for (const q of c.questions) {
          const ans = answersOf(c, q);
          expect(ans.length).withContext(q.id).toBeGreaterThan(0);
          for (const a of ans) expect(checkAnswer(c, q, a)).withContext(`${q.id}: ${a}`).toBeTrue();
          expect(checkAnswer(c, q, '')).withContext(q.id).toBeFalse();
          expect(checkAnswer(c, q, '12345678')).withContext(q.id).toBeFalse();
          expect(q.hint && q.why).withContext(q.id).toBeTruthy();
        }
      });

      it('offers filters that parse and find packets', () => {
        for (const f of c.filters) {
          expect(packets.filter(displayFilter(f)).length).withContext(f).toBeGreaterThan(0);
          expect(packets.filter(displayFilter(f)).length).withContext(f).toBeLessThan(packets.length);
        }
      });

      it('builds a "Filter on this" filter for every field that finds the packet it came from', () => {
        const lab = TestBed.runInInjectionContext(() => new CaptureLabComponent());
        for (const p of packets) {
          for (const l of layersOf(p, c.gateway)) {
            for (const f of l.fields) {
              const ff = lab.fieldFilter(f);
              if (!ff) continue;
              expect(displayFilter(ff)(p)).withContext(`packet ${p.no} ${ff}`).toBeTrue();
            }
          }
        }
      });

      it('keeps TCP honest: every SYN-ACK acknowledges its SYN, and every reset or SYN-ACK answers a SYN', () => {
        for (const p of packets.filter(x => x.tcp?.flags.syn && x.tcp.flags.ack)) {
          const syn = packets.find(x => x.tcp?.flags.syn && !x.tcp.flags.ack && x.tcp.sport === p.tcp!.dport && x.tcp.dport === p.tcp!.sport && x.ip!.src === p.ip!.dst);
          expect(syn).withContext(`packet ${p.no}`).toBeDefined();
          expect(p.tcp!.ack).toBe(syn!.tcp!.seq + 1);
        }
      });
    });
  }

  it('keeps the attacker out of the device lists of the captures where finding them is the question', () => {
    expect(CAPTURES.find(c => c.id === 'arp')!.hosts.some(h => h.ip === '10.0.4.122')).toBeFalse();
    expect(CAPTURES.find(c => c.id === 'scan')!.hosts.some(h => h.ip === '10.0.4.122')).toBeFalse();
  });

  it('shows ARP poisoning as two copies of each packet, the second one hop shorter', () => {
    const c = CAPTURES.find(x => x.id === 'arp')!;
    const post = packetsOf(c).filter(p => p.app?.http?.method === 'POST');
    expect(post.length).toBe(2);
    expect(post.map(p => p.ip!.ttl)).toEqual([64, 63]);
    expect(post[0].eth.dst).toBe('3c:52:82:4a:19:7e');
    expect(post[1].eth.src).toBe('3c:52:82:4a:19:7e');
  });
});

describe('display filters', () => {
  it('compares fields, subnets and flags, and joins them', () => {
    expect(nos('scan', displayFilter('tcp.flags.syn == 1 && tcp.flags.ack == 1 && ip.src == 10.0.2.20')).length).toBe(5);
    expect(nos('scan', displayFilter('tcp.flags.reset')).length).toBe(nos('scan', displayFilter('tcp.flags.reset == 1')).length);
    expect(nos('join', displayFilter('ip.addr == 192.0.2.0/24')).length).toBe(14);
    expect(nos('join', displayFilter('dns.qry.name contains "shop"'))).toEqual([11, 12]);
    expect(nos('join', displayFilter('dhcp || arp')).length).toBe(8);
    expect(nos('join', displayFilter('!(arp or dhcp) and not tcp')).length).toBe(6);
    expect(nos('join', displayFilter('  '))).toEqual(nos('join', () => true));
  });

  it('explains mistakes', () => {
    expect(() => displayFilter('ip.addr = 10.0.4.1')).toThrowError(FilterError, /==/);
    expect(() => displayFilter('nonsense')).toThrowError(FilterError);
    expect(() => displayFilter('ip.addr ==')).toThrowError(FilterError);
    expect(() => displayFilter('(tcp')).toThrowError(FilterError);
    expect(() => displayFilter('tcp udp')).toThrowError(FilterError);
  });
});

describe('tcpdump filters', () => {
  it('reads hosts, ports, nets, protocols and flags', () => {
    expect(nos('scan', bpfFilter('tcp[tcpflags] & tcp-syn != 0 and src host 10.0.4.122')).length).toBe(17);
    expect(nos('scan', bpfFilter('tcp[tcpflags] & (tcp-syn|tcp-ack) == (tcp-syn|tcp-ack)')).length).toBe(5);
    expect(nos('scan', bpfFilter('tcp[tcpflags]&tcp-syn!=0')).length).toBe(23);
    expect(nos('trouble', bpfFilter('tcp port 8443'))).toEqual([11, 12, 13]);
    expect(nos('trouble', bpfFilter('icmp')).length).toBe(6);
    expect(nos('arp', bpfFilter('arp and ether src 3c:52:82:4a:19:7e')).length).toBe(9);
    expect(nos('join', bpfFilter('not port 443 and not arp')).length).toBe(10);
    expect(nos('join', bpfFilter('dst net 192.0.2.0/24')).length).toBe(8);
  });

  it('rejects broken filters', () => {
    expect(() => bpfFilter('host')).toThrowError(FilterError);
    expect(() => bpfFilter('foo bar')).toThrowError(FilterError);
    expect(() => bpfFilter('host shop')).toThrowError(FilterError);
  });

  it('prints lines the way tcpdump does', () => {
    const scan = packetsOf(CAPTURES.find(c => c.id === 'scan')!);
    const synAck = scan.find(p => p.tcp?.flags.syn && p.tcp.flags.ack && p.tcp.sport === 22)!;
    expect(tcpdumpLine(synAck)).toMatch(/^\d\d:\d\d:\d\d\.\d{6} IP 10\.0\.2\.20\.22 > 10\.0\.4\.122\.41522: Flags \[S\.\], seq 0, ack 1, win 64240, length 0$/);
    const arp = packetsOf(CAPTURES.find(c => c.id === 'arp')!).find(p => p.arp?.op === 2 && p.arp.senderMac === '3c:52:82:4a:19:7e')!;
    expect(tcpdumpLine(arp, { e: true })).toContain('3c:52:82:4a:19:7e > d8:bb:c1:0e:73:5a, ethertype ARP (0x0806), length 42: ARP, Reply 10.0.4.1 is-at 3c:52:82:4a:19:7e');
  });
});
