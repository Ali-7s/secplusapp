import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { LessonWork } from '../lesson-work.service';
import { FILTERS, FilterId, RunAs, TRAV_MISSIONS, TravMission, TravResult, download, travMissions } from './traversal';

interface Attempt { raw: string; filter: FilterId; runAs: RunAs }
interface Saved { raw: string; filter: FilterId; runAs: RunAs; done: TravMission[]; log: Attempt[] }

/** A download link with a file name in it. Type your own name, watch the server build the path, and climb out. */
@Component({
  selector: 'app-traversal',
  standalone: true,
  imports: [MatIconModule, FormsModule],
  template: `
    <section class="w" aria-label="Directory traversal lab">
      <header class="head">
        <div class="title"><mat-icon aria-hidden="true">folder_open</mat-icon> Directory traversal lab</div>
        <div class="count" aria-live="polite">{{ done.length }} of {{ missions.length }} missions</div>
      </header>
      <p class="intro">The download page at <span class="mono">files.example/download?file=report.pdf</span> takes the name you give it and opens that file from <span class="mono">/var/www/files/</span>. Change the name. The server's working is shown step by step.</p>

      <ol class="missions">
        @for (m of missions; track m.id) {
          <li [class.done]="done.includes(m.id)"><mat-icon aria-hidden="true">{{ done.includes(m.id) ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon> {{ m.text }}</li>
        }
      </ol>

      <details class="known">
        <summary><mat-icon aria-hidden="true">lightbulb</mat-icon> Useful to know</summary>
        <ul>
          <li><span class="mono">../</span> means "the folder above". From <span class="mono">/var/www/files/</span>, one <span class="mono">../</span> is <span class="mono">/var/www/</span>.</li>
          <li>The app's code lives in <span class="mono">/var/www/app/</span>. Linux keeps accounts in <span class="mono">/etc/passwd</span> and password hashes in <span class="mono">/etc/shadow</span>.</li>
          <li>In a URL, <span class="mono">%2e</span> is a dot and <span class="mono">%2f</span> is a slash. The server decodes them before opening the file.</li>
        </ul>
      </details>

      <div class="cols">
        <div class="panel">
          <form class="box" (ngSubmit)="fire()">
            <label class="lbl" for="trav-file">files.example/download?file=</label>
            <div class="row">
              <input id="trav-file" name="file" class="mono" [(ngModel)]="raw" (ngModelChange)="save()" placeholder="report.pdf" autocomplete="off" spellcheck="false" />
              <button type="submit" class="btn primary"><mat-icon aria-hidden="true">download</mat-icon> Download</button>
            </div>
          </form>
          @if (result; as r) {
            <div class="card" [class.ok]="r.ok && r.escaped" [class.no]="!r.ok" aria-live="polite">
              <ol class="steps">
                @for (s of r.steps; track $index) { <li><span class="s-l">{{ s.label }}</span><span class="mono">{{ s.value }}</span></li> }
              </ol>
              <div class="status"><strong>{{ r.status }}</strong></div>
              @for (l of r.lines; track $index) { <div class="mono line">{{ l }}</div> }
              @if (r.note) { <div class="note"><mat-icon aria-hidden="true">info</mat-icon> {{ r.note }}</div> }
            </div>
          }
        </div>
        <div class="side">
          <fieldset class="panel">
            <legend>How the code checks the name</legend>
            @for (f of filters; track f.id) {
              <label class="opt" [class.on]="filter === f.id">
                <input type="radio" name="trav-filter" [checked]="filter === f.id" (change)="filter = f.id; save()" />
                <span class="body"><span class="nm">{{ f.name }}</span>@if (filter === f.id) { <pre class="code mono">{{ f.code }}</pre> }</span>
              </label>
            }
          </fieldset>
          <fieldset class="panel">
            <legend>The web server runs as</legend>
            <label class="opt" [class.on]="runAs === 'root'"><input type="radio" name="trav-run" [checked]="runAs === 'root'" (change)="runAs = 'root'; save()" />
              <span class="body"><span class="nm mono">root</span><span class="sub">Can read every file</span></span></label>
            <label class="opt" [class.on]="runAs === 'www-data'"><input type="radio" name="trav-run" [checked]="runAs === 'www-data'" (change)="runAs = 'www-data'; save()" />
              <span class="body"><span class="nm mono">www-data</span><span class="sub">Its own account, with only what it needs</span></span></label>
          </fieldset>
        </div>
      </div>

      @if (log.length > 1) {
        <div class="log-h"><span>Earlier tries</span><span class="spacer"></span><button type="button" class="btn ghost" (click)="reset()">Start over</button></div>
        <ol class="log compact">
          @for (a of earlier; track $index) {
            <li><button type="button" class="again mono" (click)="raw = a.raw; save()" title="Put this name back in the box">{{ a.raw }}</button>
              <span class="defs">{{ filterName(a.filter) }} · as {{ a.runAs }}</span></li>
          }
        </ol>
      }

      @if (done.length === missions.length) {
        <div class="result" role="status"><mat-icon aria-hidden="true">emoji_events</mat-icon>
          <span><strong>All seven.</strong> Filtering the text of a name loses to encodings and nesting. Resolve the real path and check where it lands, and run the server with least privilege so a mistake exposes less.</span>
        </div>
      }
    </section>
  `,
  styleUrl: './forgery.component.scss',
})
export class TraversalComponent implements OnInit {
  private work = inject(LessonWork, { optional: true });
  readonly missions = TRAV_MISSIONS;
  readonly filters = FILTERS;
  raw = 'report.pdf';
  filter: FilterId = 'none';
  runAs: RunAs = 'root';
  done: TravMission[] = [];
  log: Attempt[] = [];
  result?: TravResult;

  ngOnInit() {
    const s = this.work?.get<Saved>('traversal');
    if (!s) return;
    const fids = FILTERS.map(f => f.id);
    if (typeof s.raw === 'string') this.raw = s.raw;
    if (fids.includes(s.filter)) this.filter = s.filter;
    if (s.runAs === 'www-data') this.runAs = 'www-data';
    this.done = (Array.isArray(s.done) ? s.done : []).filter(id => TRAV_MISSIONS.some(m => m.id === id));
    this.log = (Array.isArray(s.log) ? s.log : []).filter(a => typeof a?.raw === 'string' && fids.includes(a.filter)).slice(-10);
    const last = this.log[this.log.length - 1];
    if (last) this.result = download(last.raw, last.filter, last.runAs === 'www-data' ? 'www-data' : 'root');
  }

  get earlier() { return this.log.slice(0, -1).reverse(); }
  filterName(id: FilterId) { return FILTERS.find(f => f.id === id)!.name; }

  fire() {
    const raw = this.raw.trim();
    this.result = download(raw, this.filter, this.runAs);
    if (!raw) return;
    const m = travMissions(raw, this.filter, this.runAs);
    this.done = TRAV_MISSIONS.map(x => x.id).filter(id => m.includes(id) || this.done.includes(id));
    this.log = [...this.log, { raw, filter: this.filter, runAs: this.runAs }].slice(-10);
    this.save();
  }

  reset() { this.raw = 'report.pdf'; this.filter = 'none'; this.runAs = 'root'; this.done = []; this.log = []; this.result = undefined; this.work?.clear('traversal'); }
  save() { this.work?.set('traversal', { raw: this.raw, filter: this.filter, runAs: this.runAs, done: this.done, log: this.log }); }
}
