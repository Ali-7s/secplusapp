import { analyse, describeAddress, explain, formatIpv4, parseIpv4 } from './cidr';

describe('parseIpv4 and formatIpv4', () => {
  it('round-trips valid addresses', () => {
    expect(formatIpv4(parseIpv4('192.168.1.25')!)).toBe('192.168.1.25');
    expect(formatIpv4(parseIpv4('0.0.0.0')!)).toBe('0.0.0.0');
    expect(formatIpv4(parseIpv4('255.255.255.255')!)).toBe('255.255.255.255');
  });

  it('rejects things that are not IPv4 addresses', () => {
    for (const bad of ['', '1.2.3', '1.2.3.4.5', '256.1.1.1', '1.2.3.-4', 'a.b.c.d', '1.2.3.4/24', '01234.1.1.1']) {
      expect(parseIpv4(bad)).withContext(bad).toBeNull();
    }
  });
});

describe('describeAddress', () => {
  const type = (ip: string) => describeAddress(parseIpv4(ip)!).type;

  it('recognizes private, loopback and link-local ranges', () => {
    expect(type('10.200.3.4')).toBe('Private (RFC 1918)');
    expect(type('172.16.0.1')).toBe('Private (RFC 1918)');
    expect(type('172.31.255.254')).toBe('Private (RFC 1918)');
    expect(type('192.168.50.1')).toBe('Private (RFC 1918)');
    expect(type('127.0.0.1')).toBe('Loopback');
    expect(type('169.254.12.7')).toBe('Link-local (APIPA)');
  });

  it('knows 172.16.0.0/12 stops at 172.31', () => {
    expect(type('172.32.0.1')).toBe('Public');
    expect(type('172.15.255.255')).toBe('Public');
  });

  it('recognizes the other special ranges', () => {
    expect(type('224.0.0.5')).toBe('Multicast');
    expect(type('203.0.113.80')).toBe('Documentation range');
    expect(type('255.255.255.255')).toBe('Limited broadcast');
    expect(type('8.8.8.8')).toBe('Public');
  });
});

describe('analyse', () => {
  it('works out a /24', () => {
    const r = analyse('192.168.1.0/24');
    expect(r.ok).toBeTrue();
    expect(r.mask).toBe('255.255.255.0');
    expect(r.network).toBe('192.168.1.0');
    expect(r.broadcast).toBe('192.168.1.255');
    expect(r.firstHost).toBe('192.168.1.1');
    expect(r.lastHost).toBe('192.168.1.254');
    expect(r.hosts).toBe('254');
    expect(r.kind?.type).toBe('Private (RFC 1918)');
  });

  it('snaps a host address to its network', () => {
    const r = analyse('10.1.2.77/8');
    expect(r.network).toBe('10.0.0.0');
    expect(r.hosts).toBe('16,777,214');
  });

  it('handles a non-octet boundary', () => {
    const r = analyse('192.168.1.130/25');
    expect(r.network).toBe('192.168.1.128');
    expect(r.broadcast).toBe('192.168.1.255');
    expect(r.hosts).toBe('126');
  });

  it('handles the small prefixes', () => {
    expect(analyse('10.1.2.0/30').hosts).toBe('2');
    expect(analyse('10.1.2.5/32').hosts).toBe('1 (a single host)');
    expect(analyse('10.1.2.4/31').hosts).toContain('2');
    expect(analyse('0.0.0.0/0').mask).toBe('0.0.0.0');
  });

  it('describes a bare address', () => {
    const r = analyse('169.254.7.20');
    expect(r.ok).toBeTrue();
    expect(r.prefix).toBeUndefined();
    expect(r.kind?.type).toBe('Link-local (APIPA)');
  });

  it('explains what is wrong with bad input', () => {
    expect(analyse('').ok).toBeFalse();
    expect(analyse('300.1.1.1').ok).toBeFalse();
    expect(analyse('10.0.0.0/33').ok).toBeFalse();
    expect(analyse('10.0.0.0/abc').ok).toBeFalse();
    expect(analyse('10.0.0.0/8/8').ok).toBeFalse();
    expect(analyse('10.0.0.0/8/8').error).toBeTruthy();
  });
});

describe('explain', () => {
  it('walks through a /25 with its own numbers', () => {
    const w = explain('192.168.1.128', 25)!;
    expect(w.mask).toContain('**128**');
    expect(w.network).toContain('blocks of 256 − 128 = **128**');
    expect(w.network).toContain('`192.168.1.128`');
    expect(w.broadcast).toContain('128 + 128 − 1 = **255**');
    expect(w.firstHost).toContain('`192.168.1.129`');
    expect(w.lastHost).toContain('`192.168.1.254`');
    expect(w.hosts).toContain('**7** host bits');
    expect(w.hosts).toContain('**126**');
  });

  it('handles a block boundary on a whole octet, and a split inside an earlier octet', () => {
    const w24 = explain('192.168.1.77', 24)!;
    expect(w24.network).toContain('`192.168.1.0`');
    expect(w24.broadcast).toContain('`192.168.1.255`');
    const w12 = explain('172.20.5.9', 12)!;
    expect(w12.network).toContain('2nd octet');
    expect(w12.network).toContain('starts at **16**');
    expect(w12.network).toContain('`172.16.0.0`');
    expect(w12.broadcast).toContain('`172.31.255.255`');
  });

  it('explains the special /31 and /32 cases and rejects bad input', () => {
    expect(explain('10.0.0.5', 32)!.hosts).toContain('1 usable');
    expect(explain('10.0.0.4', 31)!.broadcast).toContain('no broadcast');
    expect(explain('300.1.1.1', 24)).toBeNull();
  });
});
