import { Component, Input, OnInit, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { LessonWork } from '../lesson-work.service';

export const PILLARS = ['C', 'I', 'A'] as const;
export type Pillar = typeof PILLARS[number];
export const PILLAR_NAME: Record<Pillar, string> = { C: 'Confidentiality', I: 'Integrity', A: 'Availability' };

export interface CiaItem {
  text: string;
  /** The goals it breaks (attacks) or protects (controls): all of these must be picked. */
  hits: Pillar[];
  /** Goals that are a fair extra pick, without being needed. */
  also?: Pillar[];
  why: string;
}

/** What does each attack break? */
export const CIA_ATTACKS: CiaItem[] = [
  { text: 'Someone reads a manager\'s password over their shoulder in a coffee shop', hits: ['C'],
    why: 'The password is disclosed to someone who should not see it, and nothing is changed or taken offline. Disclosure breaks confidentiality.' },
  { text: 'A botnet floods the online store with traffic until real customers cannot load it', hits: ['A'],
    why: 'Nothing is read or changed; the store is simply unusable. A denial of service attacks availability.' },
  { text: 'An insider quietly edits salary figures in the payroll database', hits: ['I'],
    why: 'Data is changed by someone not authorized to change it. Unauthorized alteration breaks integrity, even if nobody else ever sees the figures.' },
  { text: 'Ransomware encrypts the file shares, and the gang also copies the files out and threatens to publish them', hits: ['A', 'C'],
    why: 'Encryption makes the files unusable (availability), and the stolen copy is disclosure (confidentiality). Double extortion hits both, which is why backups alone do not answer it.' },
  { text: 'The company\'s home page is replaced with an attacker\'s message', hits: ['I'], also: ['A'],
    why: 'Defacement is unauthorized change to the site\'s content, so integrity. The site is still up; availability is a fair extra only because the real page is gone.' },
  { text: 'A backup tape of unencrypted customer records goes missing in the post', hits: ['C'],
    why: 'The originals are still on the servers, so nothing is lost or changed; the risk is that whoever finds the tape reads it. Encrypting backups is the fix.' },
  { text: 'A construction crew cuts the fiber line to the only data center', hits: ['A'],
    why: 'No attacker at all, but systems are unreachable. Availability covers accidents, outages and disasters as well as attacks.' },
  { text: 'SQL injection on a search box returns every row of the customer table', hits: ['C'],
    why: 'The attacker reads data they should never see. The table is unchanged and still online, so this is a confidentiality breach.' },
  { text: 'An intruder edits the server logs to delete the lines showing their sign-ins', hits: ['I'],
    why: 'The logs no longer match what really happened. Tampering with records, including audit logs, is an integrity attack, and it also hides the intrusion.' },
  { text: 'A packet capture on the guest Wi-Fi shows Telnet passwords in clear text', hits: ['C'],
    why: 'Telnet sends everything unencrypted, so anyone listening can read the passwords. Eavesdropping is disclosure: confidentiality.' },
  { text: 'Malware overwrites the boot sector of every server so none of them will start', hits: ['A'], also: ['I'],
    why: 'The goal and the effect is that nothing runs: destruction of service, which is availability. The boot sector was changed too, so integrity is a fair extra.' },
  { text: 'Poisoned DNS records send staff to a fake sign-in page that collects their passwords', hits: ['I', 'C'],
    why: 'The DNS answers were altered (integrity), and the fake page then steals passwords (confidentiality). Many real attacks break one goal to get at another.' },
];

/** What does each control protect? */
export const CIA_CONTROLS: CiaItem[] = [
  { text: 'Full-disk encryption on every laptop', hits: ['C'],
    why: 'A stolen laptop\'s disk cannot be read without the key. Encryption hides data; it does not stop anyone deleting or changing it.' },
  { text: 'Checking a download\'s SHA-256 hash against the one on the vendor\'s site', hits: ['I'],
    why: 'A matching hash proves the file was not changed. A hash hides nothing, so it gives no confidentiality.' },
  { text: 'A load balancer spreading the site across three web servers', hits: ['A'],
    why: 'If one server fails or is overloaded, the other two keep answering. Redundancy and load balancing are availability controls.' },
  { text: 'A digital signature on every software update', hits: ['I'],
    why: 'The signature proves the update was not changed and came from the vendor, which is integrity plus authenticity and non-repudiation. The update itself is not secret.' },
  { text: 'File permissions: everyone can read the price list, only the pricing team can edit it', hits: ['I'],
    why: 'Reading is open to all, so nothing is kept secret; the restriction is on who can change it. Limiting write access protects integrity.' },
  { text: 'Read access to HR files only for the HR team', hits: ['C'], also: ['I'],
    why: 'Limiting who can read is confidentiality. Fewer people with any access also means fewer who could change the files, so integrity is a fair extra.' },
  { text: 'Nightly backups kept offline and tested each month', hits: ['A'], also: ['I'],
    why: 'Backups bring data back after loss, failure or ransomware: availability. Restoring a known-good copy after tampering also helps integrity.' },
  { text: 'Showing only the last four digits of a card number on the support screen', hits: ['C'],
    why: 'Data masking keeps support staff from seeing the full number they do not need. It is purely about disclosure.' },
  { text: 'A UPS and a standby generator for the server room', hits: ['A'],
    why: 'Power cuts take systems offline; backup power keeps them running. A classic availability control.' },
  { text: 'HTTPS (TLS) on the customer portal', hits: ['C', 'I'],
    why: 'TLS encrypts the traffic (confidentiality) and checks every record with a message authentication code, so tampering in transit is detected (integrity).' },
  { text: 'A change approval process before anyone edits the firewall rules', hits: ['I'], also: ['A'],
    why: 'Only reviewed, authorized changes are made, which keeps the configuration correct: integrity. Fewer botched changes also means fewer outages.' },
  { text: 'A privacy filter on the screens at the reception desk', hits: ['C'],
    why: 'It stops visitors reading the screen from an angle, a physical control against shoulder surfing. Confidentiality only.' },
];

type Saved = { active: number; picks: Pillar[][]; checked: boolean[] };

/**
 * Pick which of confidentiality, integrity and availability each attack breaks (`attacks`) or each control protects
 * (`controls`). Some items need two; a fair extra pick is allowed but not needed.
 */
@Component({
  selector: 'app-cia-sorter',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <section class="w" [attr.aria-label]="show === 'attacks' ? 'What does each attack break?' : 'What does each control protect?'">
      <header class="head">
        <div class="title"><mat-icon aria-hidden="true">{{ show === 'attacks' ? 'heart_broken' : 'shield' }}</mat-icon>
          {{ show === 'attacks' ? 'What does each attack break?' : 'What does each control protect?' }}</div>
        <div class="count" aria-live="polite">{{ rightCount }} of {{ items.length }} right</div>
      </header>
      <p class="intro">
        @if (show === 'attacks') { Pick every goal the attack <strong>breaks</strong>: is something disclosed, changed or made unusable? Some break two. }
        @else { Pick every goal the control <strong>protects</strong>: does it hide data, stop or detect changes, or keep things running? Some protect two. }
        Then press Check.
      </p>

      <ol class="list" [attr.aria-label]="show === 'attacks' ? 'Attacks' : 'Controls'">
        @for (c of items; track $index) {
          <li><button type="button" [class.on]="active === $index" [class.ok]="state($index) === 'ok'" [class.bad]="state($index) === 'bad'"
            [attr.aria-current]="active === $index" [attr.aria-label]="'Item ' + ($index + 1) + stateLabel($index)" (click)="go($index)">{{ $index + 1 }}</button></li>
        }
      </ol>

      <div class="card">
        <div class="item"><span class="cn">{{ active + 1 }}</span> {{ item.text }}</div>

        <div class="pillars" role="group" [attr.aria-label]="show === 'attacks' ? 'Goals it breaks' : 'Goals it protects'">
          @for (g of pillars; track g) {
            <button type="button" class="pl" [class.on]="has(g)" [attr.aria-pressed]="has(g)"
              [class.right]="checked && item.hits.includes(g)" [class.extra]="checked && has(g) && !!item.also?.includes(g)"
              [class.wrong]="checked && has(g) && !item.hits.includes(g) && !item.also?.includes(g)"
              [class.missed]="checked && !has(g) && item.hits.includes(g)" (click)="toggle(g)">
              <span class="letter" aria-hidden="true">{{ g }}</span>
              <span class="pn">{{ names[g] }}</span>
              @if (checked && !has(g) && item.hits.includes(g)) { <span class="tag">missed</span> }
              @else if (checked && has(g) && !!item.also?.includes(g)) { <span class="tag">fair extra</span> }
            </button>
          }
        </div>

        @if (checked) {
          <div class="why" [class.good]="state(active) === 'ok'" [class.bad]="state(active) === 'bad'" role="status">
            <strong>{{ answer(item) }}.</strong> {{ item.why }}
          </div>
        }
        <div class="controls">
          <button type="button" class="btn" [attr.aria-disabled]="active === 0" (click)="go(active - 1)"><mat-icon aria-hidden="true">chevron_left</mat-icon> Back</button>
          @if (checked) {
            <button type="button" class="btn primary" [attr.aria-disabled]="active === items.length - 1" (click)="go(active + 1)">Next <mat-icon aria-hidden="true">chevron_right</mat-icon></button>
          } @else {
            <button type="button" class="btn primary" [attr.aria-disabled]="!pick.length" (click)="check()"><mat-icon aria-hidden="true">check</mat-icon> Check</button>
          }
          <span class="spacer"></span>
          <button type="button" class="btn ghost" (click)="reset()">Start over</button>
        </div>
      </div>

      @if (rightCount === items.length) {
        <div class="result" role="status"><mat-icon aria-hidden="true">emoji_events</mat-icon>
          @if (show === 'attacks') {
            <span><strong>All right.</strong> Read it, change it or stop it: disclosure breaks confidentiality, alteration breaks integrity, and destruction or denial breaks availability.</span>
          } @else {
            <span><strong>All right.</strong> Encryption, masking and read access protect confidentiality; hashes, signatures and write access protect integrity; redundancy, backups and power protect availability.</span>
          }
        </div>
      }
    </section>
  `,
  styleUrl: './cia-sorter.component.scss',
})
export class CiaSorterComponent implements OnInit {
  @Input({ required: true }) show!: 'attacks' | 'controls';
  private work = inject(LessonWork, { optional: true });
  readonly pillars = PILLARS;
  readonly names = PILLAR_NAME;

  items: CiaItem[] = [];
  active = 0;
  picks: Pillar[][] = [];
  checks: boolean[] = [];

  private get key() { return `cia-${this.show}`; }

  ngOnInit() {
    this.items = this.show === 'attacks' ? CIA_ATTACKS : CIA_CONTROLS;
    this.picks = this.items.map(() => []);
    this.checks = this.items.map(() => false);
    const saved = this.work?.get<Saved>(this.key);
    if (!saved) return;
    if (saved.active >= 0 && saved.active < this.items.length) this.active = saved.active;
    this.picks = this.items.map((_, i) => (saved.picks?.[i] ?? []).filter(g => PILLARS.includes(g)));
    this.checks = this.items.map((_, i) => !!saved.checked?.[i] && this.picks[i].length > 0);
  }

  get item() { return this.items[this.active]; }
  get pick() { return this.picks[this.active]; }
  get checked() { return this.checks[this.active]; }
  has(g: Pillar) { return this.pick.includes(g); }
  answer(c: CiaItem) { return c.hits.map(g => PILLAR_NAME[g]).join(' and '); }

  state(i: number): 'ok' | 'bad' | null {
    if (!this.checks[i]) return null;
    return isRight(this.items[i], this.picks[i]) ? 'ok' : 'bad';
  }
  stateLabel(i: number): string {
    const s = this.state(i);
    return s === 'ok' ? ', right' : s === 'bad' ? ', not right yet' : '';
  }
  get rightCount(): number { return this.items.filter((_, i) => this.state(i) === 'ok').length; }

  go(i: number) {
    if (i < 0 || i >= this.items.length) return;
    this.active = i;
    this.save();
  }
  /** Changing a pick after checking takes the answer away again, so the next check is a real one. */
  toggle(g: Pillar) {
    const now = this.has(g) ? this.pick.filter(x => x !== g) : PILLARS.filter(x => x === g || this.pick.includes(x));
    this.picks = this.picks.map((p, i) => i === this.active ? now : p);
    this.checks = this.checks.map((c, i) => i === this.active ? false : c);
    this.save();
  }
  check() {
    if (!this.pick.length) return;
    this.checks = this.checks.map((c, i) => i === this.active ? true : c);
    this.save();
  }
  reset() {
    this.picks = this.items.map(() => []);
    this.checks = this.items.map(() => false);
    this.active = 0;
    this.work?.clear(this.key);
  }
  private save() { this.work?.set(this.key, { active: this.active, picks: this.picks, checked: this.checks }); }
}

/** Right when every needed goal is picked and nothing beyond the fair extras. */
export function isRight(c: CiaItem, pick: Pillar[]): boolean {
  return c.hits.every(g => pick.includes(g)) && pick.every(g => c.hits.includes(g) || !!c.also?.includes(g));
}
