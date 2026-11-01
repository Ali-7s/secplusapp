import { Component, ElementRef, EventEmitter, Input, Output, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Canvas, CanvasNode, DEVICES, DeviceKind, LabHost, LabScenario, NodeKind, hostById, isTap, neighbours, nodeLabel, zoneById } from './lab';

const W = 124;
const H = 52;
const WIDTH = 720;

/**
 * A blank diagram to build a network on: add devices and switches, place the scenario's systems, move them by dragging
 * or by tapping a spot, and cable any two together. Works by tapping alone, so it suits a phone.
 */
@Component({
  selector: 'app-lab-canvas',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './lab-canvas.component.html',
  styleUrl: './lab-canvas.component.scss',
})
export class LabCanvasComponent {
  @Input({ required: true }) sc!: LabScenario;
  @Input({ required: true }) canvas!: Canvas;
  /** Shown for looking at only, such as a worked example. */
  @Input() readonly = false;
  @Output() changed = new EventEmitter<void>();
  private host = inject(ElementRef<HTMLElement>);

  readonly w = W;
  readonly h = H;
  readonly width = WIDTH;
  readonly devices = DEVICES;
  selected: string | null = null;
  /** Cable mode: tapping another box cables it to the selected one (or unplugs it). */
  cabling = false;
  private drag: { id: string; px: number; py: number; x: number; y: number; moved: boolean } | null = null;
  /** The box just dragged: the click that ends a drag is not a tap. */
  private dropped: string | null = null;

  get height() { return Math.max(400, ...this.canvas.nodes.map(n => n.y + H + 24)); }
  get kinds(): NodeKind[] { return ['switch', ...this.sc.palette]; }
  get unplaced(): LabHost[] { return this.sc.hosts.filter(h => !h.via && !this.node(h.id)); }
  get sel(): CanvasNode | undefined { return this.selected ? this.node(this.selected) : undefined; }

  node(id: string) { return this.canvas.nodes.find(n => n.id === id); }
  label(id: string) { return nodeLabel(this.sc, this.canvas, id); }
  kindName(k: NodeKind) { return k === 'switch' ? 'Switch' : DEVICES[k as DeviceKind].name; }
  kindIcon(k: NodeKind) { return k === 'switch' ? 'lan' : DEVICES[k as DeviceKind].icon; }
  icon(n: CanvasNode): string {
    if (n.kind === 'internet') return 'cloud';
    if (n.kind === 'host') return hostById(this.sc, n.id)?.icon ?? 'computer';
    return this.kindIcon(n.kind);
  }
  /** Systems are tinted by the zone they belong in; devices stay plain. */
  tone(n: CanvasNode): number | null {
    if (n.kind !== 'host') return null;
    const h = hostById(this.sc, n.id);
    return h ? zoneById(this.sc, h.zone)?.tone ?? null : null;
  }
  about(n: CanvasNode): string {
    if (n.kind === 'internet') return 'Everything outside: customers, attackers, and any outside service.';
    if (n.kind === 'switch') return 'Connects the devices cabled to it. Ports are put in VLANs in the next stage; an IDS cabled only to a switch sits on its mirror port.';
    if (n.kind === 'host') {
      const h = hostById(this.sc, n.id)!;
      const z = zoneById(this.sc, h.zone)!;
      const wifi = this.sc.hosts.filter(o => o.via === h.id).map(o => o.name);
      return `Belongs in ${z.name}: ${z.note.charAt(0).toLowerCase()}${z.note.slice(1)}.${wifi.length ? ` ${wifi.join(', ')} ${wifi.length > 1 ? 'join' : 'joins'} over its Wi-Fi.` : ''}`;
    }
    const d = DEVICES[n.kind as DeviceKind];
    return `${d.does}.${isTap(this.canvas, n) ? ' Cabled only to a switch, it sits on the mirror port and gets a copy of the traffic.' : ''}`;
  }
  linked(a: string, b: string) { return this.canvas.links.some(l => (l.a === a && l.b === b) || (l.a === b && l.b === a)); }
  cables(id: string) { return neighbours(this.canvas, id); }
  /** Boxes the selected one is not cabled to yet. */
  get others(): CanvasNode[] {
    const s = this.selected;
    return s ? this.canvas.nodes.filter(n => n.id !== s && !this.linked(s, n.id)) : [];
  }
  get lines() {
    return this.canvas.links.flatMap(l => {
      const a = this.node(l.a);
      const b = this.node(l.b);
      if (!a || !b) return [];
      const mirror = isTap(this.canvas, a) || isTap(this.canvas, b);
      return [{ key: `${l.a}|${l.b}`, x1: a.x + W / 2, y1: a.y + H / 2, x2: b.x + W / 2, y2: b.y + H / 2, mirror, on: l.a === this.selected || l.b === this.selected }];
    });
  }

