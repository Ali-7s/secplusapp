import { Component, OnInit, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { LessonWork } from '../../lesson-work.service';
import { CAPTURES, CaptureQuestion, CaptureScenario, answersOf, checkAnswer, packetsOf } from './captures';
import { FILTER_FIELDS, Field, FilterError, Layer, Pkt, displayFilter, infoOf, layersOf, protocolOf } from './packets';

interface ScenarioWork {
  answers: Record<string, string>;
  done: string[];
  shown: string[];
  filter: string;
  sel: number | null;
}

interface Saved { scenario: string; by: Record<string, ScenarioWork> }

const KEY = 'capture';
const blank = (): ScenarioWork => ({ answers: {}, done: [], shown: [], filter: '', sel: null });

/** Read real-looking packet captures: filter them, open each packet layer by layer, and answer what happened. */
@Component({
  selector: 'app-capture-lab',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './capture-lab.component.html',
  styleUrl: './capture-lab.component.scss',
})
export class CaptureLabComponent implements OnInit {
  private work = inject(LessonWork, { optional: true });

  readonly captures = CAPTURES;
  readonly fieldNames = FILTER_FIELDS;
  scenario: CaptureScenario = CAPTURES[0];
  state: Saved = { scenario: CAPTURES[0].id, by: {} };

  draft = '';
  filterError = '';
  shown: Pkt[] = [];
  layers: Layer[] = [];
  openLayers = new Set<number>();
  field: Field | null = null;
  wrong: Record<string, boolean> = {};
  hints = new Set<string>();
  showHelp = false;

  readonly protocolOf = protocolOf;
  readonly infoOf = infoOf;

  ngOnInit() {
    const saved = this.work?.get<Saved>(KEY);
    if (saved?.by) this.state = { scenario: saved.scenario, by: { ...saved.by } };
    this.pick(CAPTURES.find(c => c.id === this.state.scenario) ?? CAPTURES[0], false);
  }

  get sw(): ScenarioWork {
    return (this.state.by[this.scenario.id] ??= blank());
  }

  get packets(): Pkt[] { return packetsOf(this.scenario); }

  get start(): number { return this.packets[0]?.t ?? 0; }

  get selected(): Pkt | undefined { return this.sw.sel == null ? undefined : this.packets[this.sw.sel - 1]; }

  doneCount(c: CaptureScenario) { return this.state.by[c.id]?.done.length ?? 0; }

  pick(c: CaptureScenario, save = true) {
    this.scenario = c;
    this.state.scenario = c.id;
    this.draft = this.sw.filter;
    this.field = null;
    this.wrong = {};
    this.apply(false);
    this.select(this.sw.sel, false);
    if (save) this.save();
  }

  apply(save = true) {
    try {
      const pred = displayFilter(this.draft);
      this.shown = this.packets.filter(pred);
      this.filterError = '';
      this.sw.filter = this.draft.trim();
    } catch (e) {
      this.filterError = e instanceof FilterError ? e.message : 'That filter could not be read.';
      return;
    }
    if (save) this.save();
  }

  setFilter(f: string) {
    this.draft = f;
    this.apply();
  }

  clearFilter() { this.setFilter(''); }

  select(no: number | null, save = true) {
    this.sw.sel = no;
    this.field = null;
    const p = this.selected;
    this.layers = p ? layersOf(p, this.scenario.gateway) : [];
    // Open the deepest layers by default: they hold what the packet is about.
    this.openLayers = new Set(this.layers.map((_, i) => i).filter(i => i >= Math.max(1, this.layers.length - 2)));
    if (save) this.save();
  }

  /** Arrow keys move through the shown packets, like a capture tool. */
  listKey(e: KeyboardEvent) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    if (!this.shown.length) return;
    const i = this.shown.findIndex(p => p.no === this.sw.sel);
    const next = e.key === 'ArrowDown' ? Math.min(this.shown.length - 1, i + 1) : Math.max(0, i < 0 ? 0 : i - 1);
    this.select(this.shown[next].no);
    queueMicrotask(() => document.getElementById(`pkt-${this.scenario.id}-${this.shown[next].no}`)?.scrollIntoView({ block: 'nearest' }));
  }

  toggleLayer(i: number) {
    if (this.openLayers.has(i)) this.openLayers.delete(i);
    else this.openLayers.add(i);
  }

  pickField(f: Field) { this.field = this.field === f ? null : f; }

  /** A filter for the chosen field's value, written as the filter language wants it. */
  fieldFilter(f: Field): string | null {
    if (!f.key || !FILTER_FIELDS.includes(f.key)) return null;
    let v = f.value.split(' (')[0].trim();
    if (f.key === 'dns.flags.response') v = f.value === 'Response' ? '1' : '0';
    else if (f.key === 'arp.opcode') v = f.value.startsWith('request') ? '1' : '2';
    else if (f.key.startsWith('tcp.flags')) return null;
    else if (f.key === 'dns.qry.name') v = f.value.split(' ')[0];
    else if (f.key === 'dns.a') v = f.value.split(',')[0].trim();
    else v = v.split(' ')[0];
    if (!v || v.startsWith('(')) return null;
    return `${f.key} == ${/^[A-Za-z0-9_.:\-\/]+$/.test(v) ? v : `"${v.replace(/"/g, '')}"`}`;
  }

  rel(p: Pkt) { return (p.t - this.start).toFixed(3); }

  src(p: Pkt) { return p.ip?.src ?? p.eth.src; }
  dst(p: Pkt) { return p.ip?.dst ?? (p.eth.dst === 'ff:ff:ff:ff:ff:ff' ? 'Broadcast' : p.eth.dst); }

  tone(p: Pkt): string {
    if (p.arp) return 'arp';
    if (p.tcp?.flags.rst) return 'rst';
    if (p.tcp?.flags.syn) return 'syn';
    const pr = protocolOf(p);
    if (pr === 'DNS' || pr === 'DHCP') return 'udp';
    if (pr.startsWith('TLS') || pr === 'SSH') return 'tls';
    if (pr === 'HTTP' || pr === 'FTP' || pr === 'TELNET') return 'clear';
    if (p.icmp) return 'icmp';
    return '';
  }

  // ── Questions ───────────────────────────────────────────────────────────

  answer(q: CaptureQuestion) { return this.sw.answers[q.id] ?? ''; }

  setAnswer(q: CaptureQuestion, v: string) {
    this.sw.answers = { ...this.sw.answers, [q.id]: v };
    delete this.wrong[q.id];
    this.save();
  }

  useSelected(q: CaptureQuestion) {
    if (this.sw.sel != null) this.setAnswer(q, String(this.sw.sel));
  }

  check(q: CaptureQuestion) {
    if (checkAnswer(this.scenario, q, this.answer(q))) {
      if (!this.sw.done.includes(q.id)) this.sw.done = [...this.sw.done, q.id];
      delete this.wrong[q.id];
      this.save();
    } else {
      this.wrong[q.id] = true;
    }
  }

  reveal(q: CaptureQuestion) {
    if (!this.sw.shown.includes(q.id)) this.sw.shown = [...this.sw.shown, q.id];
    delete this.wrong[q.id];
    this.save();
  }

  isDone(q: CaptureQuestion) { return this.sw.done.includes(q.id); }
  isShown(q: CaptureQuestion) { return this.sw.shown.includes(q.id); }
  solution(q: CaptureQuestion) { return q.kind === 'set' ? answersOf(this.scenario, q)[0] : answersOf(this.scenario, q)[0]; }

  toggleHint(q: CaptureQuestion) {
    const k = this.scenario.id + q.id;
    if (this.hints.has(k)) this.hints.delete(k);
    else this.hints.add(k);
  }
  hintOpen(q: CaptureQuestion) { return this.hints.has(this.scenario.id + q.id); }

  goTo(q: CaptureQuestion) {
    const n = Number(answersOf(this.scenario, q)[0]);
    if (!n) return;
    if (!this.shown.some(p => p.no === n)) this.clearFilter();
    this.select(n);
    queueMicrotask(() => document.getElementById(`pkt-${this.scenario.id}-${n}`)?.scrollIntoView({ block: 'nearest' }));
  }

  restart() {
    this.state.by[this.scenario.id] = blank();
    this.draft = '';
    this.wrong = {};
    this.apply(false);
    this.select(null, false);
    this.save();
  }

  private save() {
    this.work?.set(KEY, JSON.parse(JSON.stringify(this.state)));
  }
}
