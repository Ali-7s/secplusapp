import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Ev, hms } from './engine/events';
import { Row, SiemError, SiemRange, SiemResult, fieldSummary, rowOf, runSiem } from './engine/siem';
import { World } from './engine/world';

export const RANGES: { id: string; label: string; secs: number }[] = [
  { id: '15m', label: 'Last 15 minutes', secs: 15 * 60 },
  { id: '60m', label: 'Last 60 minutes', secs: 60 * 60 },
  { id: 'all', label: 'Whole shift', secs: Infinity },
];

const EXAMPLES: [string, string][] = [
  ['source=auth action=failed', 'Filter: field=value pairs, all must match'],
  ['source=fw dst=192.0.2.* NOT dpt=443', 'Wildcards with *, NOT to exclude, OR between terms'],
  ['"Failed password" root', 'Free text in the raw event (quotes keep a phrase together)'],
  ['source=auth action=failed | stats count by src | sort -count', 'Count per value, biggest first'],
  ['source=auth | stats dc(user) as users, count by src', 'Distinct count, several numbers at once'],
  ['source=fw | top limit=5 dst', 'The most common values with percentages'],
  ['source=fw src=10.0.4.114 | timechart span=1m count', 'Events over time as a chart'],
  ['source=dns | eval qlen=len(query) | where qlen > 40 | table _time client query qlen', 'Calculate a field, filter on it, show columns'],
  ['source=fw | stats sum(bytes) as total by src | sort -total | head 5', 'Add up a number per value'],
  ['source=win EventID=4625 | dedup user | table _time user src', 'One row per user'],
];

/** The SIEM: a search bar over every event the shift has produced so far, with event, table and chart views. */
@Component({
  selector: 'app-soc-siem',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './siem.component.html',
  styleUrl: './siem.component.scss',
})
export class SocSiemComponent implements OnInit, OnChanges {
  @Input({ required: true }) world!: World;
  @Input() now = 0;
  @Input() saved?: { query: string; range: string };
  @Output() searched = new EventEmitter<{ query: string; result: SiemResult; range: SiemRange }>();
  @Output() changed = new EventEmitter<{ query: string; range: string }>();

  readonly ranges = RANGES;
  readonly examples = EXAMPLES;
  query = '';
  range = 'all';
  live = false;
  help = false;
  result: SiemResult | null = null;
  error = '';
  ran = '';
  shown = 50;
  open = new Set<Ev>();
  fields: ReturnType<typeof fieldSummary> = [];
  fieldOpen: string | null = null;
  chartAsTable = false;
  /** The field list starts open where there is room for it beside the events. */
  readonly wideFields = typeof matchMedia !== 'undefined' && matchMedia('(min-width: 1100px)').matches;
  private lastLive = 0;

  ngOnInit() {
    this.query = this.saved?.query ?? '';
    this.range = this.saved?.range ?? 'all';
    if (this.query.trim()) this.run(false);
  }

  ngOnChanges(ch: SimpleChanges) {
    if (ch['now'] && !ch['now'].firstChange && this.live && this.ran && Date.now() - this.lastLive > 1500) {
      this.lastLive = Date.now();
      this.run(false, true);
    }
  }

  get rangeNow(): SiemRange {
    const r = RANGES.find(x => x.id === this.range) ?? RANGES[2];
    return { from: Math.max(this.world.shift.start, this.now - r.secs), to: this.now };
  }

  /** Puts a search in the bar and runs it (from an alert's Investigate button). */
  setQuery(q: string) {
    this.query = q;
    this.range = 'all';
    this.run();
  }

  setRange(id: string) {
    this.range = id;
    this.changed.emit({ query: this.query, range: this.range });
    if (this.ran) this.run();
  }

  run(report = true, keepView = false) {
    const range = this.rangeNow;
    try {
      this.result = runSiem(this.query, this.world.events, range);
      this.error = '';
    } catch (e) {
      if (!(e instanceof SiemError)) throw e;
      this.error = e.message;
      this.result = null;
    }
    this.ran = this.query;
    if (!keepView) { this.shown = 50; this.open.clear(); this.fieldOpen = null; }
    this.fields = this.result?.kind === 'events' ? fieldSummary(this.result.rows.slice(0, 5000)) : [];
    this.changed.emit({ query: this.query, range: this.range });
    if (report && this.result) this.searched.emit({ query: this.query, result: this.result, range });
  }

  /** Adds field=value (or NOT field=value) to the search and runs it. */
  addFilter(field: string, value: string, exclude = false) {
    const v = /[\s"|]/.test(value) ? `"${value.replace(/"/g, '')}"` : value;
    const term = `${exclude ? 'NOT ' : ''}${field}=${v}`;
    const [first, ...rest] = this.query.split('|');
    this.query = [`${first.trim()} ${term}`.trim(), ...rest.map(s => s.trim())].join(' | ');
    this.run();
  }

  useExample(q: string) {
    this.query = q;
    this.help = false;
    this.run();
  }

  toggle(e: Ev) {
    if (this.open.has(e)) this.open.delete(e);
    else this.open.add(e);
  }

  fieldsOf(e: Ev): [string, string][] {
    return Object.entries(rowOf(e)).filter(([k]) => k !== '_raw');
  }

  get events(): Ev[] {
    return this.result?.kind === 'events' ? this.result.events.slice(0, this.shown) : [];
  }

  extraOf(i: number): [string, string][] {
    if (this.result?.kind !== 'events') return [];
    const row: Row = this.result.rows[i];
    return this.result.extra.map(f => [f, row?.[f] ?? '']);
  }

  get countLabel(): string {
    if (!this.result) return '';
    if (this.result.kind === 'events') return `${this.result.events.length.toLocaleString('en-US')} event${this.result.events.length === 1 ? '' : 's'}`;
    return `${this.result.rows.length.toLocaleString('en-US')} row${this.result.rows.length === 1 ? '' : 's'}`;
  }

  get chartMax(): number {
    return this.result?.kind === 'chart' ? Math.max(1, ...this.result.buckets.map(b => b.n)) : 1;
  }

  chartLabel(i: number, n: number): string | null {
    if (this.result?.kind !== 'chart') return null;
    const step = Math.max(1, Math.ceil(n / 8));
    return i % step === 0 ? hms(this.result.buckets[i].t).slice(0, 5) : null;
  }

  isNum(v: string | undefined) { return !!v && /^-?\d+(\.\d+)?$/.test(v); }
  fmt(v: string | undefined) { return v && /^-?\d{4,}$/.test(v) ? Number(v).toLocaleString('en-US') : v ?? ''; }
  readonly hms = hms;
}
