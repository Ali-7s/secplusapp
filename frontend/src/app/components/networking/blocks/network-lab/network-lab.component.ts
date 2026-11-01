import { NgTemplateOutlet } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { LessonWork } from '../../lesson-work.service';
import {
  AddrMode, DEVICES, Detect, DeviceKind, FlowResult, Hop, LabFlow, LabHost, LabRule, LabScenario, LabSlot, LabWork, LabZone, PortRow,
  START_DETECT, SERVICES, addressedHosts, emptyWork, externalById, gradeAddr, gradePort, gradeSlot, hostById, hostZone, runFlow, zoneById,
} from './lab';
import { SCENARIOS } from './scenarios';

type Stage = 'place' | 'segment' | 'address' | 'rules' | 'detect' | 'run';

const STAGES: { id: Stage; name: string; icon: string }[] = [
  { id: 'place', name: 'Place', icon: 'touch_app' },
  { id: 'segment', name: 'Segment', icon: 'lan' },
  { id: 'address', name: 'Address', icon: 'pin' },
  { id: 'rules', name: 'Rules', icon: 'rule' },
  { id: 'detect', name: 'Detect', icon: 'radar' },
  { id: 'run', name: 'Run traffic', icon: 'play_circle' },
];

const EXPECT: Record<LabFlow['expect'], string> = { works: 'Must work', blocked: 'Must be stopped', detected: 'Must be stopped or alerted' };
const HOP_ICON: Record<Hop['result'], string> = { pass: 'arrow_downward', block: 'block', alert: 'notifications_active', fail: 'error', info: 'info' };
const DETECT_OPTS: { k: 'signatures' | 'anomaly' | 'reputation' | 'siem'; t: string; d: string }[] = [
  { k: 'signatures', t: 'Signature detection', d: 'Matches traffic against patterns of known attacks: exploits, scans, password guessing. Accurate, but blind to anything new. (SQL injection hides inside encrypted web requests: stopping it is the job of the WAF.)' },
  { k: 'anomaly', t: 'Anomaly detection', d: 'Learns what normal looks like and flags what is different, such as a brand-new exploit, a scan or malware calling home. Finds new attacks, with more false positives.' },
  { k: 'reputation', t: 'Reputation filtering', d: 'Blocks sites and addresses known to host malware or command-and-control servers. Used by the proxy.' },
  { k: 'siem', t: 'Send alerts to the SIEM', d: 'Forwards every alert to the SIEM, where analysts watch and correlate them. Otherwise alerts stay in each device\'s own log.' },
];
const PREFIXES = [8, 16, 20, 22, 23, 24, 25, 26, 27, 28, 29, 30];

interface Saved {
  sc: string;
  stage: Stage;
  works: Record<string, Partial<LabWork>>;
  checked: Record<string, Stage[]>;
  ran: Record<string, boolean>;
}

/** Everything wrong with the parts of a network that are graded directly, rather than by running traffic. */
function problems(sc: LabScenario, w: LabWork) {
  return {
    place: sc.slots.filter(s => !gradeSlot(s, w.slots[s.id]).ok).length,
    segment: sc.ports.filter(r => gradePort(sc, w, r).length).length,
    address: addressedHosts(sc).filter(h => gradeAddr(sc, w, h).length).length,
  };
}

/**
 * Build a network from a scenario's requirements: place the security devices, put each switch port in the right VLAN
 * with port security, address every device, write the firewall rules and set up detection, then run traffic through it
 * hop by hop. Everything works by tapping, so it suits a phone; work is saved per scenario.
 */
@Component({
  selector: 'app-network-lab',
  standalone: true,
  imports: [MatIconModule, NgTemplateOutlet],
  templateUrl: './network-lab.component.html',
  styleUrl: './network-lab.component.scss',
})
export class NetworkLabComponent implements OnInit {
  private store = inject(LessonWork, { optional: true });
  readonly scenarios = SCENARIOS;
  readonly stages = STAGES;
  readonly devices = DEVICES;
  readonly expectText = EXPECT;
  readonly hopIcon = HOP_ICON;
  readonly prefixes = PREFIXES;
  readonly detectOpts = DETECT_OPTS;
  readonly modes: { v: AddrMode; l: string }[] = [{ v: 'static', l: 'Static' }, { v: 'dhcp', l: 'DHCP' }, { v: 'reserved', l: 'DHCP reservation' }];

  active = 0;
  stage: Stage = 'place';
  works: Record<string, LabWork> = {};
  checked: Record<string, Stage[]> = {};
  ran: Record<string, boolean> = {};
  /** The device picked from the palette, waiting to be placed. */
  picked: DeviceKind | null = null;
  /** A flow whose hops are shown. */
  openFlow: string | null = null;
  showSolution = false;
  draft: LabRule = { from: 'internet', to: 'any', service: 'https', action: 'allow' };

