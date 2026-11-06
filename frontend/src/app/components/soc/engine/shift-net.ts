/**
 * Shift 4: the network itself. Three problems surface in one afternoon: a server blocked from reaching a partner,
 * a device on the floor 2 LAN lying about the gateway (ARP spoofing), and DNS failing for the whole office. The
 * analyst works from their own machine outwards (ip, ss, ping, traceroute, dig) and reads the packet captures the
 * sensor saves with tcpdump.
 */

import { Capture, Host, Pkt, app } from '../../networking/blocks/capture/packets';
import { Ev, at, dns, fw, ids } from './events';
import { PEOPLE, Rng, SITES, int, pick } from './env';
import { Shift } from './model';
import { LAPTOP_MACS } from './net';

const H = (name: string, ip: string, mac: string): Host => ({ name, ip, mac });

const ROGUE_MAC = 'b4:2e:99:5c:1e:42';
const ROGUE_IP = '10.0.4.177';
const ROGUE_PORT = 'Gi1/0/37';
const FAULT = at('13:52:30');
const TYPO = '203.0.113.35';

const GW4 = H('gw-floor2', '10.0.4.1', '00:1a:2b:00:04:01');
const ALEX = H('LT-101', '10.0.4.101', LAPTOP_MACS['LT-101']);
const JO = H('LT-106', '10.0.4.106', LAPTOP_MACS['LT-106']);
const MIA = H('LT-118', '10.0.4.118', LAPTOP_MACS['LT-118']);
const ROGUE = H('unknown', ROGUE_IP, ROGUE_MAC);
const DNS01 = H('dns01', '10.0.1.53', '00:1a:2b:00:01:53');
const INTRA = H('intranet', '10.0.2.20', '00:15:5d:02:00:20');
const CRM = H('crm.saas-vendor.example', '192.0.2.21', '00:00:00:00:00:00');
const DOCS_SITE = H('docs.office-suite.example', '192.0.2.23', '00:00:00:00:00:00');

/** The floor 2 mirror port, 13:43:50 to 13:46:50: a device joins the conversation between a laptop and its gateway. */
function floor2Capture(): Pkt[] {
  const c = new Capture({ start: at('13:43:50') + 0.211, lan: '10.0.4.0/24', gateway: GW4 });
  // Ordinary traffic: Jo opens the CRM over HTTPS.
  c.dns(JO, DNS01, 'crm.saas-vendor.example', 'A', [CRM.ip], 52110);
  const jo = c.wait(0.004).tcp(JO, CRM, 52114, 443).open();
  jo.send(true, 517, app.clientHello('crm.saas-vendor.example'), 0.0002);
  jo.send(false, 1384, app.serverHello());
  jo.send(true, 640, app.tlsData('request'));
  jo.send(false, 5210, app.tlsData('response'));
  // The device asks, honestly, for the gateway and for Alex's laptop: it learns their real MACs.
  c.wait(6.3).arpRequest(ROGUE, GW4.ip).wait(0.0011).arpReply(GW4, ROGUE);
  c.wait(0.4).arpRequest(ROGUE, ALEX.ip).wait(0.0016).arpReply(ALEX, ROGUE);
  // From 13:44:12: unasked-for replies, every two seconds, telling each side the other is at the device's MAC.
  c.at(at('13:44:12') + 0.05);
  for (let k = 0; k < 3; k++) {
    c.arpReply(ROGUE, ALEX, GW4.ip).arpReply(ROGUE, GW4, ALEX.ip);
    c.wait(2);
  }
  c.poison(ALEX.ip, GW4.ip, ROGUE).poison(GW4.ip, ALEX.ip, ROGUE);
  // Alex signs in to the old intranet, over plain HTTP. Every frame now goes through the device first.
  c.dns(ALEX, DNS01, 'intranet.fernco.example', 'A', [INTRA.ip], 61022);
  const web = c.wait(0.003).tcp(ALEX, INTRA, 51004, 80, { serverTtl: 63 }).open();
  web.send(true, 402, app.http('GET /login HTTP/1.1\nHost: intranet.fernco.example\n'));
  web.send(false, 2210, app.http('HTTP/1.1 200 OK\nContent-Type: text/html\n'));
  web.send(true, 488, app.http('POST /login HTTP/1.1\nHost: intranet.fernco.example\nContent-Type: application/x-www-form-urlencoded\n\nuser=a.ng&password=Harbour-Lights-9'), 3.8);
  web.send(false, 214, app.http('HTTP/1.1 302 Found\nLocation: /home\n'));
  web.close();
  for (let k = 0; k < 3; k++) {
    c.wait(1.2).arpReply(ROGUE, ALEX, GW4.ip).arpReply(ROGUE, GW4, ALEX.ip);
  }
  // HTTPS through the same device: it sees the site name (SNI), not the contents.
  c.wait(0.5).dns(ALEX, DNS01, 'crm.saas-vendor.example', 'A', [CRM.ip], 61040);
  const tls = c.wait(0.003).tcp(ALEX, CRM, 51020, 443).open();
  tls.send(true, 517, app.clientHello('crm.saas-vendor.example'), 0.0002);
  tls.send(false, 1384, app.serverHello());
  tls.send(true, 820, app.tlsData('request'));
  for (let k = 0; k < 4; k++) {
    c.wait(2).arpReply(ROGUE, ALEX, GW4.ip).arpReply(ROGUE, GW4, ALEX.ip);
  }
  return c.packets;
}

