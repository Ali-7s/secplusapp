/**
 * The on-path lab's engine: a victim, a gateway and an attacker on one switch. The attacker forges ARP replies to sit
 * in the middle, then watches what the victim's sign-ins reveal. Pure, so the spec can walk every mission.
 */

export const VICTIM = { ip: '10.0.0.23', mac: 'aa:aa:aa:23:23:23' };
export const GATEWAY = { ip: '10.0.0.1', mac: '11:11:11:01:01:01' };
export const ATTACKER = { ip: '10.0.0.66', mac: 'ee:ee:ee:66:66:66' };

export type OnpathAction = 'poison-victim' | 'poison-gateway' | 'forward' | 'strip' | 'heal' | 'dai' | 'intranet' | 'shop' | 'bank';
export type MissionId = 'both-ways' | 'blackhole' | 'intranet' | 'shop' | 'bank' | 'dai';

export interface LogLine { who: 'attacker' | 'victim' | 'switch' | 'capture'; tone: 'bad' | 'good' | 'info'; text: string }

export interface OnpathState {
  /** The victim believes the gateway is at the attacker's MAC. */
  victimPoisoned: boolean;
  /** The gateway believes the victim is at the attacker's MAC. */
  gatewayPoisoned: boolean;
  forwarding: boolean;
  stripping: boolean;
  dai: boolean;
  log: LogLine[];
  done: MissionId[];
}

export const START: OnpathState = { victimPoisoned: false, gatewayPoisoned: false, forwarding: false, stripping: false, dai: false, log: [], done: [] };

export const MISSIONS: { id: MissionId; text: string }[] = [
  { id: 'blackhole', text: 'Poison the victim without forwarding, then have them browse. What do they notice?' },
  { id: 'both-ways', text: 'Get both directions of the victim\'s traffic through you, without breaking their connection' },
  { id: 'intranet', text: 'Capture the password for the intranet (plain HTTP)' },
  { id: 'shop', text: 'Capture the password for the shop, which uses HTTPS' },
  { id: 'bank', text: 'Try the same against the bank, which uses HSTS' },
  { id: 'dai', text: 'Switch on Dynamic ARP Inspection and try to poison again' },
];

const done = (s: OnpathState, ...ids: MissionId[]): MissionId[] => MISSIONS.map(m => m.id).filter(id => ids.includes(id) || s.done.includes(id));

export function act(s: OnpathState, a: OnpathAction): OnpathState {
  const log: LogLine[] = [];
  let n: OnpathState = { ...s };
  const forged = (target: string, claim: { ip: string }) => {
    if (s.dai) {
      log.push({ who: 'switch', tone: 'good', text: `Dynamic ARP Inspection: an ARP reply on the attacker's port says ${claim.ip} is at ${ATTACKER.mac}. The DHCP snooping table says otherwise. Dropped.` });
      n.done = done(n, 'dai');
      return false;
    }
    log.push({ who: 'attacker', tone: 'bad', text: `Sent ${target} an unrequested ARP reply: "${claim.ip} is at ${ATTACKER.mac}". It overwrote its ARP cache.` });
    return true;
  };

  switch (a) {
    case 'poison-victim':
      if (forged('the victim', GATEWAY)) n.victimPoisoned = true;
      break;
    case 'poison-gateway':
      if (forged('the gateway', VICTIM)) n.gatewayPoisoned = true;
      break;
    case 'forward':
      n.forwarding = !s.forwarding;
      log.push({ who: 'attacker', tone: 'info', text: n.forwarding ? 'IP forwarding on: traffic sent to you is passed on to its real destination.' : 'IP forwarding off: traffic sent to you goes nowhere.' });
      break;
    case 'strip':
      n.stripping = !s.stripping;
      log.push({ who: 'attacker', tone: 'info', text: n.stripping ? 'SSL stripping on: when the victim asks for a page over plain HTTP, you fetch it over HTTPS yourself and hand it back over HTTP.' : 'SSL stripping off.' });
      break;
    case 'heal':
      n.victimPoisoned = false; n.gatewayPoisoned = false;
      log.push({ who: 'attacker', tone: 'info', text: 'Stopped sending forged replies. The real ARP replies win again and both caches are correct.' });
      break;
    case 'dai':
      n.dai = !s.dai;
      if (n.dai) { n.victimPoisoned = false; n.gatewayPoisoned = false; }
      log.push({ who: 'switch', tone: n.dai ? 'good' : 'info', text: n.dai ? 'Dynamic ARP Inspection on: the switch checks every ARP reply against the addresses DHCP handed out. Forged entries were flushed.' : 'Dynamic ARP Inspection off.' });
      break;
    default: {
      const site = a;
      const out = s.victimPoisoned, back = s.gatewayPoisoned;
      const name = site === 'intranet' ? 'http://intranet.corp.example' : site === 'shop' ? 'shop.example' : 'bank.example';
      log.push({ who: 'victim', tone: 'info', text: `The victim types ${name} and signs in.` });
      if ((out || back) && !s.forwarding) {
        log.push({ who: 'victim', tone: 'bad', text: 'The page never loads: the traffic goes to the attacker\'s machine and stops there. The victim calls the help desk. Without forwarding, on-path is just a denial of service, and a noisy one.' });
        n.done = done(n, 'blackhole');
        break;
      }
      if (!out && !back) {
        log.push({ who: 'victim', tone: 'good', text: 'It works. The traffic went straight to the gateway; the attacker saw none of it.' });
        break;
      }
      log.push({ who: 'victim', tone: 'info', text: `It works normally. The path: ${out ? 'victim → attacker → gateway' : 'victim → gateway'}, and back ${back ? 'gateway → attacker → victim' : 'gateway → victim'}.` });
      if (out && back) n.done = done(n, 'both-ways');
      if (site === 'intranet') {
        if (out) { log.push({ who: 'capture', tone: 'bad', text: 'POST /login  user=sam&password=Harbour-Lights-77  (plain HTTP: readable by anyone in the path)' }); n.done = done(n, 'intranet'); }
        else log.push({ who: 'capture', tone: 'info', text: 'Only the replies came through you: the intranet\'s pages and a session cookie, but not the password Sam typed. You need the victim\'s outgoing traffic too.' });
      } else if (site === 'shop') {
        if (out && s.stripping) {
          log.push({ who: 'capture', tone: 'bad', text: 'Victim asked for http://shop.example. You fetched the HTTPS page yourself and sent it back over HTTP. Captured: POST /login  email=sam@...  password=Harbour-Lights-77' });
          log.push({ who: 'victim', tone: 'info', text: 'The victim\'s address bar shows http://shop.example, with no padlock. Few people notice.' });
          n.done = done(n, 'shop');
        } else log.push({ who: 'capture', tone: 'info', text: out ? 'You saw the first plain HTTP request, then the shop redirected to HTTPS. Everything after that is encrypted TLS: unreadable. Try SSL stripping.' : 'Encrypted TLS traffic only: unreadable.' });
      } else {
        log.push({ who: 'capture', tone: 'good', text: s.stripping
          ? 'Nothing to strip: the bank uses HSTS, so the browser went straight to HTTPS without ever asking over HTTP. All you see is encrypted TLS. A forged certificate would get a warning that cannot be clicked past.'
          : 'Encrypted TLS only. Even in the middle, you cannot read or change it.' });
        if (out) n.done = done(n, 'bank');
      }
    }
  }
  n.log = [...s.log, ...log].slice(-40);
  return n;
}
