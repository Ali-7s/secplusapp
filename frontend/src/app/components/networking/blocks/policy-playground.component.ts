import { Component, Input, OnChanges, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { LessonWork } from '../lesson-work.service';
import { PolicyAttr, PolicyChallenge, PolicyRule } from '../networking.model';
import { MdPipe } from './md.pipe';

interface Saved { pick: Record<string, string>; done: number[] }

export interface PolicyDecision {
  effect: 'Allow' | 'Deny';
  /** The deciding rule's id, or "implicit" when nothing allows the request. */
  by: string;
}

/** Whether a rule applies to a request: every attribute it names must have one of the values it lists. */
export function ruleMatches(rule: PolicyRule, pick: Record<string, string>): boolean {
  return Object.entries(rule.when).every(([attr, values]) => values.includes(pick[attr]));
}

/** Cloud-style evaluation: any matching deny wins, then any matching allow, otherwise the implicit deny. */
export function decidePolicy(rules: PolicyRule[], pick: Record<string, string>): PolicyDecision {
  const hits = rules.filter(r => ruleMatches(r, pick));
  const deny = hits.find(r => r.effect === 'Deny');
  if (deny) return { effect: 'Deny', by: deny.id };
  const allow = hits.find(r => r.effect === 'Allow');
  return allow ? { effect: 'Allow', by: allow.id } : { effect: 'Deny', by: 'implicit' };
}

/**
 * An access policy to experiment with. Set each attribute of the request, watch which statements match and which
 * one decides, and work through the challenges. Challenges you complete stay ticked.
 */
@Component({
  selector: 'app-policy-playground',
  standalone: true,
  imports: [MatIconModule, MdPipe],
  template: `
    <section class="w" [attr.aria-label]="title">
      <header class="head">
        <div class="title"><mat-icon aria-hidden="true">policy</mat-icon> {{ title }}</div>
        <div class="count" aria-live="polite">{{ done.size }} of {{ challenges.length }} challenges done</div>
      </header>
      @if (intro) { <p class="intro" [innerHTML]="intro | md"></p> }

      <div class="cols">
        <div class="panel">
          <div class="p-title">The request</div>
          @for (a of attributes; track a.name) {
            <div class="attr" role="radiogroup" [attr.aria-label]="a.name">
              <span class="a-name">{{ a.name }}</span>
              <span class="a-opts">
                @for (o of a.options; track o) {
                  <button type="button" role="radio" [attr.aria-checked]="pick[a.name] === o" [class.on]="pick[a.name] === o" (click)="set(a.name, o)">{{ o }}</button>
                }
              </span>
            </div>
          }
        </div>

        <div class="panel">
          <div class="p-title">The policy</div>
          <ol class="rules">
            @for (r of rules; track r.id) {
              @let hit = matches(r);
              <li [class.hit]="hit" [class.decides]="decision.by === r.id">
                <span class="id">{{ r.id }}</span>
                <span [class]="'eff ' + r.effect.toLowerCase()">{{ r.effect }}</span>
                <span class="txt">{{ r.text }}</span>
                <mat-icon class="st" [attr.aria-label]="hit ? 'Applies to this request' : 'Does not apply'">{{ hit ? 'check_circle' : 'remove' }}</mat-icon>
              </li>
            }
            <li class="implicit" [class.decides]="decision.by === 'implicit'">
              <span class="id">—</span><span class="eff deny">Deny</span><span class="txt">Anything not allowed above (implicit deny)</span>
              <mat-icon class="st" aria-hidden="true">{{ decision.by === 'implicit' ? 'check_circle' : 'remove' }}</mat-icon>
            </li>
          </ol>
        </div>
      </div>

      <div class="decision" role="status" [class.allow]="decision.effect === 'Allow'" [class.deny]="decision.effect === 'Deny'">
        <mat-icon aria-hidden="true">{{ decision.effect === 'Allow' ? 'lock_open' : 'block' }}</mat-icon>
        <span>
          @if (decision.effect === 'Allow') {
            <strong>Allowed by {{ decision.by }}.</strong> A statement allows it and no deny applies.
          } @else if (decision.by === 'implicit') {
            <strong>Denied: nothing allows it.</strong> No deny statement mentions it, but no allow covers it either, so the implicit deny applies.
          } @else {
            <strong>Denied by {{ decision.by }}.</strong> {{ allowsToo ? 'An allow matches too, but an explicit deny always overrides an allow.' : 'An explicit deny applies.' }}
          }
        </span>
      </div>

      <div class="challenges">
        <div class="p-title">Challenges: set up a request that is…</div>
        <ul>
          @for (c of challenges; track $index; let i = $index) {
            <li [class.done]="done.has(i)" [class.now]="meets(c)">
              <mat-icon aria-hidden="true">{{ done.has(i) ? 'check_box' : 'check_box_outline_blank' }}</mat-icon>
              <span [innerHTML]="c.goal | md"></span>
            </li>
          }
        </ul>
        @if (done.size) { <div class="controls"><span class="spacer"></span><button type="button" class="btn ghost" (click)="reset()">Clear the challenges</button></div> }
      </div>
    </section>
  `,
  styleUrl: './policy-playground.component.scss',
})
export class PolicyPlaygroundComponent implements OnChanges {
  private work = inject(LessonWork, { optional: true });

  @Input({ required: true }) title = '';
  @Input() intro = '';
  @Input({ required: true }) attributes: PolicyAttr[] = [];
  @Input({ required: true }) rules: PolicyRule[] = [];
  @Input({ required: true }) challenges: PolicyChallenge[] = [];

  pick: Record<string, string> = {};
  done = new Set<number>();
  decision: PolicyDecision = { effect: 'Deny', by: 'implicit' };

  ngOnChanges() {
    const saved = this.work?.get<Saved>(this.key);
    this.pick = Object.fromEntries(this.attributes.map(a => [a.name, a.options.includes(saved?.pick?.[a.name] ?? '') ? saved!.pick[a.name] : a.options[0]]));
    this.done = new Set((saved?.done ?? []).filter(i => i >= 0 && i < this.challenges.length));
    // Only requests you set up yourself count towards the challenges, not the one the page opens with.
    this.decision = decidePolicy(this.rules, this.pick);
  }

  private get key(): string { return `policy:${this.title}`; }
  private save() { this.work?.set(this.key, { pick: this.pick, done: [...this.done] }); }

  matches(r: PolicyRule): boolean { return ruleMatches(r, this.pick); }
  get allowsToo(): boolean { return this.rules.some(r => r.effect === 'Allow' && this.matches(r)); }
  meets(c: PolicyChallenge): boolean { return c.effect === this.decision.effect && c.by === this.decision.by; }

  set(attr: string, value: string) {
    this.pick = { ...this.pick, [attr]: value };
    this.evaluate();
    this.save();
  }

  private evaluate() {
    this.decision = decidePolicy(this.rules, this.pick);
    this.challenges.forEach((c, i) => { if (this.meets(c)) this.done.add(i); });
  }

  reset() {
    this.done = new Set();
    this.save();
  }
}