const GW6 = H('gw-servers-6', '10.0.6.1', '00:1a:2b:00:06:01');
const BK01 = H('bk01', '10.0.6.40', '00:15:5d:06:00:40');
const DNS01_FAR = H('dns01', '10.0.1.53', '00:1a:2b:00:01:53');
const VAULT = H('sftp.offsite-vault.example', '198.51.100.200', '00:00:00:00:00:00');
const VAULT_API = H('api.offsite-vault.example', '198.51.100.201', '00:00:00:00:00:00');

/** bk01's own traffic, 13:10: HTTPS to the partner works, SFTP on port 22 goes unanswered. */
function backupCapture(): Pkt[] {
  const c = new Capture({ start: at('13:10:05') + 0.402, lan: '10.0.6.0/24', gateway: GW6 });
  c.dns(BK01, DNS01_FAR, 'api.offsite-vault.example', 'A', [VAULT_API.ip], 40108);
  const api = c.wait(0.004).tcp(BK01, VAULT_API, 46010, 443).open();
  api.send(true, 517, app.clientHello('api.offsite-vault.example'), 0.0002);
  api.send(false, 1384, app.serverHello());
  api.send(true, 310, app.tlsData('request'));
  api.send(false, 190, app.tlsData('response'));
  api.close();
  c.wait(1.5).dns(BK01, DNS01_FAR, 'sftp.offsite-vault.example', 'A', [VAULT.ip], 40112);
  // The firewall drops the SYNs silently: no SYN-ACK, no reset, so bk01 retries at 1, 2 and 4 seconds.
  c.wait(0.003).tcp(BK01, VAULT, 46022, 22).unanswered(4, 1);
  c.at(at('13:11:07') + 0.118).tcp(BK01, VAULT, 46031, 22).unanswered(4, 1);
  return c.packets;
}

const GW1 = H('gw-servers-1', '10.0.1.1', '00:1a:2b:00:01:01');
const DNS01_LOCAL = H('dns01', '10.0.1.53', '00:1a:2b:00:01:53');
const FWD = H('mistyped forwarder', TYPO, '00:00:00:00:00:00');

