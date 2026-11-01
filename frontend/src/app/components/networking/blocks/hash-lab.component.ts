import { Component, Input, OnInit, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { LessonWork } from '../lesson-work.service';

type Algo = 'SHA-1' | 'SHA-256' | 'SHA-512';

interface HashLabState { a: string; b: string; algo: Algo; pw: string; salted: boolean }

const DEFAULTS: HashLabState = { a: 'Pay Bob $100', b: 'Pay Bob $900', algo: 'SHA-256', pw: 'Summer2026!', salted: false };

const PARAGRAPH = 'The quick brown fox jumps over the lazy dog. A hash function takes input of any length, a word or a whole '
  + 'disk image, and always returns a digest of the same fixed length. Change a single character anywhere and about half '
  + 'of the bits in the digest flip, so the two digests look completely unrelated.';

/** Demo salts. Real ones are random bytes made when the password is set, stored next to the hash. */
const USERS = [{ name: 'alice', salt: 'q8Fz1Lw2' }, { name: 'bob', salt: 'M3vT9aXe' }];

const ALGOS: { id: Algo; label: string; note: string }[] = [
  { id: 'SHA-1', label: 'SHA-1', note: '160 bits, 40 hex characters. Broken: collisions have been made, so do not use it.' },
  { id: 'SHA-256', label: 'SHA-256', note: '256 bits, 64 hex characters. The everyday choice.' },
  { id: 'SHA-512', label: 'SHA-512', note: '512 bits, 128 hex characters.' },
];

/**
 * A hands-on hash demo: the same text always gives the same digest, one changed character changes about half of
 * it, and a per-user salt makes the same password store as different hashes. Uses the browser's own SHA functions.
 */
@Component({
  selector: 'app-hash-lab',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <section class="w" aria-label="Hash lab">
      <header class="head"><div class="title"><mat-icon aria-hidden="true">fingerprint</mat-icon> {{ show === 'digest' ? 'Hash lab: change one character' : 'Hash lab: two users, one password' }}</div></header>
      @if (!supported) {
        <p class="intro">This browser does not offer its hash functions here (they need a secure https page), so the lab cannot run.</p>
      } @else if (show === 'digest') {
        <p class="intro">Edit either message. Each one is hashed as you type. Characters of message B's hash that differ from message A's are highlighted.</p>

        <div class="algos" role="radiogroup" aria-label="Hash algorithm">
          @for (x of algos; track x.id) {
            <button type="button" role="radio" [attr.aria-checked]="s.algo === x.id" [class.on]="s.algo === x.id" (click)="setAlgo(x.id)">{{ x.label }}</button>
          }
        </div>
        <p class="algo-note">{{ algoNote }}</p>

        <label class="field">
          <span class="lbl">Message A</span>
          <textarea rows="2" [value]="s.a" (input)="set('a', $any($event.target).value)" spellcheck="false"></textarea>
        </label>
        <div class="digest"><span class="dl">Hash of A</span><code class="mono hex">{{ hashA }}</code></div>

        <label class="field">
          <span class="lbl">Message B</span>
          <textarea rows="2" [value]="s.b" (input)="set('b', $any($event.target).value)" spellcheck="false"></textarea>
        </label>
        <div class="digest"><span class="dl">Hash of B</span>
          <code class="mono hex">@for (c of diffB; track $index) {<span [class.diff]="c.diff">{{ c.ch }}</span>}</code>
        </div>

        <p class="verdict" role="status">
          @if (s.a === s.b) {
            <mat-icon aria-hidden="true">drag_handle</mat-icon> Same text, same hash, every time. That is how a download or a file is checked: hash it again and compare.
          } @else {
            <mat-icon aria-hidden="true">shuffle</mat-icon> {{ diffCount }} of {{ hashA.length }} characters differ. Underneath, {{ bitDiff }} of {{ hashA.length * 4 }} bits
            flipped ({{ bitPct }}%), about half, as a good hash should. The hash is the same length as before, and nothing in it hints at what changed.
          }
        </p>
        <div class="controls">
          <button type="button" class="btn" (click)="set('a', paragraph)">Make A a whole paragraph</button>
          <button type="button" class="btn" (click)="set('b', s.a)">Copy A into B</button>
          <span class="spacer"></span>
          <button type="button" class="btn ghost" (click)="reset()">Start over</button>
        </div>
      } @else {
        <p class="intro">A site never stores your password, only its hash. When you sign in it hashes what you typed and compares. But what if two people pick the same password?</p>
        <label class="field">
          <span class="lbl">Password both users chose</span>
          <input type="text" [value]="s.pw" (input)="set('pw', $any($event.target).value)" spellcheck="false" autocomplete="off" />
        </label>
        <label class="toggle">
          <input type="checkbox" [checked]="s.salted" (change)="set('salted', $any($event.target).checked)" />
          <span>Add a random salt for each user before hashing</span>
        </label>
        <div class="users">
          @for (u of users; track u.name; let i = $index) {
            <div class="user">
              <div class="u-name"><mat-icon aria-hidden="true">person</mat-icon> {{ u.name }}</div>
              @if (s.salted) {
                <div class="digest"><span class="dl">Salt (stored in the clear)</span><code class="mono">{{ u.salt }}</code></div>
                <div class="digest"><span class="dl">Stored: SHA-256(salt + password)</span><code class="mono hex">{{ userHashes[i] }}</code></div>
              } @else {
                <div class="digest"><span class="dl">Stored: SHA-256(password)</span><code class="mono hex">{{ userHashes[i] }}</code></div>
              }
            </div>
          }
        </div>
        <p class="verdict" role="status" [class.warn]="!s.salted" [class.ok]="s.salted">
          @if (s.salted) {
            <mat-icon aria-hidden="true">verified_user</mat-icon> Different hashes for the same password. A precomputed table of hashes is useless,
            and cracking alice's password tells the attacker nothing about bob's.
          } @else {
            <mat-icon aria-hidden="true">warning</mat-icon> Identical hashes. Anyone with the stolen table sees that both users share a password, and a
            rainbow table (precomputed hashes of common passwords) finds it in moments.
          }
        </p>
      }
    </section>
  `,
  styleUrl: './hash-lab.component.scss',
})
export class HashLabComponent implements OnInit {
  private work = inject(LessonWork, { optional: true });
  private static readonly KEY = 'hashlab';

  /** Which half of the lab to show. Both halves share one saved state. */
  @Input() show: 'digest' | 'salt' = 'digest';

  readonly supported = typeof crypto !== 'undefined' && !!crypto.subtle;
  readonly algos = ALGOS;
  readonly users = USERS;
  readonly paragraph = PARAGRAPH;

  s: HashLabState = { ...DEFAULTS };
  hashA = '';
  hashB = '';
  userHashes: string[] = ['', ''];
  /** Bumped on every change so a slow hash of old text never overwrites a newer one. */
  private run = 0;

  ngOnInit() {
    const saved = this.work?.get<Partial<HashLabState>>(HashLabComponent.KEY);
    this.s = { ...DEFAULTS, ...saved };
    this.update();
  }

  get algoNote(): string { return ALGOS.find(a => a.id === this.s.algo)?.note ?? ''; }

  get diffB(): { ch: string; diff: boolean }[] {
    return [...this.hashB].map((ch, i) => ({ ch, diff: ch !== this.hashA[i] }));
  }

  get diffCount(): number { return this.diffB.filter(c => c.diff).length; }

  /** Bits that differ between the two digests. Each hex character is four bits. */
  get bitDiff(): number {
    let n = 0;
    for (let i = 0; i < this.hashA.length; i++) {
      let x = parseInt(this.hashA[i], 16) ^ parseInt(this.hashB[i] ?? '0', 16);
      for (; x; x >>= 1) n += x & 1;
    }
    return n;
  }

  get bitPct(): number { return this.hashA.length ? Math.round((100 * this.bitDiff) / (this.hashA.length * 4)) : 0; }

  setAlgo(algo: Algo) { this.set('algo', algo); }

  set<K extends keyof HashLabState>(key: K, value: HashLabState[K]) {
    this.s = { ...this.s, [key]: value };
    this.work?.set(HashLabComponent.KEY, this.s);
    this.update();
  }

  reset() {
    this.s = { ...DEFAULTS };
    this.work?.clear(HashLabComponent.KEY);
    this.update();
  }

  private async update() {
    if (!this.supported) return;
    const run = ++this.run;
    const { a, b, algo, pw, salted } = this.s;
    const [ha, hb, ...hu] = await Promise.all([
      digest(algo, a), digest(algo, b), ...USERS.map(u => digest('SHA-256', (salted ? u.salt : '') + pw)),
    ]);
    if (run !== this.run) return;
    this.hashA = ha;
    this.hashB = hb;
    this.userHashes = hu;
  }
}

async function digest(algo: Algo, text: string): Promise<string> {
  const bytes = await crypto.subtle.digest(algo, new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('');
}
