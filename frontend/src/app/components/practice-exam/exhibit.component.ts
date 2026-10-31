import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ExhibitTable, NetDiagram, TopoIcon, Topology } from '../../models/exam.model';
import { NetworkDiagramComponent } from './network-diagram.component';

/** The parts of a question that make up its exhibit. */
export interface ExhibitSource {
  exhibit?: string;
  diagram?: NetDiagram;
  topology?: Topology;
  tables?: ExhibitTable[];
}

const ICONS: Record<TopoIcon, string> = {
  cloud: 'cloud', firewall: 'local_fire_department', router: 'router', switch: 'lan', sensor: 'sensors',
  server: 'dns', pc: 'desktop_windows', laptop: 'laptop', wifi: 'wifi', threat: 'warning',
};

/** Command output starts with a prompt; anything else (logs, config files, emails) is shown as a document. */
const PROMPT = /^(\$ |PS> |C:\\>|[\w-]+[#>] )/m;

/**
 * A question's exhibit, presented the way an exam simulation would: networks drawn, tables as tables, and only
 * genuine text (logs, config files, command output) kept as text, in a window.
 */
@Component({
  selector: 'app-exhibit',
  standalone: true,
  imports: [MatIconModule, NetworkDiagramComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let q = source();
    @if (q.diagram) {
      <app-network-diagram [diagram]="q.diagram" />
    } @else if (q.topology) {
      @let t = q.topology;
      <figure class="topo" role="img" [attr.aria-label]="topoSummary()">
        <ol class="chain" [style.--n]="t.chain.length">
          @for (n of t.chain; track $index) {
            <li class="node" [class.has-branches]="n.branches?.length">
              <div class="head">
                <span class="ico" [class]="'ico ' + n.icon"><mat-icon aria-hidden="true">{{ icons[n.icon] }}</mat-icon></span>
                <span class="name">{{ n.name }}</span>
                @if (n.note) { <span class="note">{{ n.note }}</span> }
              </div>
              @if (n.branches?.length) {
                <div class="branches">
                  @for (b of n.branches; track $index) {
                    <div class="branch" [class]="'branch t' + ($index % 4)">
                      <div class="b-name">{{ b.name }}</div>
                      @if (b.subnet) { <code class="b-subnet">{{ b.subnet }}</code> }
                      @if (b.note) { <div class="b-note">{{ b.note }}</div> }
                      @if (b.hosts?.length) {
                        <ul class="hosts">
                          @for (h of b.hosts; track h.name) {
                            <li>
                              <mat-icon aria-hidden="true">{{ icons[h.icon ?? 'server'] }}</mat-icon>
                              <span>{{ h.name }}</span>
                              @if (h.ip) { <code>{{ h.ip }}</code> }
                            </li>
                          }
                        </ul>
                      }
                    </div>
                  }
                </div>
              }
            </li>
          }
        </ol>
      </figure>
    } @else if (q.tables?.length) {
      @for (t of q.tables; track $index) {
        <figure class="ex-table">
          @if (t.title) { <figcaption>{{ t.title }}</figcaption> }
          <div class="scroll">
            <table>
              <thead><tr>@for (c of t.columns; track $index) { <th scope="col">{{ c }}</th> }</tr></thead>
              <tbody>
                @for (r of t.rows; track $index) {
                  <tr>@for (cell of r; track $index) { <td [class.mono]="t.mono?.includes($index)" [class.first]="$first">{{ cell }}</td> }</tr>
                }
              </tbody>
            </table>
          </div>
          @if (t.note) { <p class="t-note">{{ t.note }}</p> }
        </figure>
      }
    } @else if (q.exhibit) {
      <figure class="window">
        <figcaption>
          <mat-icon aria-hidden="true">{{ terminal() ? 'terminal' : 'description' }}</mat-icon>
          {{ terminal() ? 'Terminal' : 'Exhibit' }}
        </figcaption>
        <pre>{{ q.exhibit }}</pre>
      </figure>
    }
  `,
  styleUrl: './exhibit.component.scss',
})
export class ExhibitComponent {
  readonly source = input.required<ExhibitSource>();
  readonly icons = ICONS;

  readonly terminal = computed(() => PROMPT.test(this.source().exhibit ?? ''));

  /** The drawing in one sentence, for screen readers. */
  readonly topoSummary = computed(() => {
    const t = this.source().topology;
    if (!t) return '';
    const parts = t.chain.map(n => {
      const branches = (n.branches ?? []).map(b => [b.name, b.subnet, ...(b.hosts ?? []).map(h => `${h.name}${h.ip ? ' ' + h.ip : ''}`)].filter(Boolean).join(', '));
      return branches.length ? `${n.name} (connecting ${branches.join('; ')})` : n.name;
    });
    return `Network diagram: ${parts.join(', then ')}.`;
  });
}
