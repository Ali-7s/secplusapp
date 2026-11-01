import { Component, OnInit, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { LessonWork } from '../lesson-work.service';

type GroupId = 'corp' | 'byod' | 'kiosk';
type SettingId = 'mode' | 'apps' | 'lost' | 'geo' | 'rooted' | 'lock';
type Policy = Record<SettingId, string>;

const GROUPS: { id: GroupId; name: string; icon: string; note: string }[] = [
  { id: 'corp', name: 'Company phones', icon: 'smartphone', note: 'Owned by the company and issued to sales staff. The company may erase them completely.' },
  { id: 'byod', name: 'Personal phones (BYOD)', icon: 'phone_android', note: 'Staff\'s own phones, used for work email and files. The company must never touch personal photos or apps.' },
  { id: 'kiosk', name: 'Lobby tablets', icon: 'tablet', note: 'Shared by visitors to sign in at reception with one check-in app. Two have gone missing before.' },
];

const SETTINGS: { id: SettingId; name: string; options: { v: string; l: string }[] }[] = [
  { id: 'mode', name: 'What MDM manages', options: [{ v: 'full', l: 'The whole device' }, { v: 'container', l: 'A work profile only (containerization)' }, { v: 'kiosk', l: 'Single-app kiosk mode' }] },
  { id: 'apps', name: 'Apps', options: [{ v: 'store', l: 'Anything, from anywhere' }, { v: 'catalog', l: 'Managed catalog only, no sideloading' }] },
  { id: 'lost', name: 'When lost or the user leaves', options: [{ v: 'lock', l: 'Remote lock only' }, { v: 'selective', l: 'Selective wipe of work data' }, { v: 'full', l: 'Full remote wipe' }] },
  { id: 'geo', name: 'Location', options: [{ v: 'off', l: 'No location rules' }, { v: 'fence', l: 'Geofence: lock and alert IT outside the building' }] },
  { id: 'rooted', name: 'Jailbroken or rooted device', options: [{ v: 'warn', l: 'Show the user a warning' }, { v: 'block', l: 'Block company access until compliant' }] },
  { id: 'lock', name: 'Screen lock and encryption', options: [{ v: 'none', l: 'Not required' }, { v: 'pin', l: 'PIN or biometric, encrypted storage' }] },
];

/** Factory settings: everything open, so there is plenty to configure. */
const START: Record<GroupId, Policy> = {
  corp: { mode: 'full', apps: 'store', lost: 'lock', geo: 'off', rooted: 'warn', lock: 'none' },
  byod: { mode: 'full', apps: 'store', lost: 'lock', geo: 'off', rooted: 'warn', lock: 'none' },
  kiosk: { mode: 'full', apps: 'store', lost: 'lock', geo: 'off', rooted: 'warn', lock: 'none' },
};

interface Incident {
  day: string;
  group: GroupId;
  setting: SettingId;
  what: string;
  /** Outcome for each value of the setting; `good` marks the right one. */
  results: Record<string, { good?: boolean; text: string }>;
}

const WEEK: Incident[] = [
  { day: 'Monday', group: 'corp', setting: 'lost', what: 'A sales rep\'s company phone is stolen from a car.', results: {
    lock: { text: 'Locked, but the thief has the device and all its data, and can keep trying to get in. The company owns it: erase it.' },
    selective: { text: 'Work data is gone, but this is a company device with nothing personal on it. A full wipe leaves the thief nothing.' },
    full: { good: true, text: 'The whole company phone is erased. Nothing is left for the thief.' } } },
  { day: 'Monday', group: 'corp', setting: 'lock', what: 'Someone finds a company phone on a train and tries to read the email on it.', results: {
    none: { text: 'No screen lock: the finder reads customer emails straight away.' },
    pin: { good: true, text: 'The screen lock stops them, and encrypted storage keeps the data safe even if the chips are read directly.' } } },
  { day: 'Tuesday', group: 'corp', setting: 'apps', what: 'A rep installs a "free VPN" app downloaded from a website, outside any app store.', results: {
    store: { text: 'Installed. Sideloaded apps skip the store\'s checks, and this one carries spyware.' },
    catalog: { good: true, text: 'Blocked: only apps from the managed catalog can be installed, and sideloading is off.' } } },
  { day: 'Wednesday', group: 'byod', setting: 'mode', what: 'HR wants to stop work files being copied into personal apps, without managing staff\'s private lives.', results: {
    full: { text: 'It works, but the company now controls the whole personal phone. Staff object, and some refuse to enroll.' },
    container: { good: true, text: 'Work apps and data live in a separate, managed work profile. Copying out of it is blocked, and personal apps stay private.' },
    kiosk: { text: 'A personal phone locked to one app is useless to its owner.' } } },
  { day: 'Thursday', group: 'byod', setting: 'lost', what: 'An employee leaves the company and keeps their own phone.', results: {
    lock: { text: 'You have locked someone\'s personal phone, and the work data is still on it.' },
    selective: { good: true, text: 'Only the work profile and its data are removed. Their photos and apps are untouched.' },
    full: { text: 'You have erased a former employee\'s family photos. That is exactly what the BYOD agreement forbids.' } } },
  { day: 'Thursday', group: 'byod', setting: 'rooted', what: 'An employee roots their phone to install a custom system.', results: {
    warn: { text: 'They tap past the warning. Rooting removes the operating system\'s protections, and the work data is now exposed.' },
    block: { good: true, text: 'The phone fails the compliance check, so it loses access to company email and files until it is restored.' } } },
  { day: 'Friday', group: 'kiosk', setting: 'mode', what: 'A visitor tries to open the web browser on a lobby tablet.', results: {
    full: { text: 'The browser opens, and anyone can browse or sign in to anything on a shared device.' },
    container: { text: 'A work profile separates data on someone\'s own phone. The tablet still runs any app.' },
    kiosk: { good: true, text: 'Kiosk mode keeps the tablet locked to the check-in app. There is no browser to open.' } } },
  { day: 'Friday', group: 'kiosk', setting: 'geo', what: 'A visitor walks out of the building with a tablet in their bag.', results: {
    off: { text: 'Nobody notices until Monday.' },
    fence: { good: true, text: 'As it leaves the geofence the tablet locks itself and alerts IT, with its last location.' } } },
];

/**
 * An MDM console for three device groups. Set each group's policy, then see how it handles a week of incidents.
 */
@Component({
  selector: 'app-mdm-console',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <section class="w" aria-label="MDM console">
      <header class="head">
        <div class="title"><mat-icon aria-hidden="true">phonelink_setup</mat-icon> MDM console</div>
        <div class="count" aria-live="polite">{{ handled }} of {{ week.length }} incidents handled well</div>
      </header>
      <p class="intro">Every group starts with the vendor's defaults. Pick a group, set its policy, and watch how this week's incidents go.</p>

      <div class="groups" role="tablist" aria-label="Device group">
        @for (g of groups; track g.id) {
          <button type="button" role="tab" [attr.aria-selected]="group === g.id" [class.on]="group === g.id" (click)="setGroup(g.id)">
            <mat-icon aria-hidden="true">{{ g.icon }}</mat-icon><span>{{ g.name }}</span><span class="score">{{ score(g.id) }}</span>
          </button>
        }
      </div>
      <p class="note">{{ current.note }}</p>

      <div class="settings" role="tabpanel">
        @for (s of settings; track s.id) {
          <label><span>{{ s.name }}</span>
            <select (change)="set(s.id, $any($event.target).value)">
              @for (o of s.options; track o.v) { <option [value]="o.v" [selected]="policy[group][s.id] === o.v">{{ o.l }}</option> }
            </select></label>
        }
      </div>

      <h3 class="sub">This week</h3>
      <ol class="week">
        @for (e of week; track $index) {
          @let r = result(e);
          <li [class.good]="r.good" [class.bad]="!r.good">
            <mat-icon aria-hidden="true">{{ r.good ? 'check_circle' : 'error' }}</mat-icon>
            <span><strong>{{ e.day }}, {{ groupName(e.group) }}:</strong> {{ e.what }}<br /><span class="out">{{ r.text }}</span></span>
          </li>
        }
      </ol>

      @if (handled === week.length) {
        <div class="result" role="status"><mat-icon aria-hidden="true">emoji_events</mat-icon>
          <span><strong>A good week.</strong> Full control and full wipe for company phones, a work container and selective wipe for personal ones, kiosk mode and a geofence for shared tablets.</span></div>
      }
      <div class="controls"><span class="spacer"></span><button type="button" class="btn ghost" (click)="reset()">Back to the defaults</button></div>
    </section>
  `,
  styleUrl: './mdm-console.component.scss',
})
export class MdmConsoleComponent implements OnInit {
  private work = inject(LessonWork, { optional: true });
  readonly groups = GROUPS;
  readonly settings = SETTINGS;
  readonly week = WEEK;

  group: GroupId = 'corp';
  policy: Record<GroupId, Policy> = structuredClone(START);

  ngOnInit() {
    const saved = this.work?.get<{ group: GroupId; policy: Record<GroupId, Partial<Policy>> }>('mdm');
    if (saved && GROUPS.some(g => g.id === saved.group)) this.group = saved.group;
    for (const g of GROUPS) this.policy[g.id] = { ...START[g.id], ...saved?.policy?.[g.id] };
  }

  get current() { return GROUPS.find(g => g.id === this.group)!; }
  groupName(id: GroupId): string { return GROUPS.find(g => g.id === id)!.name; }

  result(e: Incident): { good?: boolean; text: string } { return e.results[this.policy[e.group][e.setting]]; }
  get handled(): number { return WEEK.filter(e => this.result(e).good).length; }
  score(id: GroupId): string {
    const mine = WEEK.filter(e => e.group === id);
    return `${mine.filter(e => this.result(e).good).length}/${mine.length}`;
  }

  setGroup(id: GroupId) { this.group = id; this.save(); }
  set(setting: SettingId, value: string) {
    this.policy = { ...this.policy, [this.group]: { ...this.policy[this.group], [setting]: value } };
    this.save();
  }
  reset() { this.policy = structuredClone(START); this.work?.clear('mdm'); }
  private save() { this.work?.set('mdm', { group: this.group, policy: this.policy }); }
}
