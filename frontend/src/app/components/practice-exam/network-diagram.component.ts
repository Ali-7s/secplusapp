import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, inject, input, signal } from '@angular/core';
import { NetDiagram, NetHost } from '../../models/exam.model';
import { ICON_H, ICON_W, narrowLayout, wideLayout } from './network-diagram';

/** Below this width the diagram switches to one column, so its labels stay readable on a phone. */
const NARROW = 640;

/**
 * A firewall PBQ's network, drawn the way exam simulations show it (see network-diagram.ts for the layout),
 * followed by what each host does and any notes, as text.
 */
@Component({
  selector: 'app-network-diagram',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './network-diagram.component.html',
  styleUrl: './network-diagram.component.scss',
})
export class NetworkDiagramComponent {
  readonly diagram = input.required<NetDiagram>();

  readonly iconW = ICON_W;
  readonly iconH = ICON_H;
  private readonly width = signal(900);
  readonly narrow = computed(() => this.width() < NARROW);
  readonly layout = computed(() => (this.narrow() ? narrowLayout(this.diagram()) : wideLayout(this.diagram())));
  /** Every host to draw: the zones' and the outside parties under the cloud. */
  readonly hosts = computed(() => [...this.layout().zones.flatMap(z => z.hosts), ...this.layout().externals]);

  /** A one-sentence summary for screen readers; the list under the drawing has the details. */
  readonly summary = computed(() => {
    const d = this.diagram();
    const zones = d.zones.map(z => `${z.name}${z.subnet ? ` (${z.subnet})` : ''}`).join(', ');
    return `Network diagram: ${d.firewall} connects ${d.outside ? `the ${d.outside.label} to ` : ''}${zones}.`;
  });

  /** Hosts and zones that have something to say about them, for the list under the drawing. */
  readonly details = computed(() => {
    const d = this.diagram();
    const groups: { title: string; subnet?: string; role?: string; hosts: NetHost[] }[] = [];
    const outside = (d.outside?.hosts ?? []).filter(h => h.role || h.ip);
    if (outside.length) groups.push({ title: d.outside!.label, hosts: outside });
    for (const z of d.zones) {
      const hosts = z.hosts.filter(h => h.role);
      if (hosts.length || z.role) groups.push({ title: z.name, subnet: z.subnet, role: z.role, hosts });
    }
    return groups;
  });

  constructor() {
    const el = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;
    const observer = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width;
      if (w) this.width.set(w);
    });
    observer.observe(el);
    inject(DestroyRef).onDestroy(() => observer.disconnect());
  }
}
