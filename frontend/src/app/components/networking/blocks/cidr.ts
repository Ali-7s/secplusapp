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

/** The fields the reader shows, in the order a person would work them out. */
export type CidrField = 'mask' | 'network' | 'broadcast' | 'firstHost' | 'lastHost' | 'hosts';

/** Plain-English working for each value, using the numbers of the address being read. Text supports **bold** and `code`. */
export type CidrWorking = Record<CidrField, string>;

const MASK_OCTET: Record<number, number> = { 1: 128, 2: 192, 3: 224, 4: 240, 5: 248, 6: 252, 7: 254 };
const ORDINAL = ['1st', '2nd', '3rd', '4th'];

/** Explains how each value of `ip/prefix` is worked out, step by step. */
export function explain(ipText: string, prefix: number): CidrWorking | null {
  const ip = parseIpv4(ipText);
  if (ip === null || prefix < 0 || prefix > 32) return null;
  const r = analyse(`${ipText}/${prefix}`);
  const octets = [24, 16, 8, 0].map(shift => (ip >>> shift) & 255);
  const hostBits = 32 - prefix;
  const size = 2 ** hostBits;
  const sizeText = size.toLocaleString('en-US');
  const full = Math.floor(prefix / 8);
  const rem = prefix % 8;
  const code = (s: string | undefined) => '`' + s + '`';

  if (prefix === 32) {
    const one = `A /32 has no host bits at all: it is exactly one address, ${code(r.ip)}. It is used in firewall rules to mean "this one device".`;
    return { mask: 'All 32 bits are network bits, so every octet is 255: `255.255.255.255`.', network: one, broadcast: 'A single address has no separate broadcast address.', firstHost: one, lastHost: one, hosts: 'One address, and nothing is reserved, so 1 usable.' };
  }
  if (prefix === 31) {
    const two = `A /31 has 1 host bit, so it holds just 2 addresses: ${code(r.network)} and ${code(r.broadcast === 'none' ? r.lastHost : r.broadcast)}. Routers that support it use both for a link between them, with no network or broadcast address.`;
    return { mask: 'Three full octets (255.255.255) plus 7 of the last 8 bits switched on, which is 254: `255.255.255.254`.', network: two, broadcast: 'A /31 has no broadcast address: both addresses belong to the two routers.', firstHost: two, lastHost: two, hosts: two };
  }

  // The mask
  let mask: string;
  if (rem === 0) {
    mask = `/${prefix} means the first ${prefix} of the 32 bits are the network part. ${prefix} ÷ 8 = ${full} full octet${full === 1 ? '' : 's'}, and a full octet is 255. The rest are 0: ${code(r.mask)}.`;
  } else {
    const fullPart = full ? `${full} full octet${full === 1 ? '' : 's'} (${full * 8} bits) give${full === 1 ? 's' : ''} ${Array(full).fill('255').join('.')}, and ` : '';
    mask = `/${prefix} means ${prefix} network bits. ${fullPart}${rem} bit${rem === 1 ? ' is' : 's are'} left over for the ${ORDINAL[full]} octet. Switching on ${rem === 1 ? 'one bit' : rem + ' bits'} from the left gives **${MASK_OCTET[rem]}** (1 bit = 128, 2 = 192, 3 = 224, 4 = 240, 5 = 248, 6 = 252, 7 = 254). So the mask is ${code(r.mask)}.`;
  }

  // Network and broadcast
  let network: string;
  let broadcast: string;
  if (rem === 0) {
    const hostOctets = 4 - full;
    const which = hostOctets === 1 ? 'the last octet' : `the last ${hostOctets} octets`;
    network = `The mask ends on an octet boundary, so the host part is simply ${which}. Set ${hostOctets === 1 ? 'it' : 'them'} to **0** and you have the network address: ${code(r.network)}. It is the first address of the block and names the network itself, so no device can be given it.`;
    broadcast = `Set the host part (${which}) to **255** instead: ${code(r.broadcast)}. It is the last address of the block. A message sent to it reaches every device on the network, so no device can be given it either.`;
  } else {
    const block = 2 ** (8 - rem);
    const value = octets[full];
    const start = Math.floor(value / block) * block;
    const end = start + block - 1;
    const starts = Array.from({ length: Math.min(256 / block, 8) }, (_, i) => i * block);
    const more = 256 / block > 8 ? ', and so on' : '';
    const after = full < 3 ? ', and every octet after it set to 0' : '';
    const afterB = full < 3 ? ', and every octet after it set to 255' : '';
    network = `Look at the ${ORDINAL[full]} octet, where the mask is ${MASK_OCTET[rem]} (not 255 or 0). Subnets there come in blocks of 256 − ${MASK_OCTET[rem]} = **${block}**, which start at ${starts.join(', ')}${more}. Your address has **${value}** in that octet, which falls in the block that starts at **${start}** (it runs to ${end}). So the network address is that start${after}: ${code(r.network)}. It names the network itself, so no device can be given it.`;
    broadcast = `The broadcast is the **last** address of the block. The block starts at ${start} and holds ${block}, so it ends at ${start} + ${block} − 1 = **${end}**${afterB}: ${code(r.broadcast)}. A message sent to it reaches every device on the network, so no device can be given it either.`;
  }

  const firstHost = `The very first address of the block (${code(r.network)}) is the network address, which is reserved. So the first address a device can use is the **next one**: network + 1 = ${code(r.firstHost)}.`;
  const lastHost = `The very last address of the block (${code(r.broadcast)}) is the broadcast address, which is reserved. So the last address a device can use is the **one before it**: broadcast − 1 = ${code(r.lastHost)}.`;
  const hosts = `There are 32 − ${prefix} = **${hostBits}** host bits, and each one doubles the count, so the block holds 2 to the power of ${hostBits} = **${sizeText}** addresses. Two are reserved (the network and the broadcast address), leaving ${sizeText} − 2 = **${r.hosts}** for devices.`;
  return { mask, network, broadcast, firstHost, lastHost, hosts };
}
