import { Component, Input, OnChanges, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { LessonWork } from '../lesson-work.service';
import { CertCase, CertInfo } from '../networking.model';
import { MdPipe } from './md.pipe';

interface Saved { at: number; picks: (string | null)[]; checked: boolean[] }

/**
 * "Should the browser trust this?": each case shows the site being visited and the certificate chain it sent, drawn
 * from the root down to the site's own certificate. Pick a verdict, then see why and which field gave it away.
 */
@Component({
  selector: 'app-cert-check',
  standalone: true,
  imports: [MatIconModule, MdPipe],
  template: `
    <section class="w" [attr.aria-label]="title">
      <header class="head">
        <div class="title"><mat-icon aria-hidden="true">verified</mat-icon> {{ title }}</div>
        <div class="count" aria-live="polite">{{ rightCount }} of {{ cases.length }} right</div>
      </header>
      @if (intro) { <p class="intro" [innerHTML]="intro | md"></p> }

      <div class="tabs" role="tablist" aria-label="Cases">
        @for (c of cases; track $index; let i = $index) {
          <button type="button" role="tab" [attr.aria-selected]="i === at" [class.on]="i === at"
            [class.right]="checked[i] && picks[i] === c.answer" [class.wrong]="checked[i] && picks[i] !== c.answer" (click)="go(i)">
            @if (checked[i]) { <mat-icon aria-hidden="true">{{ picks[i] === c.answer ? 'check' : 'close' }}</mat-icon> }
            {{ c.name }}
          </button>
        }
      </div>

      @let c = cases[at];
      <div class="browser">
        <div class="bar">
          <mat-icon aria-hidden="true">{{ checked[at] ? (c.answer === options[0] ? 'lock' : 'gpp_bad') : 'help_outline' }}</mat-icon>
          <span class="mono url">{{ c.site }}</span>
        </div>
        <div class="today"><mat-icon aria-hidden="true">event</mat-icon> Today is {{ c.today }}</div>
      </div>

      <ol class="chain" aria-label="Certificate chain, from the root down">
        @for (cert of chainTopDown(c); track $index; let i = $index) {
          @let idx = c.chain.length - 1 - i;
          <li class="cert" [class.leaf]="idx === 0">
            <div class="c-head">
              <span class="role"><mat-icon aria-hidden="true">{{ idx === 0 ? 'language' : 'account_balance' }}</mat-icon> {{ cert.role }}</span>
              @if (cert.trusted !== undefined) {
                <span class="store" [class.yes]="cert.trusted" [class.clue]="isClue(idx, 'Trust store')">
                  <mat-icon aria-hidden="true">{{ cert.trusted ? 'verified_user' : 'gpp_maybe' }}</mat-icon>
                  {{ cert.trusted ? 'In this device\\'s trusted roots' : 'Not in this device\\'s trusted roots' }}
                </span>
              }
            </div>
            <dl>
              @for (f of fields(cert); track f.name) {
                <div class="f" [class.clue]="isClue(idx, f.name)">
                  <dt>{{ f.name }}</dt><dd class="mono">{{ f.value }}</dd>
                </div>
              }
            </dl>
          </li>
          @if (i < c.chain.length - 1) {
            <li class="link" aria-hidden="true"><mat-icon>south</mat-icon> signed the certificate below</li>
          }
        }
      </ol>

      <div class="ask" role="radiogroup" aria-label="What should the browser do?">
        <div class="q">What should the browser decide?</div>
        @for (o of options; track o) {
          <button type="button" role="radio" class="opt" [attr.aria-checked]="picks[at] === o" [attr.aria-disabled]="checked[at]"
            [class.on]="picks[at] === o && !checked[at]"
            [class.correct]="checked[at] && o === c.answer" [class.miss]="checked[at] && picks[at] === o && o !== c.answer"
            (click)="pick(o)">
            <mat-icon aria-hidden="true">{{ checked[at] && o === c.answer ? 'check_circle' : checked[at] && picks[at] === o ? 'cancel' : picks[at] === o ? 'radio_button_checked' : 'radio_button_unchecked' }}</mat-icon>
            <span>{{ o }}</span>
          </button>
        }
      </div>

      @if (checked[at]) {
        <div class="why" role="status" [class.good]="picks[at] === c.answer" [class.bad]="picks[at] !== c.answer">
          <strong>{{ picks[at] === c.answer ? 'Right.' : 'Not this time.' }}</strong>&ngsp;<span [innerHTML]="c.why | md"></span>
          @if (c.clue) { <div class="hint"><mat-icon aria-hidden="true">search</mat-icon> The field that gives it away is outlined above.</div> }
        </div>
      }

      <div class="controls">
        @if (!checked[at]) {
          <button type="button" class="btn primary" (click)="check()" [attr.aria-disabled]="!picks[at]">Check</button>
        } @else if (at < cases.length - 1) {
          <button type="button" class="btn primary" (click)="go(at + 1)">Next case <mat-icon aria-hidden="true">chevron_right</mat-icon></button>
        }
        <span class="spacer"></span>
        @if (checked[at]) { <button type="button" class="btn ghost" (click)="retry()">Try this case again</button> }
        @if (anyChecked) { <button type="button" class="btn ghost" (click)="reset()">Start over</button> }
      </div>
    </section>
  `,
  styleUrl: './cert-check.component.scss',
})
export class CertCheckComponent implements OnChanges {
  private work = inject(LessonWork, { optional: true });

  @Input({ required: true }) title = '';
  @Input() intro = '';
  /** The verdicts to choose from. The first is "trust it", which shows a padlock once checked. */
  @Input({ required: true }) options: string[] = [];
  @Input({ required: true }) cases: CertCase[] = [];

  at = 0;
  picks: (string | null)[] = [];
  checked: boolean[] = [];

  ngOnChanges() {
    const saved = this.work?.get<Saved>(this.key);
    this.at = Math.min(Math.max(saved?.at ?? 0, 0), this.cases.length - 1);
    this.picks = this.cases.map((_, i) => saved?.picks?.[i] ?? null);
    this.checked = this.cases.map((_, i) => !!saved?.checked?.[i] && !!this.picks[i]);
  }

  private get key(): string { return `certs:${this.title}`; }
  private save() { this.work?.set(this.key, { at: this.at, picks: this.picks, checked: this.checked }); }

  get rightCount(): number { return this.cases.filter((c, i) => this.checked[i] && this.picks[i] === c.answer).length; }
  get anyChecked(): boolean { return this.checked.some(Boolean); }

  chainTopDown(c: CertCase): CertInfo[] { return [...c.chain].reverse(); }

  fields(cert: CertInfo): { name: string; value: string }[] {
    return [
      { name: 'Subject', value: cert.subject },
      { name: 'Issuer', value: cert.issuer },
      { name: 'Valid from', value: cert.validFrom },
      { name: 'Valid to', value: cert.validTo },
      ...(cert.fields ?? []),
    ];
  }

  isClue(cert: number, field: string): boolean {
    const clue = this.cases[this.at].clue;
    return this.checked[this.at] && !!clue && clue.cert === cert && clue.field === field;
  }

  go(i: number) { this.at = i; this.save(); }

  pick(o: string) {
    if (this.checked[this.at]) return;
    this.picks[this.at] = o;
    this.save();
  }

  check() {
    if (!this.picks[this.at]) return;
    this.checked[this.at] = true;
    this.save();
  }

  retry() {
    this.picks[this.at] = null;
    this.checked[this.at] = false;
    this.save();
  }

  reset() {
    this.at = 0;
    this.picks = this.cases.map(() => null);
    this.checked = this.cases.map(() => false);
    this.work?.clear(this.key);
  }
}