  ngOnInit() {
    const saved = this.store?.get<Saved>('netlab');
    if (!saved) return;
    const i = SCENARIOS.findIndex(s => s.id === saved.sc);
    if (i >= 0) this.active = i;
    if (STAGES.some(s => s.id === saved.stage)) this.stage = saved.stage;
    for (const [id, w] of Object.entries(saved.works ?? {})) {
      this.works[id] = { ...emptyWork(), ...w, detect: { ...START_DETECT, ...w.detect } };
    }
    this.checked = saved.checked ?? {};
    this.ran = saved.ran ?? {};
  }

  get sc(): LabScenario { return SCENARIOS[this.active]; }
  get w(): LabWork { return this.works[this.sc.id] ??= emptyWork(); }
  workFor(sc: LabScenario): LabWork { return this.works[sc.id] ?? emptyWork(); }

  /** A network is built when every flow behaves and nothing graded directly is wrong. */
  built(sc: LabScenario): boolean {
    const w = this.workFor(sc);
    const p = problems(sc, w);
    return !!this.ran[sc.id] && !p.place && !p.segment && !p.address && sc.flows.every(f => runFlow(sc, w, f).ok);
  }
  get builtCount() { return SCENARIOS.filter(s => this.built(s)).length; }

  pickScenario(i: number) {
    this.active = i;
    this.picked = null;
    this.openFlow = null;
    this.showSolution = false;
    this.save();
  }
  goStage(s: Stage) {
    this.stage = s;
    this.picked = null;
    this.save();
  }
  isChecked(s: Stage) { return !!this.checked[this.sc.id]?.includes(s); }
  check(s: Stage) {
    this.checked[this.sc.id] = [...(this.checked[this.sc.id] ?? []).filter(x => x !== s), s];
    this.save();
  }
  /** A stage's tab gets a tick once it has been checked and is right. */
  stageDone(s: Stage): boolean {
    const p = problems(this.sc, this.w);
    if (s === 'place' || s === 'segment' || s === 'address') return this.isChecked(s) && !p[s];
    if (s === 'run') return this.built(this.sc);
    return false;
  }
  private edited(s: Stage) {
    this.checked[this.sc.id] = (this.checked[this.sc.id] ?? []).filter(x => x !== s);
    this.ran[this.sc.id] = false;
    this.save();
  }

  // ── Place ──
  slot(id: string): LabSlot { return this.sc.slots.find(s => s.id === id)!; }
  zone(id: string): LabZone { return zoneById(this.sc, id)!; }
  pick(kind: DeviceKind) { this.picked = this.picked === kind ? null : kind; }
  tapSlot(slot: LabSlot) {
    if (!this.picked) return;
    this.w.slots[slot.id] = this.picked;
    this.picked = null;
    this.edited('place');
  }
  clearSlot(slot: LabSlot) {
    delete this.w.slots[slot.id];
    this.edited('place');
  }
  slotGrade(slot: LabSlot) { return gradeSlot(slot, this.w.slots[slot.id]); }
  get placeWrong() { return problems(this.sc, this.w).place; }

  // ── Segment ──
  get vlanZones(): LabZone[] { return this.sc.zones.filter(z => !z.virtual); }
  get wireless(): LabHost[] { return this.sc.hosts.filter(h => h.via); }
  host(id: string): LabHost { return hostById(this.sc, id)!; }
  port(row: PortRow) { return this.w.ports[row.id] ?? {}; }
  setPort(row: PortRow, patch: LabWork['ports'][string]) {
    this.w.ports[row.id] = { ...this.port(row), ...patch };
    this.edited('segment');
  }
  vlanFrom(e: Event) { return Number((e.target as HTMLSelectElement).value); }
  portProblems(row: PortRow) { return gradePort(this.sc, this.w, row); }
  get segmentWrong() { return problems(this.sc, this.w).segment; }

  // ── Address ──
  get addrHosts(): LabHost[] { return addressedHosts(this.sc); }
  addr(h: LabHost) { return this.w.addr[h.id] ?? {}; }
  setAddr(h: LabHost, patch: LabWork['addr'][string]) {
    this.w.addr[h.id] = { ...this.addr(h), ...patch };
    this.edited('address');
  }
  text(e: Event) { return (e.target as HTMLInputElement).value.trim(); }
  zoneOf(h: LabHost) { return hostZone(this.sc, this.w, h); }
  addrProblems(h: LabHost) { return gradeAddr(this.sc, this.w, h); }
  pool(z: LabZone) { return z.pool ? `.${z.pool[0]} to .${z.pool[1]}` : 'None'; }
  get addressWrong() { return problems(this.sc, this.w).address; }

