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
      n: 7, name: 'Application', role: 'Where programs meet the network: web, email, file transfer, name lookups.', pdu: 'Data',
      protocols: 'HTTP and HTTPS, DNS, DHCP, SMTP, IMAP and POP3, FTP and SFTP, SSH, SNMP, LDAP.',
      devices: 'Web application firewall (WAF), proxy, next-generation firewall, Layer 7 load balancer, email gateway.',
      attacks: 'SQL injection, cross-site scripting, DNS poisoning, phishing, malware, HTTP floods.',
      defenses: 'WAF, input validation, patching, secure coding, email and web filtering.',
    },
    {
      n: 6, name: 'Presentation', role: 'Formats, encrypts and compresses data so both ends understand it.', pdu: 'Data',
      protocols: 'TLS/SSL (encryption), character encoding such as ASCII and Unicode, JPEG, MPEG, compression.',
      devices: 'Mostly software. A load balancer that offloads TLS works here.',
      attacks: 'SSL stripping, downgrade attacks, weak cipher suites, malformed files that exploit viewers.',
      defenses: 'TLS 1.2 or 1.3, HSTS, strong cipher suites, certificate validation.',
    },
    {
      n: 5, name: 'Session', role: 'Starts, keeps alive and ends conversations between two systems.', pdu: 'Data',
      protocols: 'NetBIOS, RPC, SQL sessions, PPTP, session IDs and cookies.',
      devices: 'Mostly software on the hosts themselves.',
      attacks: 'Session hijacking, replay attacks.',
      defenses: 'Session timeouts, random session tokens, re-authentication, TLS, nonces.',
    },
    {
      n: 4, name: 'Transport', role: 'Splits data into segments, adds port numbers, and (with TCP) checks it all arrives in order.', pdu: 'Segment',
      protocols: 'TCP and UDP.',
      devices: 'Layer 4 firewall (stateful), Layer 4 load balancer.',
      attacks: 'SYN flood, port scanning, UDP flood, connection-table exhaustion.',
      defenses: 'Stateful firewall, SYN cookies, rate limiting, closing unused ports.',
    },
    {
      n: 3, name: 'Network', role: 'Adds IP addresses and chooses the path across networks (routing).', pdu: 'Packet',
      protocols: 'IPv4, IPv6, ICMP, IPsec, routing protocols such as OSPF and BGP.',
      devices: 'Router, Layer 3 switch, packet-filtering firewall.',
      attacks: 'IP spoofing, ICMP floods and Smurf, route hijacking, fragmentation attacks.',
      defenses: 'ACLs, ingress and egress filtering, authenticated routing updates, rate limiting, IPsec.',
    },
    {
      n: 2, name: 'Data Link', role: 'Moves frames between devices on the same local network using MAC addresses.', pdu: 'Frame',
      protocols: 'Ethernet, Wi-Fi (802.11), ARP, VLAN tagging (802.1Q), spanning tree (STP), PPP.',
      devices: 'Switch, bridge, wireless access point, network card (NIC).',
      attacks: 'ARP poisoning, MAC flooding, VLAN hopping, rogue access points and evil twins, deauthentication.',
      defenses: 'Port security, Dynamic ARP Inspection, DHCP snooping, 802.1X, VLAN hygiene, WPA3.',
    },
    {
      n: 1, name: 'Physical', role: 'The real signals: electricity in copper, light in fiber, radio waves in Wi-Fi.', pdu: 'Bits',
      protocols: 'Cabling standards, radio frequencies, voltages, light pulses.',
      devices: 'Cables, hubs, repeaters, modems, the physical side of the NIC.',
      attacks: 'Wiretapping, cutting cables, jamming, theft, plugging a rogue device into a spare port.',
      defenses: 'Locked wiring closets, disabled or blocked unused ports, fiber or shielded cable, cameras.',
    },
  ];

  toggle(n: number) {
    this.open = this.open === n ? null : n;
  }
}
