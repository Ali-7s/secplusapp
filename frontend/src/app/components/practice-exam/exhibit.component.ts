import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ExhibitBlock, ExhibitText, NetDiagram, TopoIcon, Topology } from '../../models/exam.model';
import { NetworkDiagramComponent } from './network-diagram.component';
import { fileLines, logLine, message, terminalLines } from './exhibit-text';

/** The parts of a question that make up its exhibit. */
export interface ExhibitSource {
  exhibit?: string;
  diagram?: NetDiagram;
  topology?: Topology;
  blocks?: ExhibitBlock[];
}

const ICONS: Record<TopoIcon, string> = {
  cloud: 'cloud', firewall: 'local_fire_department', router: 'router', switch: 'lan', sensor: 'sensors',
  server: 'dns', pc: 'desktop_windows', laptop: 'laptop', wifi: 'wifi', threat: 'warning',
};

const TEXT_ICONS: Record<ExhibitText['style'], string> = {
  log: 'receipt_long', terminal: 'terminal', file: 'description', message: 'mail', document: 'article',
};

const TEXT_TITLES: Record<ExhibitText['style'], string> = {
  log: 'Log', terminal: 'Terminal', file: 'File', message: 'Message', document: 'Document',
};

/**
 * A question's exhibit, presented the way an exam simulation would: networks drawn, tables as tables, and text
 * shown as what it is, a log, a terminal, a file, a message or a document.
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
    } @else if (q.blocks?.length) {
      @for (b of q.blocks; track $index) {
        @if (b.kind === 'table') {
          <figure class="ex-table" [class.settings]="!b.columns">
            @if (b.title) { <figcaption>{{ b.title }}</figcaption> }
            <div class="scroll">
              <table>
                @if (b.columns) {
                  <thead><tr>@for (c of b.columns; track $index) { <th scope="col">{{ c }}</th> }</tr></thead>
                }
                <tbody>
                  @for (r of b.rows; track $index) {
                    @if (r.length === 1) {
                      <tr class="span"><td [attr.colspan]="b.columns?.length ?? 2">{{ r[0] }}</td></tr>
                    } @else {
                      <tr>
                        @for (cell of r; track $index) {
                          @if ($first && !b.columns) { <th scope="row">{{ cell }}</th> }
                          @else { <td [class.mono]="b.mono?.includes($index)" [class.first]="$first">{{ cell }}</td> }
                        }
                      </tr>
                    }
                  }
                </tbody>
              </table>
            </div>
            @if (b.note) { <p class="t-note">{{ b.note }}</p> }
          </figure>
        } @else {
          <figure class="window" [class]="'window ' + b.style">
            <figcaption>
              @if (b.style === 'terminal') { <span class="dots" aria-hidden="true"><i></i><i></i><i></i></span> }
              <mat-icon aria-hidden="true">{{ b.title?.startsWith('HTTP') ? 'http' : textIcons[b.style] }}</mat-icon>
              <span>{{ b.title ?? textTitles[b.style] }}</span>
            </figcaption>
            @switch (b.style) {
              @case ('log') {
                <ol class="lines">
                  @for (l of logLines(b.text); track $index) {
                    <li [class.aside]="l.aside"><span class="t">@for (p of l.parts; track $index) {@if (p.k) {<span [class]="p.k">{{ p.t }}</span>} @else {{{ p.t }}}}</span></li>
                  }
                </ol>
              }
              @case ('terminal') {
                <ol class="lines term">
                  @for (l of termLines(b.text); track $index) {
                    <li><span class="t">@if (l.prompt) {<span class="prompt">{{ l.prompt }}</span><span class="cmd">{{ l.text }}</span>} @else {{{ l.text }}}</span></li>
                  }
                </ol>
              }
              @case ('file') {
                <ol class="lines file">
                  @for (l of fileLines(b.text); track $index) { <li [class.comment]="l.comment"><span class="t">{{ l.text }}</span></li> }
                </ol>
              }
              @case ('message') {
                @let m = messageOf(b.text);
                <dl class="headers">
                  @for (h of m.headers; track $index) {
                    @if (h.name) { <dt>{{ h.name }}:</dt><dd>{{ h.value }}</dd> }
                    @else { <dd class="cont" [class.first-line]="$first">{{ h.value }}</dd> }
                  }
                </dl>
                @if (m.body) { <pre class="body">{{ m.body }}</pre> }
              }
              @default {
                <div class="doc">{{ b.text }}</div>
              }
            }
          </figure>
        }
      }
    } @else if (q.exhibit) {
      <figure class="window file">
        <figcaption><mat-icon aria-hidden="true">description</mat-icon> <span>Exhibit</span></figcaption>
        <pre class="body">{{ q.exhibit }}</pre>
      </figure>
    }
  `,
  styleUrl: './exhibit.component.scss',
})
export class ExhibitComponent {
  readonly source = input.required<ExhibitSource>();
  readonly icons = ICONS;
  readonly textIcons = TEXT_ICONS;
  readonly textTitles = TEXT_TITLES;

  readonly logLines = (text: string) => text.split('\n').map(logLine);
  readonly termLines = terminalLines;
  readonly fileLines = fileLines;
  readonly messageOf = message;

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
