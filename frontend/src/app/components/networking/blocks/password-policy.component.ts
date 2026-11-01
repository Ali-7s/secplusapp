import { Component, OnInit, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { LessonWork } from '../lesson-work.service';

interface Policy {
  length: number;
  composition: boolean;
  expiry: number;
  breached: boolean;
  history: number;
  reset: 'questions' | 'authenticator';
  threshold: number;
  unlock: 'admin' | 'auto';
  mfa: boolean;
}

/** A typical old-fashioned policy, so there is something to fix. */
const START: Policy = { length: 8, composition: true, expiry: 90, breached: false, history: 5, reset: 'questions', threshold: 3, unlock: 'admin', mfa: false };

type Status = 'stopped' | 'partly' | 'open';
interface Line { name: string; status: Status; text: string }
interface Problem { name: string; text: string }

/** Offline guessing speed against a fast, unsalted hash on a rig of graphics cards. */
const GUESSES_PER_SECOND = 1e10;

/**
 * A password and lockout policy builder. Change the settings and see which attacks the policy stops, which it
 * only slows down, and what problems it causes for users and the help desk.
 */
@Component({
  selector: 'app-password-policy',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <section class="w" aria-label="Password policy builder">
      <header class="head">
        <div class="title"><mat-icon aria-hidden="true">password</mat-icon> Password policy builder</div>
        <div class="count" aria-live="polite">{{ stopped }} of {{ attacks.length }} attacks stopped · {{ problems.length }} {{ problems.length === 1 ? 'problem' : 'problems' }}</div>
      </header>
      <p class="intro">This is the company's current policy, written years ago. Change the settings until every attack is stopped and nothing causes a problem.</p>

      <div class="settings">
        <fieldset>
          <legend>Passwords</legend>
          <label><span>Minimum length</span>
            <select (change)="set('length', +$any($event.target).value)">
              @for (n of [8, 12, 15, 20]; track n) { <option [value]="n" [selected]="p.length === n">{{ n }} characters</option> }
            </select></label>
          <label><span>Composition rules</span>
            <select (change)="set('composition', $any($event.target).value === 'yes')">
              <option value="yes" [selected]="p.composition">Upper, lower, digit and symbol required</option>
              <option value="no" [selected]="!p.composition">None: any characters, spaces allowed</option>
            </select></label>
          <label><span>Expiration</span>
            <select (change)="set('expiry', +$any($event.target).value)">
              <option value="30" [selected]="p.expiry === 30">Every 30 days</option>
              <option value="90" [selected]="p.expiry === 90">Every 90 days</option>
              <option value="0" [selected]="p.expiry === 0">Never on a schedule; forced change if compromised</option>
            </select></label>
          <label><span>Breached password check</span>
            <select (change)="set('breached', $any($event.target).value === 'on')">
              <option value="off" [selected]="!p.breached">Off</option>
              <option value="on" [selected]="p.breached">Reject passwords found in breach lists</option>
            </select></label>
          <label><span>Password history</span>
            <select (change)="set('history', +$any($event.target).value)">
              @for (n of [0, 5, 24]; track n) { <option [value]="n" [selected]="p.history === n">{{ n ? 'Remember the last ' + n : 'None' }}</option> }
            </select></label>
          <label><span>Self-service reset</span>
            <select (change)="set('reset', $any($event.target).value)">
              <option value="questions" [selected]="p.reset === 'questions'">Security questions</option>
              <option value="authenticator" [selected]="p.reset === 'authenticator'">Code from an authenticator registered earlier</option>
            </select></label>
        </fieldset>
        <fieldset>
          <legend>Sign-in</legend>
          <label><span>Account lockout</span>
            <select (change)="set('threshold', +$any($event.target).value)">
              <option value="0" [selected]="p.threshold === 0">Never lock</option>
              <option value="3" [selected]="p.threshold === 3">After 3 failures in 15 minutes</option>
              <option value="10" [selected]="p.threshold === 10">After 10 failures in 15 minutes</option>
            </select></label>
          <label><span>Locked accounts</span>
            <select (change)="set('unlock', $any($event.target).value)" [disabled]="p.threshold === 0">
              <option value="admin" [selected]="p.unlock === 'admin'">Stay locked until the help desk unlocks them</option>
              <option value="auto" [selected]="p.unlock === 'auto'">Unlock automatically after 30 minutes</option>
            </select></label>
          <label><span>Multifactor authentication</span>
            <select (change)="set('mfa', $any($event.target).value === 'on')">
              <option value="off" [selected]="!p.mfa">Off: password only</option>
              <option value="on" [selected]="p.mfa">On: password plus an authenticator app</option>
            </select></label>
          <p class="crack"><mat-icon aria-hidden="true">timer</mat-icon>
            <span>A random {{ p.length }}-character password {{ p.composition ? 'using all four character types' : 'of lowercase letters only' }} takes about
              <strong>{{ crackTime }}</strong> to crack offline at 10 billion guesses a second. Real people choose far less random ones.</span></p>
        </fieldset>
      </div>

      <h3 class="sub">Attacks</h3>
      <ul class="board">
        @for (a of attacks; track a.name) {
          <li [class]="a.status">
            <mat-icon aria-hidden="true">{{ a.status === 'stopped' ? 'shield' : a.status === 'partly' ? 'shield_moon' : 'warning' }}</mat-icon>
            <span><strong>{{ a.name }}</strong> <span class="tag">{{ a.status === 'stopped' ? 'Stopped' : a.status === 'partly' ? 'Only slowed' : 'Works' }}</span><br />{{ a.text }}</span>
          </li>
        }
      </ul>

      <h3 class="sub">Problems the policy causes</h3>
      @if (problems.length) {
        <ul class="board">
          @for (x of problems; track x.name) {
            <li class="problem"><mat-icon aria-hidden="true">report</mat-icon><span><strong>{{ x.name }}</strong><br />{{ x.text }}</span></li>
          }
        </ul>
      } @else {
        <p class="none">None. Users get a policy they can live with.</p>
      }

      @if (stopped === attacks.length && !problems.length) {
        <div class="result" role="status"><mat-icon aria-hidden="true">emoji_events</mat-icon>
          <span><strong>That is a modern policy.</strong> Long passwords, no composition rules or scheduled changes, breach checks, sensible lockout and MFA: what NIST SP 800-63B recommends.</span></div>
      }
      <div class="controls"><span class="spacer"></span><button type="button" class="btn ghost" (click)="reset()">Back to the old policy</button></div>
    </section>
  `,
  styleUrl: './password-policy.component.scss',
})
export class PasswordPolicyComponent implements OnInit {
  private work = inject(LessonWork, { optional: true });
  p: Policy = { ...START };

  ngOnInit() { this.p = { ...START, ...this.work?.get<Partial<Policy>>('pwpolicy') }; }

  set<K extends keyof Policy>(key: K, value: Policy[K]) {
    this.p = { ...this.p, [key]: value };
    this.work?.set('pwpolicy', this.p);
  }

  reset() { this.p = { ...START }; this.work?.clear('pwpolicy'); }

  get crackTime(): string {
    const seconds = (this.p.composition ? 94 : 26) ** this.p.length / 2 / GUESSES_PER_SECOND;
    const year = 31557600;
    const units: [number, string][] = [[year * 1e9, 'billion years'], [year * 1e6, 'million years'], [year * 1e3, 'thousand years'], [year, 'years'], [86400, 'days'], [3600, 'hours'], [60, 'minutes'], [1, 'seconds']];
    if (seconds > 13.8e9 * year) return 'longer than the universe has existed';
    const [size, name] = units.find(([s]) => seconds >= s) ?? [1, 'seconds'];
    const n = seconds / size;
    return `${n < 10 ? +n.toFixed(1) : Math.round(n).toLocaleString('en-US')} ${name}`;
  }

  get attacks(): Line[] {
    const p = this.p;
    const lockout = p.threshold > 0;
    return [
      {
        name: 'Online brute force', status: lockout || p.mfa ? 'stopped' : 'open',
        text: lockout ? 'Lockout stops anyone trying thousands of guesses against one account.' : p.mfa ? 'Guessing the password is not enough without the second factor.' : 'With no lockout and no MFA, a script can guess against one account all night.',
      },
      {
        name: 'Password spraying', status: p.breached || p.mfa ? 'stopped' : 'open',
        text: p.breached || p.mfa
          ? (p.mfa ? 'Even a sprayed common password is useless without the second factor.' : 'Common passwords such as Winter2025! are in every breach list, so nobody can choose them.')
          : 'One common password tried once against every account stays under any lockout threshold. Lockout does not help here.',
      },
      {
        name: 'Credential stuffing', status: p.mfa ? 'stopped' : p.breached ? 'partly' : 'open',
        text: p.mfa ? 'Passwords leaked from other websites fail without the second factor.' : p.breached
          ? 'Passwords already in breach lists are rejected, but a leak the lists do not know yet still works. MFA closes this.'
          : 'Staff who reuse a password leaked from another site can be signed in as, first try.',
      },
      {
        name: 'Offline cracking of stolen hashes', status: p.length >= 15 ? 'stopped' : p.length >= 12 ? 'partly' : 'open',
        text: p.length >= 15 ? 'Long passwords take far too long to crack, even with fast hardware.' : p.length >= 12
          ? 'Better, but a short password a person chose can still fall to a dictionary with rules. Go longer.'
          : 'Short passwords fall quickly once an attacker has the hash file, and lockout cannot help offline.',
      },
      {
        name: 'Account recovery abuse', status: p.reset === 'authenticator' ? 'stopped' : 'open',
        text: p.reset === 'authenticator' ? 'A reset needs something the user registered earlier, which an attacker does not have.'
          : 'A mother\'s maiden name or first pet is often on social media, so an attacker can reset the password.',
      },
      {
        name: 'Reusing an old password', status: p.history === 24 ? 'stopped' : p.history === 5 ? 'partly' : 'open',
        text: p.history === 24 ? 'After a suspected compromise, nobody can switch back to a password the attacker may know.'
          : p.history === 5 ? 'Users can cycle through five quick changes and be back on their favorite. Remember more.'
          : 'A user forced to change after a compromise can set the same password again.',
      },
    ];
  }

  get stopped(): number { return this.attacks.filter(a => a.status === 'stopped').length; }

  get problems(): Problem[] {
    const p = this.p;
    const out: Problem[] = [];
    if (p.threshold === 3 && p.unlock === 'admin') out.push({ name: 'Anyone can lock everyone out', text: 'Three wrong guesses per account, and accounts stay locked: an attacker can deny service to the whole company, and the help desk drowns.' });
    else if (p.threshold === 3) out.push({ name: 'Users lock themselves out', text: 'Three tries is easy to hit with a typo or an old password saved on a phone. Ten is enough to stop guessing.' });
    else if (p.threshold === 10 && p.unlock === 'admin') out.push({ name: 'Lockouts need the help desk', text: 'An attacker can still lock accounts on purpose, and every one becomes a ticket. Unlock automatically after a while.' });
    if (p.expiry) out.push({ name: 'Scheduled changes backfire', text: `Forced changes every ${p.expiry} days lead to Spring2025! becoming Summer2025!, and to passwords on sticky notes. Change only when compromise is suspected.` });
    if (p.composition) out.push({ name: 'Composition rules make passwords predictable', text: 'Required symbols and digits give Password1! and Welcome2025!. Length and breach checks protect better.' });
    return out;
  }
}
