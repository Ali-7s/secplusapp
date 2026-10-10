/**
 * Helpers for the "read an IPv4 address / CIDR block" widget. Pure functions so they can be unit tested.
 */

export interface AddressKind {
  type: string;
  note: string;
}

export interface CidrResult {
  ok: boolean;
  error?: string;
  ip?: string;
  kind?: AddressKind;
  /** Present when the input had a /prefix. */
  prefix?: number;
  mask?: string;
  network?: string;
  broadcast?: string;
  firstHost?: string;
  lastHost?: string;
  hosts?: string;
}

/** "192.168.1.10" -> 32-bit unsigned number, or null when it is not a valid IPv4 address. */
export function parseIpv4(text: string): number | null {
  const parts = text.trim().split('.');
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    value = value * 256 + octet;
  }
  return value >>> 0;
}

export function formatIpv4(value: number): string {
  return [24, 16, 8, 0].map(shift => (value >>> shift) & 255).join('.');
}

function inBlock(ip: number, base: string, prefix: number): boolean {
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return ((ip & mask) >>> 0) === ((parseIpv4(base)! & mask) >>> 0);
}

/** What kind of address is this? Order matters: the most specific blocks come first. */
export function describeAddress(ip: number): AddressKind {
  if (ip === 0xffffffff) return { type: 'Limited broadcast', note: 'Goes to every device on the local network. Routers never forward it.' };
  if (inBlock(ip, '127.0.0.0', 8)) return { type: 'Loopback', note: 'Always means "this computer". Used for testing; never leaves the machine.' };
  if (inBlock(ip, '169.254.0.0', 16)) return { type: 'Link-local (APIPA)', note: 'The device could not get an address from DHCP and gave itself one. A classic troubleshooting clue.' };
  if (inBlock(ip, '10.0.0.0', 8)) return { type: 'Private (RFC 1918)', note: 'Not routable on the internet. Large organizations use this range.' };
  if (inBlock(ip, '172.16.0.0', 12)) return { type: 'Private (RFC 1918)', note: 'Not routable on the internet. Only 172.16.x.x to 172.31.x.x is private.' };
  if (inBlock(ip, '192.168.0.0', 16)) return { type: 'Private (RFC 1918)', note: 'Not routable on the internet. Homes and small offices use this range.' };
  if (inBlock(ip, '100.64.0.0', 10)) return { type: 'Shared address space', note: 'Used by internet providers for carrier-grade NAT. Not a normal private range.' };
  if (inBlock(ip, '224.0.0.0', 4)) return { type: 'Multicast', note: 'Sent to a group of devices that subscribed, not to a single host.' };
  if (inBlock(ip, '0.0.0.0', 8)) return { type: 'This network / unspecified', note: '0.0.0.0 means "any" or "unknown", for example in a default route.' };
  if (inBlock(ip, '192.0.2.0', 24) || inBlock(ip, '198.51.100.0', 24) || inBlock(ip, '203.0.113.0', 24)) {
    return { type: 'Documentation range', note: 'Reserved for examples and books (this lesson uses them). Not used on real networks.' };
  }
  if (inBlock(ip, '240.0.0.0', 4)) return { type: 'Reserved', note: 'Set aside for future or special use.' };
  return { type: 'Public', note: 'Routable on the internet. Anyone anywhere can try to reach it, so it needs a firewall.' };
}

/** Parses "192.168.1.0/24" or a bare "192.168.1.10" and works out what it can. */
export function analyse(input: string): CidrResult {
  const text = input.trim();
  if (!text) return { ok: false, error: 'Type an IPv4 address such as 192.168.1.10 or a block such as 192.168.1.0/24.' };

  const [addressText, prefixText, ...rest] = text.split('/');
  if (rest.length) return { ok: false, error: 'Use one slash only, like 10.0.0.0/8.' };

  const ip = parseIpv4(addressText);
  if (ip === null) return { ok: false, error: 'That is not a valid IPv4 address. Use four numbers from 0 to 255 separated by dots.' };

  const result: CidrResult = { ok: true, ip: formatIpv4(ip), kind: describeAddress(ip) };
  if (prefixText === undefined) return result;

  if (!/^\d{1,2}$/.test(prefixText) || Number(prefixText) > 32) {
    return { ok: false, error: 'The number after the slash must be from 0 to 32.' };
  }
  const prefix = Number(prefixText);
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const network = (ip & mask) >>> 0;
  const broadcast = (network | (~mask >>> 0)) >>> 0;

  result.prefix = prefix;
  result.mask = formatIpv4(mask);
  result.network = formatIpv4(network);
  if (prefix === 32) {
    result.hosts = '1 (a single host)';
    result.firstHost = result.lastHost = result.network;
    result.broadcast = 'none';
  } else if (prefix === 31) {
    result.hosts = '2 (point-to-point link, RFC 3021)';
    result.firstHost = formatIpv4(network);
    result.lastHost = formatIpv4(broadcast);
    result.broadcast = 'none';
  } else {
    result.hosts = (2 ** (32 - prefix) - 2).toLocaleString('en-US');
    result.firstHost = formatIpv4(network + 1);
    result.lastHost = formatIpv4(broadcast - 1);
    result.broadcast = formatIpv4(broadcast);
  }
  // Describe the network the block belongs to rather than the typed host address.
  result.kind = describeAddress(network);
  return result;
}
