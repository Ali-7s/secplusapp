import { LessonBody } from '../../networking.model';
import { h, lab, malwareLab, mcq, recap, words } from '../dsl';

export const ATTACKS: LessonBody = {
  goals: [
    'Take a shop down with a DDoS, then keep it up, and know which defence fits which flood',
    'Trace a wrong DNS answer to where the lie comes from: one PC, the resolver, the registrar, or a typo',
    'Put yourself on-path with ARP poisoning and see what HTTPS and HSTS still protect',
    'Replay a stolen hash, cookie and request, and find what really stops each one, MFA included',
  ],
  blocks: [
    recap('Topic 14 was malware on one machine. Here the attacks travel over the network. In each lab you play the attacker first, then switch on defences and find the ones that work. Your course covers the definitions; this is the practice.'),
    words(
      ['Botnet', 'Many infected devices that an attacker controls together, for example to flood a target'],
      ['Reflection', 'Sending requests with the victim\'s address forged as the sender, so servers send their replies to the victim'],
      ['Amplification', 'Choosing requests whose replies are much bigger than the request, so each bot delivers far more traffic'],
      ['Resolver', 'The DNS server that looks names up for a whole network and remembers (caches) the answers'],
      ['ARP', 'How a device on a LAN finds the hardware (MAC) address that belongs to an IP address. It has no authentication'],
      ['HSTS', 'A rule a website sends: "only ever contact me over HTTPS". The browser then refuses plain HTTP to that site'],
      ['NTLM', 'An older Windows sign-in method in which the password hash itself proves who you are'],
    ),

    h('DDoS: take it down, then keep it up', { objective: '2.4', keep: 'Volumetric floods (amplified, reflected) fill your link, so only upstream scrubbing helps. A SYN flood fills the connection table: SYN cookies. An HTTP flood looks like visitors: rate limiting. Amplification needs spoofed sources and open servers.' }),
    lab('ddos'),

    h('DNS attacks: find where the lie comes from', { objective: '2.4', keep: 'One PC wrong: its hosts file. Everyone on one network wrong: the resolver cache. Everyone everywhere wrong: the domain itself was hijacked at the registrar. A slightly different name: typosquatting. Nothing resolving at all: an outage, not an attack.' }),
    malwareLab('dns'),

    h('On-path: ARP poisoning on the office LAN', { objective: '2.4', keep: 'Forged ARP replies put you between victim and gateway; forward traffic or they notice. Plain HTTP shows passwords. SSL stripping downgrades HTTPS unless the site uses HSTS. Dynamic ARP Inspection stops the poisoning itself.' }),
    lab('onpath'),

    h('Credential replay: reuse what you captured', { objective: '2.4', keep: 'Replay reuses a captured credential without cracking it: a hash (pass-the-hash), a session cookie, a whole request. MFA does not help after sign-in. Stop the theft, or make the captured thing useless: no NTLM, bound sessions, nonces.' }),
    lab('replay'),
  ],
  check: [
    mcq('A web shop is hit by 40 Gbps of DNS responses to queries it never sent, from thousands of resolvers. Its own firewall is overwhelmed. What BEST restores service?',
      'An upstream DDoS scrubbing service', ['Rate limiting on the web server', 'SYN cookies on the web server', 'Blocking port 53 on the shop\'s own firewall'],
      'A reflected, amplified flood fills the internet link before anything in the building sees it. Only a provider upstream, with more capacity than the attacker, can filter it out.'),
    mcq('Only one employee\'s laptop sends payroll.fernco.example to the wrong address. Colleagues on the same network reach the real site. Where should you look first?',
      'The laptop\'s hosts file', ['The office DNS resolver\'s cache', 'The domain\'s registrar account', 'The public DNS records'],
      'If the resolver or the domain were poisoned, everyone using them would be affected. A problem on one machine points to something on that machine, such as the hosts file.'),
    mcq('An attacker on the same switch as a victim sends forged ARP replies. Which control stops the poisoning itself?',
      'Dynamic ARP Inspection on the switch', ['HSTS on the company website', 'TLS 1.3 on the web server', 'MFA on every sign-in'],
      'DAI checks ARP replies against the DHCP snooping table and drops forged ones. HSTS and TLS protect what crosses the attacker, but do not stop them being on-path.'),
    mcq('An attacker dumps an NTLM hash from a PC\'s memory and signs in to a file server with it. MFA is required for every web sign-in. What BEST prevents this?',
      'Credential Guard and disabling NTLM', ['A longer password policy', 'MFA on the file server\'s web portal', 'Encrypting the file server\'s disks'],
      'Pass-the-hash needs no password, so password rules do not matter, and SMB network sign-ins never ask for MFA. Protect the hash in memory and stop accepting NTLM.'),
  ],
};
