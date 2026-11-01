import { Component, OnInit, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { LessonWork } from '../lesson-work.service';
import { MdPipe } from './md.pipe';

interface PermTask { name: string; dir?: boolean; goal: string; start: string; target: string; why: string }

const TASKS: PermTask[] = [
  { name: 'id_rsa', start: '644', target: '600', goal: 'Your **SSH private key**. Only you may read and change it. Nobody else gets anything.',
    why: '600 is rw for the owner and nothing for anyone else. SSH refuses to use a private key that others can read.' },
  { name: 'deploy.sh', start: '777', target: '750', goal: 'A **script** the finance team runs. You: everything. The finance group: read and run it. Everyone else: nothing.',
    why: '7 (4+2+1) for you, 5 (4+1) for the group, 0 for others. 777 would let anyone change the script and run whatever they put in it.' },
  { name: 'index.html', start: '600', target: '644', goal: 'A **public web page**. You can edit it. Everyone else, including the web server, can only read it.',
    why: '6 (4+2) for you and 4 for everyone else: readable by all, writable only by the owner.' },
  { name: 'db.conf', start: '777', target: '640', goal: 'A **config file with the database password**. You: read and write. The web server\'s group: read only. Others: nothing.',
    why: '640: secrets should never be readable by "others", and nobody needs to execute a config file.' },
  { name: 'reports', dir: true, start: '777', target: '755', goal: 'A **shared folder**. Everyone can list it and go into it, but only you can add or delete files in it.',
    why: 'On a folder, r lists the names, w creates and deletes files, and x lets you go into it. 755 gives everyone r-x, and only you w.' },
];

const WHO = [
  { key: 'u', label: 'Owner', person: 'alice' },
  { key: 'g', label: 'Group', person: 'bob (in the group)' },
  { key: 'o', label: 'Others', person: 'carol (everyone else)' },
];
const BITS = [{ v: 4, l: 'Read', c: 'r' }, { v: 2, l: 'Write', c: 'w' }, { v: 1, l: 'Execute', c: 'x' }];

interface Saved { active: number; mode: string; done: number[] }

/** Set Linux permissions with checkboxes or as three digits, and see the symbolic form and what each person can do. */
@Component({
  selector: 'app-perms-lab',
  standalone: true,
  imports: [MatIconModule, MdPipe],
  template: `
    <section class="w" aria-label="Linux permissions lab">
      <header class="head">
        <div class="title"><mat-icon aria-hidden="true">folder_shared</mat-icon> Linux permissions lab</div>
        <div class="count" aria-live="polite">{{ done.size }} of {{ tasks.length }} files set</div>
      </header>
      <p class="intro">Pick a file, then set its permissions with the boxes or by typing the three digits. A file is done when it matches its description.</p>

      <div class="files" role="radiogroup" aria-label="File">
        @for (t of tasks; track t.name; let i = $index) {
          <button type="button" role="radio" [attr.aria-checked]="active === i" [class.on]="active === i" [class.done]="done.has(i)" (click)="pick(i)">
            <mat-icon aria-hidden="true">{{ done.has(i) ? 'check_circle' : t.dir ? 'folder' : 'description' }}</mat-icon><span class="mono">{{ t.name }}{{ t.dir ? '/' : '' }}</span>
          </button>
        }
      </div>
      <p class="goal" [innerHTML]="task.goal | md"></p>

      <div class="lab">
        <table class="grid">
          <thead><tr><th scope="col"></th>@for (b of bits; track b.v) { <th scope="col">{{ b.l }} <span class="mono">({{ b.v }})</span></th> }<th scope="col">Digit</th></tr></thead>
          <tbody>
            @for (w of who; track w.key; let i = $index) {
              <tr>
                <th scope="row">{{ w.label }}</th>
                @for (b of bits; track b.v) {
                  <td><input type="checkbox" [checked]="has(i, b.v)" (change)="flip(i, b.v)" [attr.aria-label]="w.label + ' ' + b.l" /></td>
                }
                <td class="mono digit">{{ mode[i] }}</td>
              </tr>
            }
          </tbody>
        </table>

        <div class="out">
          <label class="num"><span>As digits</span>
            <input class="mono" inputmode="numeric" maxlength="3" [value]="mode" (input)="typed($any($event.target).value)" aria-label="Permissions as three digits" /></label>
          <div class="ls mono" aria-label="As ls -l shows it">{{ symbolic }} alice finance {{ task.name }}</div>
          <div class="cmd mono">$ chmod {{ mode }} {{ task.name }}</div>
          <ul class="people">
            @for (w of who; track w.key; let i = $index) {
              <li><strong>{{ w.person }}</strong>: {{ can(i) }}</li>
            }
          </ul>
        </div>
      </div>

      @if (done.has(active)) {
        <div class="why good" role="status"><strong>Done.</strong> {{ task.why }}</div>
      }
      <div class="controls"><span class="spacer"></span>
        <button type="button" class="btn ghost" (click)="restart()">Start this file again</button>
      </div>
    </section>
  `,
  styleUrl: './perms-lab.component.scss',
})
export class PermsLabComponent implements OnInit {
  private work = inject(LessonWork, { optional: true });
  readonly tasks = TASKS;
  readonly who = WHO;
  readonly bits = BITS;

  active = 0;
  mode = TASKS[0].start;
  done = new Set<number>();

  ngOnInit() {
    const saved = this.work?.get<Saved>('perms');
    if (saved && saved.active >= 0 && saved.active < TASKS.length) this.active = saved.active;
    this.done = new Set((saved?.done ?? []).filter(i => i >= 0 && i < TASKS.length));
    this.mode = saved && /^[0-7]{3}$/.test(saved.mode) ? saved.mode : TASKS[this.active].start;
  }

  get task(): PermTask { return TASKS[this.active]; }

  get symbolic(): string {
    return (this.task.dir ? 'd' : '-') + [...this.mode].map(d => BITS.map(b => (+d & b.v ? b.c : '-')).join('')).join('');
  }

  has(i: number, v: number): boolean { return (+this.mode[i] & v) !== 0; }

  can(i: number): string {
    const d = +this.mode[i];
    const words = this.task.dir ? ['list it', 'add and delete files', 'go into it'] : ['read', 'change', 'run'];
    const yes = BITS.map((b, k) => (d & b.v ? words[k] : '')).filter(Boolean);
    return yes.length ? yes.join(', ') : 'nothing';
  }

  pick(i: number) {
    this.active = i;
    this.mode = this.done.has(i) ? TASKS[i].target : TASKS[i].start;
    this.save();
  }

  flip(i: number, v: number) {
    const digits = [...this.mode].map(Number);
    digits[i] ^= v;
    this.setMode(digits.join(''));
  }

  typed(value: string) {
    if (/^[0-7]{3}$/.test(value)) this.setMode(value);
  }

  restart() {
    this.done.delete(this.active);
    this.mode = this.task.start;
    this.save();
  }

  private setMode(mode: string) {
    this.mode = mode;
    if (mode === this.task.target) this.done.add(this.active);
    this.save();
  }

  private save() { this.work?.set('perms', { active: this.active, mode: this.mode, done: [...this.done] }); }
}