  // ── Adding and removing ──
  private free(): { x: number; y: number } {
    for (let row = 1; ; row++) { // below the internet, which starts at the top
      for (let col = 0; col < 5; col++) {
        const x = 16 + col * 140;
        const y = 16 + row * 76;
        if (!this.canvas.nodes.some(n => Math.abs(n.x - x) < W + 8 && Math.abs(n.y - y) < H + 8)) return { x, y };
      }
    }
  }
  add(kind: NodeKind) {
    const used = this.canvas.nodes.filter(n => n.kind === kind).map(n => Number(n.id.split('-').pop()) || 0);
    const id = `${kind}-${Math.max(0, ...used) + 1}`;
    this.canvas.nodes = [...this.canvas.nodes, { id, kind, ...this.free() }];
    this.selected = id;
    this.changed.emit();
    this.reveal(id);
  }
  /** On a narrow screen the board scrolls, so bring a new box into view. */
  private reveal(id: string) {
    setTimeout(() => this.host.nativeElement.querySelector(`[data-id="${id}"]`)?.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'smooth' }));
  }
  place(h: LabHost) {
    if (this.node(h.id)) return;
    this.canvas.nodes = [...this.canvas.nodes, { id: h.id, kind: 'host', ...this.free() }];
    this.selected = h.id;
    this.changed.emit();
    this.reveal(h.id);
  }
  remove(id: string) {
    this.canvas.nodes = this.canvas.nodes.filter(n => n.id !== id);
    this.canvas.links = this.canvas.links.filter(l => l.a !== id && l.b !== id);
    this.selected = null;
    this.changed.emit();
  }
  toggleLink(a: string, b: string) {
    if (a === b) return;
    this.canvas.links = this.linked(a, b)
      ? this.canvas.links.filter(l => !((l.a === a && l.b === b) || (l.a === b && l.b === a)))
      : [...this.canvas.links, { a, b }];
    this.changed.emit();
  }
  connectFrom(e: Event) {
    const sel = e.target as HTMLSelectElement;
    if (this.selected && sel.value) this.toggleLink(this.selected, sel.value);
    sel.value = '';
  }

  // ── Selecting, cabling and moving ──
  tapNode(id: string) {
    if (this.readonly) return;
    if (this.dropped === id) { this.dropped = null; return; }
    // In cable mode the selected box stays selected, so one switch can be cabled to several boxes in a row.
    if (this.cabling && this.selected && this.selected !== id) this.toggleLink(this.selected, id);
    else this.selected = this.selected === id ? null : id;
  }
  /** Tapping an empty spot moves the selected box there. */
  tapSpace(e: MouseEvent) {
    if (this.readonly || e.target !== e.currentTarget) return;
    const n = this.sel;
    if (!n || this.cabling) { this.selected = null; return; }
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    this.moveTo(n, e.clientX - r.left - W / 2, e.clientY - r.top - H / 2);
    this.changed.emit();
  }
  private moveTo(n: CanvasNode, x: number, y: number) {
    n.x = Math.round(Math.min(Math.max(0, x), WIDTH - W));
    n.y = Math.round(Math.max(0, y));
  }
  down(n: CanvasNode, e: PointerEvent) {
    if (this.readonly || e.button !== 0) return;
    this.dropped = null;
    this.drag = { id: n.id, px: e.clientX, py: e.clientY, x: n.x, y: n.y, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  move(n: CanvasNode, e: PointerEvent) {
    const d = this.drag;
    if (!d || d.id !== n.id) return;
    const dx = e.clientX - d.px;
    const dy = e.clientY - d.py;
    if (!d.moved && Math.hypot(dx, dy) < 6) return;
    d.moved = true;
    this.moveTo(n, d.x + dx, d.y + dy);
  }
  up() {
    if (this.drag?.moved) {
      this.dropped = this.drag.id;
      if (!this.cabling) this.selected = this.drag.id;
      this.changed.emit();
    }
    this.drag = null;
  }
  key(n: CanvasNode, e: KeyboardEvent) {
    if (this.readonly) return;
    const step = e.shiftKey ? 40 : 8;
    const by: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (by[e.key]) {
      e.preventDefault();
      this.moveTo(n, n.x + by[e.key][0], n.y + by[e.key][1]);
      this.changed.emit();
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && n.kind !== 'internet') {
      e.preventDefault();
      this.remove(n.id);
    }
  }
}
