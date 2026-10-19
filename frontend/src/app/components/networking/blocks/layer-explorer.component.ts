import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

interface Layer {
  n: number;
  name: string;
  role: string;
  pdu: string;
  protocols: string;
  devices: string;
  attacks: string;
  defenses: string;
}

/** Tap-to-open stack of the seven OSI layers: what each does, what lives there, how it is attacked and defended. */
@Component({
  selector: 'app-layer-explorer',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <section class="layers" aria-label="The seven OSI layers">
      <p class="hint"><mat-icon aria-hidden="true">touch_app</mat-icon> Tap a layer to open it. Layer 7 is at the top, Layer 1 at the bottom.</p>
      <ul class="stack">
        @for (l of layers; track l.n) {
          <li>
            <button type="button" class="bar" [class.open]="open === l.n"
              [attr.aria-expanded]="open === l.n" [attr.aria-controls]="'layer-' + l.n" (click)="toggle(l.n)">
              <span class="n">{{ l.n }}</span>
              <span class="text">
                <span class="name">{{ l.name }}</span>
                <span class="role">{{ l.role }}</span>
              </span>
              <span class="pdu">{{ l.pdu }}</span>
              <mat-icon aria-hidden="true">{{ open === l.n ? 'expand_less' : 'expand_more' }}</mat-icon>
            </button>
            @if (open === l.n) {
              <dl class="detail" [id]="'layer-' + l.n">
                <div><dt>Protocols and examples</dt><dd>{{ l.protocols }}</dd></div>
                <div><dt>Devices and controls</dt><dd>{{ l.devices }}</dd></div>
                <div class="bad"><dt>Typical attacks</dt><dd>{{ l.attacks }}</dd></div>
                <div class="good"><dt>Typical defenses</dt><dd>{{ l.defenses }}</dd></div>
              </dl>
            }
          </li>
        }
      </ul>
      <div class="mnemonics">
        <div><strong>Top to bottom (7 to 1):</strong>&ngsp;<em>All People Seem To Need Data Processing</em></div>
        <div><strong>Bottom to top (1 to 7):</strong>&ngsp;<em>Please Do Not Throw Sausage Pizza Away</em></div>
      </div>
    </section>
  `,
  styles: [`
    :host { display: block; margin: 18px 0; }
    .layers { border: 1px solid var(--c-border); border-radius: var(--r-lg); background: var(--c-surface); padding: 14px 16px; }
    .hint { display: flex; align-items: center; gap: 6px; margin: 0 0 10px; font-size: 13px; color: var(--c-text-2); }
    .hint mat-icon { font-size: 18px; width: 18px; height: 18px; color: var(--c-accent); }
    .stack { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
    .bar {
      width: 100%; display: flex; align-items: center; gap: 12px; text-align: left; cursor: pointer; font: inherit;
      padding: 10px 12px; border-radius: var(--r-md); border: 2px solid var(--c-border);
      background: var(--c-surface-2); color: var(--c-text); transition: border-color .15s, background .15s;
    }
    .bar:hover { border-color: var(--c-accent); background: var(--c-accent-light); }
    .bar.open { border-color: var(--c-accent); background: var(--c-accent-light); }
    .n {
      flex: none; width: 30px; height: 30px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center;
      background: var(--c-accent-solid); color: var(--c-on-accent); font-weight: 800; font-size: 15px;
    }
    .text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .name { font-weight: 700; font-size: 15px; }
    .role { font-size: 12.5px; color: var(--c-text); line-height: 1.4; }
    .pdu {
      flex: none; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .4px;
      padding: 3px 9px; border-radius: 12px; background: var(--c-surface-3); color: var(--c-text-2); border: 1px solid var(--c-border);
    }
    .bar mat-icon { flex: none; color: var(--c-muted); }
    .detail { margin: 6px 0 4px 42px; display: grid; gap: 8px; }
    .detail > div { padding: 8px 12px; border-radius: 8px; background: var(--c-surface-2); border: 1px solid var(--c-border); }
    .detail .bad  { border-left: 4px solid var(--c-error); }
    .detail .good { border-left: 4px solid var(--c-success); }
    dt { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .4px; color: var(--c-text-2); }
    dd { margin: 3px 0 0; font-size: 13.5px; line-height: 1.55; color: var(--c-text); }
    .mnemonics { margin-top: 12px; display: grid; gap: 4px; font-size: 13px; color: var(--c-text-2); }
    .mnemonics strong { color: var(--c-text); }
    @media (max-width: 600px) {
      .layers { padding: 12px 10px; }
      .bar { gap: 8px; padding: 9px 9px; }
      .pdu { display: none; }
      .detail { margin-left: 0; }
    }
  `],
})
export class LayerExplorerComponent {
  open: number | null = 3;

  readonly layers: Layer[] = [
    {
      n: 7, name: 'Application', role: 'Where your programs meet the network: the web, email, file sharing, name lookups.', pdu: 'Data',
      protocols: 'HTTP and HTTPS (web pages), DNS (looking up names), SMTP, IMAP and POP3 (email), SSH (remote logins). Lesson 5 lists them all.',
      devices: 'Devices that understand what the traffic actually says: a web application firewall (WAF, which guards a website), a proxy (a go-between for web traffic) and a next-generation firewall (lesson 9).',
      attacks: 'Attacks on the program itself: SQL injection and cross-site scripting (tricking a website with malicious input), phishing emails, malware, and floods of web requests.',
      defenses: 'A WAF, checking all input, keeping software patched, and filtering email and web traffic.',
    },
    {
      n: 6, name: 'Presentation', role: 'Gets data into a form both ends understand: the file format, compression, and encryption.', pdu: 'Data',
      protocols: 'TLS (the encryption behind HTTPS), text encodings such as Unicode, image and video formats such as JPEG and MPEG.',
      devices: 'Mostly software inside the programs. A load balancer that handles encryption for a group of web servers works here.',
      attacks: 'Removing or weakening encryption: SSL stripping (quietly turning HTTPS into plain HTTP) and downgrade attacks (forcing an older, weaker version), plus booby-trapped files.',
      defenses: 'Modern encryption (TLS 1.2 or 1.3), HSTS (a website telling browsers "only ever use HTTPS with me"), and checking certificates (lesson 10).',
    },
    {
      n: 5, name: 'Session', role: 'Starts, keeps track of and ends conversations between two programs, such as staying logged in to a website.', pdu: 'Data',
      protocols: 'Session IDs and cookies (the tokens that remember you are logged in), and older protocols such as NetBIOS and RPC.',
      devices: 'Mostly software on the devices themselves.',
      attacks: 'Session hijacking (stealing someone\'s logged-in token to become them) and replay attacks (recording a valid message and sending it again).',
      defenses: 'Sessions that expire, long random session tokens, asking for the password again for sensitive actions, and encryption so tokens cannot be read.',
    },
    {
      n: 4, name: 'Transport', role: 'Gets data to the right program using port numbers, and (with TCP) makes sure it all arrives in order. Lesson 3.', pdu: 'Segment',
      protocols: 'TCP (careful delivery) and UDP (fast delivery).',
      devices: 'Firewalls that look at port numbers and connections (lesson 9), and load balancers that spread connections over several servers.',
      attacks: 'SYN floods (lesson 3), UDP floods, and port scans (knocking on every port to find open ones).',
      defenses: 'A stateful firewall (one that remembers connections, lesson 9), SYN cookies, rate limiting, and closing unused ports.',
    },
    {
      n: 3, name: 'Network', role: 'Puts IP addresses on packets and finds the path from network to network. Finding the path is called routing. Lesson 2.', pdu: 'Packet',
      protocols: 'IP (IPv4 and IPv6), ICMP (the "ping" and error messages, lesson 8), IPsec (encryption for whole packets, used in VPNs), and routing protocols that routers use to share directions.',
      devices: 'Routers, Layer 3 switches (switches that can also route, lesson 6), and simple firewalls that check addresses.',
      attacks: 'IP spoofing (faking the source address), floods of ping messages, and feeding routers false directions so traffic goes the wrong way.',
      defenses: 'Access control lists (ACLs: allow and block lists on routers), dropping packets with impossible source addresses, and requiring routers to prove who sent a routing update.',
    },
    {
      n: 2, name: 'Data Link', role: 'Moves data between devices on the same local network, using MAC addresses. Lesson 6.', pdu: 'Frame',
      protocols: 'Ethernet (wired networks), Wi-Fi, ARP (finding the MAC address for an IP address, lesson 8) and VLAN tags (lesson 7).',
      devices: 'Switches, wireless access points and network cards (NICs).',
      attacks: 'Tricks on the local network: ARP poisoning and MAC flooding (lessons 6 and 8), VLAN hopping (lesson 7), and fake Wi-Fi access points (lesson 9).',
      defenses: 'Switch protections such as port security and Dynamic ARP Inspection (lesson 6), 802.1X (devices must log in before they get network access), and WPA3 Wi-Fi security.',
    },
    {
      n: 1, name: 'Physical', role: 'The actual signals: electricity in copper cables, light in fiber, radio waves for Wi-Fi.', pdu: 'Bits',
      protocols: 'Cable types, radio frequencies, voltages and light pulses.',
      devices: 'Cables, hubs (obsolete boxes that repeat every signal everywhere), repeaters, modems, and the plug or radio part of a network card.',
      attacks: 'Physical tampering: tapping or cutting cables, jamming Wi-Fi radio, stealing equipment, or plugging a rogue device into a spare wall socket.',
      defenses: 'Locked wiring closets, switching off unused sockets, harder-to-tap cable such as fiber, and cameras.',
    },
  ];

  toggle(n: number) {
    this.open = this.open === n ? null : n;
  }
}
