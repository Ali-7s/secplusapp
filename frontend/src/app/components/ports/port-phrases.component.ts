import { Component, computed, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { GROUPS, PARTS, entryOf, shortName } from './ports-trainer';
import { KEY_PHRASES, NO_PORT } from './key-phrases';

interface Row { where: string; name: string; phrases: string[] }
interface PhraseSet { title: string; rows: Row[] }

/** "TCP 22", or for a port whose numbers differ: "UDP 137/138 · TCP 139". */
export function whereOf(port: string): string {
  const parts = PARTS[port];
  const e = entryOf(port);
  if (!parts) return `${e.transport.replace('UDP/TCP', 'TCP/UDP')} ${port}`;
  const runs: { t: string; ns: number[] }[] = [];
  for (const p of [...parts].sort((a, b) => a.n - b.n)) {
    const t = p.transport.replace('UDP/TCP', 'TCP/UDP');
    if (runs.at(-1)?.t === t) runs.at(-1)!.ns.push(p.n);
    else runs.push({ t, ns: [p.n] });
  }
  return runs.map(r => `${r.t} ${r.ns.join('/')}`).join(' · ');
}

/** The Ports trainer's cheat sheet: the words in a question that point to each port, set by set, with a search. */
@Component({
  selector: 'app-port-phrases',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './port-phrases.component.html',
  styleUrl: './port-phrases.component.scss',
})
export class PortPhrasesComponent {
  private readonly sets: PhraseSet[] = [
    ...GROUPS.map(g => ({ title: g.title, rows: g.ports.map(port => ({ where: whereOf(port), name: shortName(entryOf(port)), phrases: KEY_PHRASES[port] })) })),
    { title: 'No port', rows: NO_PORT },
  ];
  readonly find = signal('');
  readonly shown = computed(() => {
    const q = this.find().trim().toLowerCase();
    if (!q) return this.sets;
    const hit = (r: Row) => [r.where, r.name, ...r.phrases].some(x => x.toLowerCase().includes(q));
    return this.sets.map(s => ({ ...s, rows: s.rows.filter(hit) })).filter(s => s.rows.length);
  });

  hits(phrase: string): boolean {
    const q = this.find().trim().toLowerCase();
    return !!q && phrase.toLowerCase().includes(q);
  }
}