/** At dns01, 14:05: an inside name is answered at once; an outside name is forwarded, nothing comes back, SERVFAIL. */
function dnsCapture(): Pkt[] {
  const c = new Capture({ start: at('14:05:31') + 0.733, lan: '10.0.1.0/24', gateway: GW1 });
  c.dns(JO, DNS01_LOCAL, 'intranet.fernco.example', 'A', [INTRA.ip], 51811, { delay: 0.0004 });
  const forward = (sport: number, name: string) => () => {
    c.wait(0.0003).dns(DNS01_LOCAL, FWD, name, 'A', [], sport, { noReply: true });
    c.wait(1.2).dns(DNS01_LOCAL, FWD, name, 'A', [], sport + 1, { noReply: true });
    c.wait(1.6).dns(DNS01_LOCAL, FWD, name, 'A', [], sport + 2, { noReply: true });
  };
  c.wait(0.9).dns(JO, DNS01_LOCAL, 'crm.saas-vendor.example', 'A', [], 51812, { servfail: true, during: forward(33410, 'crm.saas-vendor.example'), delay: 0.31 });
  c.wait(0.6).dns(MIA, DNS01_LOCAL, 'docs.office-suite.example', 'A', [], 60214, { servfail: true, during: forward(33420, 'docs.office-suite.example'), delay: 0.29 });
  c.wait(0.2).dns(MIA, DNS01_LOCAL, 'files.fernco.example', 'A', ['10.0.2.30'], 60215, { delay: 0.0005 });
  return c.packets;
}

// ── Company notes for this shift ──────────────────────────────────────────

const deskPort = (i: number) => `Gi1/0/${i + 1}`;

const MAC_TABLE = `sw-floor2: MAC address table, VLAN 40 (exported 12:30 by the network team)

Vlan    Mac Address          Type       Port
----    -----------          --------   --------
  40    00:1a:2b:00:04:01    STATIC     Gi1/0/48
${PEOPLE.map((p, i) => `  40    ${LAPTOP_MACS[p.host]}    DYNAMIC    ${deskPort(i)}`).join('\n')}
  40    00:80:77:5a:2e:11    DYNAMIC    Gi1/0/30
  40    ${ROGUE_MAC}    DYNAMIC    ${ROGUE_PORT}
`;

const PORT_MAP = `port,location,assigned_to
${PEOPLE.map((p, i) => `${deskPort(i)},Desk 2.${String(i + 1).padStart(2, '0')},${p.host} (${p.user})`).join('\n')}
Gi1/0/30,Print room,printer-floor2
Gi1/0/37,Meeting room 2.14 wall socket B,(nothing assigned: live for visitors' screens)
Gi1/0/48,Floor 2 riser,uplink to gw-floor2
`;

// ── The shift ─────────────────────────────────────────────────────────────

const isOutside = (q: string) => !q.endsWith('fernco.example');