  // ── Rules ──
  get endpoints() {
    return {
      zones: this.sc.zones,
      hosts: this.sc.hosts.filter(h => !h.via),
      externals: this.sc.externals ?? [],
    };
  }
  label(id: string): string {
    if (id === 'any') return 'Any';
    if (id === 'internet') return 'Internet';
    return zoneById(this.sc, id)?.name ?? hostById(this.sc, id)?.name ?? externalById(this.sc, id)?.name ?? id;
  }
  isZone(id: string) { return !!zoneById(this.sc, id); }
  service(id: string) { return id === 'any' ? 'Any service' : SERVICES[id] ?? id; }
  setDraft(field: keyof LabRule, e: Event) {
    this.draft = { ...this.draft, [field]: (e.target as HTMLSelectElement).value };
  }
  addRule() {
    this.w.rules = [...this.w.rules, { ...this.draft }];
    this.edited('rules');
  }
  moveRule(i: number, by: number) {
    const rules = [...this.w.rules];
    const [r] = rules.splice(i, 1);
    rules.splice(i + by, 0, r);
    this.w.rules = rules;
    this.edited('rules');
  }
  removeRule(i: number) {
    this.w.rules = this.w.rules.filter((_, j) => j !== i);
    this.edited('rules');
  }
  /** Advice on a rule that works but is poor practice, or never takes effect. */
  ruleNote(r: LabRule, i: number): string | null {
    const earlier = this.w.rules.slice(0, i).findIndex(o =>
      (o.from === 'any' || o.from === r.from) && (o.to === 'any' || o.to === r.to) && (o.service === 'any' || o.service === r.service));
    if (earlier >= 0) return `Never used: rule ${earlier + 1} already matches all of this traffic, and the first match wins.`;
    if (r.action === 'allow' && r.from === 'any' && r.to === 'any') return 'Allows anything to anything, so the firewall might as well not be there.';
    if (r.action === 'allow' && r.service === 'any') return 'Allows every service. Least privilege means naming only the service that is needed.';
    if (r.from === r.to && this.isZone(r.from)) return 'Traffic inside one zone stays on the switch and never reaches the firewall.';
    if (r.action === 'deny' && !this.w.rules.slice(i + 1).some(o => o.action === 'allow')) return 'The implicit deny at the end already drops this, so the rule is not needed (though it can be useful for logging).';
    return null;
  }

  // ── Detect ──
  setDetect(patch: Partial<Detect>) {
    this.w.detect = { ...this.w.detect, ...patch };
    this.edited('detect');
  }
  toggleDetect(k: (typeof DETECT_OPTS)[number]['k']) { this.setDetect({ [k]: !this.w.detect[k] }); }
  placed(kind: DeviceKind) { return Object.values(this.w.slots).includes(kind); }

  // ── Run ──
  get results(): { flow: LabFlow; r: FlowResult }[] { return this.sc.flows.map(flow => ({ flow, r: runFlow(this.sc, this.w, flow) })); }
  get passing() { return this.results.filter(x => x.r.ok).length; }
  get ranNow() { return !!this.ran[this.sc.id]; }
  get leftovers() { return problems(this.sc, this.w); }
  run() {
    this.ran[this.sc.id] = true;
    this.openFlow = null;
    this.save();
  }
  toggleFlow(id: string) { this.openFlow = this.openFlow === id ? null : id; }
  endName(id: string): string {
    if (id === 'internet') return 'Internet';
    if (id === 'remote') return 'Remote worker';
    if (id.startsWith('port:')) return `Laptop in ${this.sc.ports.find(p => p.id === id.slice(5))?.label.toLowerCase()}`;
    if (id.startsWith('swap:')) return `Laptop in the ${this.host(id.slice(5)).name.toLowerCase()}'s port`;
    return this.label(id);
  }
  outcome(r: FlowResult): string {
    if (r.delivered) return r.alerted ? 'Delivered, with an alert' : 'Delivered';
    if (r.blocked) return r.alerted ? 'Stopped, with an alert' : 'Stopped';
    return 'Never got there';
  }
  flowService(f: LabFlow) { return f.service === 'scan' ? 'Port scan' : SERVICES[f.service]; }

  startOver() {
    this.works[this.sc.id] = emptyWork();
    this.checked[this.sc.id] = [];
    this.ran[this.sc.id] = false;
    this.picked = null;
    this.openFlow = null;
    this.showSolution = false;
    this.stage = 'place';
    this.save();
  }

  private save() {
    this.store?.set('netlab', { sc: this.sc.id, stage: this.stage, works: this.works, checked: this.checked, ran: this.ran } satisfies Saved);
  }
}