export const NET_SHIFT: Shift = {
  id: 'net',
  number: 4,
  title: 'Afternoon: the network',
  tagline: 'A blocked backup, a stranger on the floor 2 LAN, and DNS failing for everyone.',
  start: at('13:00'),
  end: at('15:00'),
  skills: ['ip, ss, ping, traceroute', 'dig and DNS response codes', 'tcpdump -r and capture filters', 'ARP and switch ports', 'firewall logs'],
  brief: [
    'Afternoon shift, 13:00 to 15:00. Today is about the network itself: how traffic gets from one device to another, and what it looks like when that breaks or someone interferes. Your workstation soc-ws (10.0.8.15) can run ping, traceroute, dig and the other network tools, and read the packet captures that sensor01 saves in /var/captures.',
    'Three problems will surface: a server blocked from reaching a partner, something odd on the floor 2 LAN, and DNS failing for the whole office. For each, decide whether it is an attack, authorised activity, or a detection that got it wrong. The logs are firewall.log, dns.log and ids.log.',
    'Start by learning your own machine: ip addr, ip route, ss -tuln, then ping dc01 and traceroute web01. Type help for the commands and man tcpdump for reading captures.',
  ],
  sources: ['fw', 'dns', 'ids'],
  busy: 1,
  seed: 404,
  incidents(r: Rng): Ev[] {
    const out: Ev[] = [];
    // A: bk01 tests the new SFTP copy (CHG-433). HTTPS to the partner is allowed; SFTP on 22 is not, yet.
    out.push(fw(at('13:03:41'), 'allow', '10.0.6.40', 45990, '198.51.100.201', 443, 6210));
    out.push(dns(at('13:05:11'), '10.0.6.40', 'sftp.offsite-vault.example', 'A', '198.51.100.200'));
    let t = at('13:05:12');
    let port = 46000;
    while (t < at('13:45')) {
      out.push(fw(t, 'deny', '10.0.6.40', port, '198.51.100.200', 22, 0));
      port += int(r, 3, 11);
      t += int(r, 57, 63);
    }
    // B: a device on Gi1/0/37 (meeting room 2.14) poisons the ARP caches of gw-floor2 and LT-101.
    out.push(ids(at('13:44:12'), { sig: 'ARP: IP address claimed by a new MAC', severity: 'high', proto: 'arp', ip: '10.0.4.1', mac: ROGUE_MAC, old_mac: GW4.mac, vlan: '40' }));
    out.push(ids(at('13:44:12'), { sig: 'ARP: IP address claimed by a new MAC', severity: 'high', proto: 'arp', ip: ALEX.ip, mac: ROGUE_MAC, old_mac: ALEX.mac, vlan: '40' }));
    for (let m = at('13:45:12'); m < at('15:00'); m += 60) {
      out.push(ids(m, { sig: 'ARP: repeated unsolicited replies', severity: 'medium', proto: 'arp', ip: '10.0.4.1', mac: ROGUE_MAC, count: String(30 + int(r, -1, 1)), vlan: '40' }));
    }
    out.push(ids(at('13:44:31'), { sig: 'Policy: password sent over cleartext HTTP', severity: 'low', proto: 'tcp', src: ALEX.ip, dst: '10.0.2.20', dpt: '80' }));
    // C: CHG-432 points dns01's forwarders at a mistyped address. Before it, the old forwarders answer.
    for (let f = at('13:00:06'); f < FAULT; f += int(r, 10, 20)) {
      out.push(fw(f, 'allow', '10.0.1.53', int(r, 30000, 60000), pick(r, ['192.0.2.53', '192.0.2.54']), 53, int(r, 70, 300), 'udp'));
    }
    for (let f = FAULT + 1; f < at('15:00'); f += int(r, 6, 14)) {
      out.push(fw(f, 'deny', '10.0.1.53', int(r, 30000, 60000), TYPO, 53, 0, 'udp'));
    }
    // Laptops retry the lookups that fail, so failures pile up.
    for (let f = FAULT + 20; f < at('15:00'); f += int(r, 12, 28)) {
      out.push(dns(f, pick(r, PEOPLE).ip, pick(r, SITES)[0], 'A', '-', 'SERVFAIL'));
    }
    return out;
  },
  adjust: (e: Ev) => (e.source === 'dns' && e.t >= FAULT && isOutside(e.f['query']) && e.f['rcode'] !== 'SERVFAIL'
    ? dns(e.t, e.f['client'], e.f['query'], e.f['qtype'], '-', 'SERVFAIL') : e),
  net: {
    hosts: [{ name: 'unknown', ip: ROGUE_IP, mac: ROGUE_MAC, os: 'linux', ping: true, dns: false }],
    dnsFault: { server: '10.0.1.53', from: FAULT },
    captures: [
      { path: '/var/captures/bk01-1310.pcap', at: at('13:15'), build: backupCapture },
      { path: '/var/captures/floor2-1344.pcap', at: at('13:47'), build: floor2Capture },
      { path: '/var/captures/dns01-1405.pcap', at: at('14:06'), build: dnsCapture },
    ],
  },
  docs: { 'sw-floor2-mac-table.txt': MAC_TABLE, 'floor2-ports.csv': PORT_MAP },
  alerts: [
    {
      id: 'net-backup', t: at('13:20'), rule: 'Repeated denied outbound connections from a server (possible malware trying to call out)', severity: 'medium', host: 'bk01',
      summary: 'The edge firewall has blocked bk01 from connecting to the same internet address about once a minute since 13:05.',
      entities: [['src', 'bk01 (10.0.6.40)'], ['dest', '198.51.100.200'], ['action', 'deny']],
      query: 'source=fw src=10.0.6.40',
      verdict: 'benign', need: ['close'], fine: [],
      questions: [
        { id: 'port', ask: 'Which destination port is being blocked?', answers: ['22', 'tcp 22', '22/tcp'], hint: 'source=fw src=10.0.6.40 action=deny | stats count by dpt, or tcpdump -nr /var/captures/bk01-1310.pcap' },
        { id: 'proto', ask: 'Which protocol is bk01 trying to use on that port?', answers: ['sftp', 'ssh'], contains: true, hint: 'Port 22 is SSH. Which file transfer runs over SSH? The change calendar names it.' },
        { id: 'chg', ask: 'Which change explains it?', answers: ['CHG-433', 'chg433', 'chg 433'], hint: 'grep bk01 ~/docs/change-calendar.txt' },
      ],
      why: 'bk01 is testing the new offsite copy over SFTP under CHG-433. SFTP runs inside SSH, on TCP port 22. The firewall rule for it (FW-219) is still waiting for approval, so the edge firewall drops each attempt silently: the capture shows SYNs resent after 1, 2 and 4 seconds with no SYN-ACK and no reset. The same partner on 443 (the old HTTPS upload) is allowed. The traffic is real and authorised: a benign true positive. Close it and point k.mensah at the pending FW-219. The detection was right to look: malware calling out to a blocked address looks exactly like this until you check the context.',
      actionWhy: {
        block: 'The firewall already blocks it, and the address is Fernco\'s own backup provider (whois 198.51.100.200). A permanent block would break the approved change.',
        isolate: 'bk01 is not compromised: it is doing what CHG-433 asked, before its firewall rule was approved.',
        disable: 'No account is involved.',
        reset: 'No account is involved.',
        escalate: 'Nothing malicious happened. The fix is the pending firewall request, which belongs to the network team.',
        tune: 'A server repeatedly calling out against the firewall is exactly what malware looks like. Tuning that away would hide the next real one.',
      },
    },
    {
      id: 'net-arp', t: at('13:47'), rule: 'ARP spoofing: a new MAC address claims the gateway 10.0.4.1', severity: 'high', host: 'sw-floor2',
      summary: 'sensor01 saw ARP replies on floor 2 saying the gateway 10.0.4.1 is at a MAC address it has never had.',
      entities: [['ip', '10.0.4.1 (gw-floor2)'], ['mac', ROGUE_MAC], ['vlan', '40 (floor 2)']],
      query: 'source=ids proto=arp',
      verdict: 'tp', need: ['isolate', 'reset', 'escalate'], fine: ['disable'],
      questions: [
        { id: 'mac', ask: 'Which MAC address is falsely claiming the gateway\'s IP?', answers: [ROGUE_MAC], hint: 'It is in the alert. Confirm it in the capture: tcpdump -enr /var/captures/floor2-1344.pcap arp' },
        { id: 'port', ask: 'Which switch port is that device plugged into?', answers: [ROGUE_PORT, 'gi1/0/37', '1/0/37'], hint: 'grep the MAC in ~/docs/sw-floor2-mac-table.txt' },
        { id: 'where', ask: 'Where is that wall socket?', answers: ['2.14'], contains: true, hint: 'Look the port up in ~/docs/floor2-ports.csv' },
        { id: 'who', ask: 'Whose password crossed the network in cleartext through the device? (username)', answers: ['a.ng', 'alex'], contains: true, hint: 'tcpdump -nAr /var/captures/floor2-1344.pcap tcp port 80' },
      ],
      why: 'A device nobody registered (it has no DNS name and is not in staff.csv) was plugged into the live socket in meeting room 2.14 before 12:30. At 13:44 it began sending ARP replies nobody asked for, every two seconds: to LT-101 it said "10.0.4.1 is at b4:2e:99:5c:1e:42", and to the gateway it said the same about 10.0.4.101. Both believed it, so all of Alex Ng\'s traffic went through the device, which passed it on (each packet appears twice in the capture, the copy with TTL one lower). That is an on-path (man-in-the-middle) attack. Alex then signed in to the old intranet over plain HTTP, so the device has their password. HTTPS traffic stayed encrypted; only the site name was visible. Shut the switch port (isolate), reset Alex\'s password, and escalate: someone got physical access to the office. Longer term: switch protections such as dynamic ARP inspection and port security, disabling unused wall sockets, and moving the intranet to HTTPS.',
      actionWhy: {
        block: 'The edge firewall never sees traffic between two devices on the same LAN, and the device can change its IP address in a second. Shut its switch port instead.',
        tune: 'The detection was right: a second MAC address claiming the gateway is the signature of ARP spoofing.',
        close: 'Someone is reading floor 2\'s traffic and already has a password. This is the most serious alert of the shift.',
      },
    },
    {
      id: 'net-dns', t: at('14:10'), rule: 'Possible DGA malware: spike in failed DNS lookups', severity: 'medium', host: 'dns01',
      summary: 'Failed DNS lookups jumped from almost none to more than a hundred in a few minutes, from laptops all over the office.',
      entities: [['server', 'dns01 (10.0.1.53)'], ['rcode', 'SERVFAIL'], ['clients', 'many']],
      query: 'source=dns rcode=SERVFAIL',
      verdict: 'fp', need: ['close'], fine: ['tune'],
      questions: [
        { id: 'rcode', ask: 'What response code do the failed lookups get?', answers: ['SERVFAIL'], hint: 'source=dns | stats count by rcode' },
        { id: 'names', ask: 'Are the names random-looking, or everyday sites? (random or everyday)', answers: ['everyday', 'normal', 'real', 'ordinary'], contains: true, hint: 'source=dns rcode=SERVFAIL | top query' },
        { id: 'fwd', ask: 'Which address is dns01 now trying to forward queries to?', answers: [TYPO], hint: 'source=fw src=10.0.1.53 | stats count by dst action, or the capture: tcpdump -nr /var/captures/dns01-1405.pcap' },
        { id: 'chg', ask: 'Which change caused it?', answers: ['CHG-432', 'chg432', 'chg 432'], hint: 'grep dns01 ~/docs/change-calendar.txt' },
      ],
      why: 'Malware using a domain generation algorithm (DGA) looks up random-looking names that mostly do not exist, so it gets NXDOMAIN, "no such name". These failures are SERVFAIL, "server failure", for everyday sites, from everyone, and only for names outside fernco.example: the DNS server itself is failing. At 13:52 CHG-432 pointed dns01\'s forwarders at the new ISP resolvers, but the address entered was 203.0.113.35 instead of .53. The firewall (FW-218 allows .53 and .54) denies every query to it, so dns01 never gets an answer and tells clients SERVFAIL after about three seconds. dns02, with the right forwarders, still answers: dig @10.0.1.54 works. There is no malware, so the detection is wrong: a false positive. Close it, ask for the rule to tell SERVFAIL from NXDOMAIN, and tell s.ito, the change owner, to fix the typo.',
      actionWhy: {
        block: 'The firewall is already denying the mistyped address, and blocking dns01 would make the outage worse.',
        isolate: 'dns01 is misconfigured, not compromised. Isolating the company\'s DNS server would cut everyone off.',
        escalate: 'This is an IT outage with a known cause, not a security incident. The change owner fixes it.',
        disable: 'No account is involved.',
        reset: 'No account is involved.',
      },
    },
  ],
  tasks: [
    { id: 's4-ip', after: at('13:00'), where: 'terminal', ask: 'Show this workstation\'s IP addresses with the ip command.', hint: 'ip addr, or the short form ip a.', ref: 'ip addr', compare: 'contains', needle: '10.0.8.15/24',
      learn: 'ip addr. eth0 has inet 10.0.8.15/24: the address, and /24 means the first 24 bits (10.0.8) name the network, so 10.0.8.0 to 10.0.8.255 is this LAN. link/ether is the MAC address. lo (127.0.0.1) is the machine talking to itself.' },
    { id: 's4-gw', after: at('13:00'), where: 'terminal', ask: 'Show this workstation\'s routing table with the ip command.', hint: 'ip route (or ip r).', ref: 'ip route', compare: 'contains', needle: 'default via 10.0.8.1',
      learn: 'ip route. "default via 10.0.8.1" is the default gateway: anything not on 10.0.8.0/24 goes to that router. route -n and netstat -rn show the same table in the older format.' },
    { id: 's4-ping', after: at('13:00'), where: 'terminal', ask: 'Ping dc01 three times.', hint: 'ping -c sets the count.', ref: 'ping -c 3 dc01', compare: 'contains', needle: '3 received',
      learn: 'ping -c 3 dc01. ttl=127 is a clue: Windows starts at 128, and one router on the way took one off. Linux starts at 64, network devices at 255. Try a laptop: no replies, because Windows firewalls drop ping. No reply does not mean down.' },
    { id: 's4-listen', after: at('13:00'), where: 'terminal', ask: 'List the TCP and UDP ports this workstation is listening on, as numbers rather than service names.', hint: 'ss: -t TCP, -u UDP, -l listening, -n numbers.', ref: 'ss -tuln', compare: 'exact',
      learn: 'ss -tuln. 0.0.0.0:22 means SSH listens on every address; 127.0.0.1:323 only on the machine itself, so nothing else can reach it. Without -n you would see ssh instead of 22. On a server you are investigating, an unexpected LISTEN line is a backdoor until proven otherwise.' },
    { id: 's4-denied', after: at('13:20'), where: 'terminal', ask: 'Count the connections from bk01 (10.0.6.40) that the firewall denied.', hint: 'Two greps: one for action=deny, one with -c for "src=10.0.6.40 " (the space stops partial matches).',
      ref: 'grep "action=deny" /var/log/firewall.log | grep -c "src=10.0.6.40 "', compare: 'exact',
      learn: 'grep "action=deny" /var/log/firewall.log | grep -c "src=10.0.6.40 ". About one a minute, all to 198.51.100.200 port 22: a schedule, not a person.' },
    { id: 's4-syn', after: at('13:20'), where: 'terminal', ask: 'Read /var/captures/bk01-1310.pcap without name lookups, showing only packets going to port 22.', hint: 'tcpdump -n -r FILE, then a filter: dst port 22.',
      ref: 'tcpdump -nr /var/captures/bk01-1310.pcap dst port 22', compare: 'exact',
      learn: 'tcpdump -nr FILE dst port 22. Every packet is a SYN (Flags [S]) and nothing comes back: no SYN-ACK, no RST. A firewall that drops silently looks like this; a closed port would answer with a reset. The resends come after 1, 2 and 4 seconds, which is TCP backing off.' },
    { id: 's4-arp', after: at('13:47'), where: 'terminal', ask: 'Show the ARP packets in /var/captures/floor2-1344.pcap with their MAC addresses, numbers only.', hint: '-e prints the Ethernet header (MACs); the filter is just: arp',
      ref: 'tcpdump -enr /var/captures/floor2-1344.pcap arp', compare: 'exact',
      learn: 'tcpdump -enr FILE arp. Two different MACs claim 10.0.4.1: the gateway\'s real 00:1a:2b:00:04:01, which answered a question, and b4:2e:99:5c:1e:42, which sends "Reply 10.0.4.1 is-at" every two seconds without being asked. Gratuitous replies like that are how ARP poisoning works.' },
    { id: 's4-payload', after: at('13:47'), where: 'terminal', ask: 'Print the readable payload of the web traffic on port 80 in floor2-1344.pcap.', hint: '-A prints payload as text. Filter: tcp port 80',
      ref: 'tcpdump -nAr /var/captures/floor2-1344.pcap tcp port 80', compare: 'exact',
      learn: 'tcpdump -nAr FILE tcp port 80. Each packet appears twice: once from LT-101 to the device\'s MAC, then again from the device to the gateway with a TTL one lower. The POST carries user=a.ng and the password in plain text.' },
    { id: 's4-ids', after: at('13:47'), where: 'siem', ask: 'In the SIEM, show the ARP detections as a table of time, signature, IP and MAC.', hint: 'source=ids proto=arp | table _time sig ip mac',
      ref: 'source=ids proto=arp | table _time sig ip mac', compare: 'set',
      learn: 'source=ids proto=arp | table _time sig ip mac. The first two lines say it all: one MAC claimed both the gateway and LT-101 at the same second. Then it keeps repeating, about 30 replies a minute, to keep the lie fresh in their ARP caches.' },
    { id: 's4-script', after: at('13:47'), where: 'terminal', ask: 'Write ~/bin/pingall.sh: for each address given as an argument, ping it once and print "ADDRESS up" or "ADDRESS down".',
      hint: 'for ip in "$@"; do if ping -c 1 "$ip" > /dev/null; then echo "$ip up"; else echo "$ip down"; fi; done',
      ref: 'for ip in "$@"; do\n  if ping -c 1 "$ip" > /dev/null; then echo "$ip up"; else echo "$ip down"; fi\ndone', compare: 'exact',
      script: { path: '/home/analyst/bin/pingall.sh', tests: [['10.0.1.5', '10.0.4.101', '10.0.2.10'], [ROGUE_IP, '10.0.8.20', '10.0.8.99']] },
      learn: 'if uses the exit status of ping: 0 when a reply came back. "$@" is every argument. Note that LT-101 shows as down while it is clearly working: its firewall drops ping. And the unknown device at 10.0.4.177 answers, with ttl=63: Linux, one router away.' },
    { id: 's4-dig', after: at('14:10'), where: 'terminal', ask: 'Ask dns02 (10.0.1.54) directly for crm.saas-vendor.example, showing only the answer.', hint: 'dig @SERVER NAME +short',
      ref: 'dig @10.0.1.54 crm.saas-vendor.example +short', compare: 'exact',
      learn: 'dig @10.0.1.54 crm.saas-vendor.example +short gives 192.0.2.21, while plain dig (which asks dns01, from /etc/resolv.conf) gets status: SERVFAIL after about 3000 msec. Same question, different server, different result: the problem is dns01, not the site or your machine.' },
    { id: 's4-rcode', after: at('14:10'), where: 'siem', ask: 'In the SIEM, count DNS answers by response code.', hint: 'source=dns | stats count by rcode',
      ref: 'source=dns | stats count by rcode', compare: 'set',
      learn: 'NOERROR: answered. NXDOMAIN: the name does not exist (typos, and malware guessing names). SERVFAIL: the server could not get an answer at all, which points at the DNS server, not the name.' },
    { id: 's4-fwd', after: at('14:10'), where: 'terminal', ask: 'From the firewall log, list each address dns01 (10.0.1.53) sent DNS queries to, with how many each, most first.', hint: 'grep for "src=10.0.1.53 ", then the destination is field 7: awk \'{print $7}\'. Then sort | uniq -c | sort -rn.',
      ref: 'grep "src=10.0.1.53 " /var/log/firewall.log | awk \'{print $7}\' | sort | uniq -c | sort -rn', compare: 'ranked', kv: true,
      learn: 'Until 13:52 dns01 used the old forwarders 192.0.2.53 and .54 (allowed). Since then it sends everything to 203.0.113.35, which the firewall denies. The change said .53: two digits swapped.' },
  ],
  intel: {
    '198.51.100.200': '198.51.100.200\n  Reputation: no records\n  Known business partner on the SOC allow list: Offsite Vault Backup Services.',
    [TYPO]: `${TYPO}\n  Reputation: no records`,
    [ROGUE_IP]: `${ROGUE_IP}\n  Private address: threat intel does not cover internal addresses. See ~/docs/assets.csv and ~/docs/staff.csv.`,
  },
  whois: {
    '198.51.100.200': '198.51.100.200\n  Organisation: Offsite Vault Backup Services S.A.\n  Country: PT\n  Customer note: Fernco Ltd, nightly encrypted backups (contract OV-2291)',
    [TYPO]: `${TYPO}\n  NetName: EXFIBRE-INFRA\n  Organisation: Example Fibre Networks (Fernco's new ISP)\n  Note: 203.0.113.53 and 203.0.113.54 are this network's public DNS resolvers. ${TYPO} is a router interface, not a DNS server.`,
    '203.0.113.53': '203.0.113.53\n  NetName: EXFIBRE-DNS\n  Organisation: Example Fibre Networks (Fernco\'s new ISP)\n  Note: public DNS resolver',
  },
};
