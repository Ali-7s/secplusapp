import { Component, computed, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { FLOWS, factLabel, factOf, factPort, factProto, setOfFact } from './firewall-generator';
import { BOTH, NO_PORT } from './firewall-scenarios';
import { GROUPS } from './ports-trainer';
import { CUES, QUALIFIERS } from './key-phrases';

interface Row { says: string[]; name: string; where?: string }
interface CueSet { title: string; rows: Row[] }

/** Every firewall rule once, in the order the tables list them. */
export const CUE_FACTS: string[] = [...new Set(FLOWS.map(f => factOf(f.id)))];

/** "TCP 110", "TCP/UDP 88", or for a protocol with no port: "IP protocol 50". */
export function answerOf(fact: string): { name: string; where: string } {
  const proto = factProto(fact);
  if (factPort(fact) === NO_PORT) {
    const ip = /IP protocol \d+/.exec(proto)?.[0];
    return { name: proto.replace(/ \(.*\)$/, ''), where: ip ?? 'no port' };
  }
  return { name: factLabel(fact), where: `${proto === BOTH ? 'TCP/UDP' : proto} ${factPort(fact)}` };
}

/** The Ports trainer's cheat sheet: what a vague firewall requirement says, and the port and protocol it means. */
@Component({
  selector: 'app-port-phrases',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './port-phrases.component.html',
  styleUrl: './port-phrases.component.scss',
})
export class PortPhrasesComponent {
  private readonly sets: CueSet[] = [
    { title: 'Words that change the answer', rows: QUALIFIERS.map(q => ({ says: q.says, name: q.means })) },
    ...GROUPS.map(g => ({
      title: g.title,
      rows: CUE_FACTS.filter(fact => setOfFact(fact) === g.id).map(fact => ({ says: CUES[fact] ?? [], ...answerOf(fact) })),
    })),
  ];
  readonly find = signal('');
  readonly shown = computed(() => {
    const q = this.find().trim().toLowerCase();
    if (!q) return this.sets;
    const hit = (r: Row) => [r.name, r.where ?? '', ...r.says].some(x => x.toLowerCase().includes(q));
    return this.sets.map(s => ({ ...s, rows: s.rows.filter(hit) })).filter(s => s.rows.length);
  });

  hits(text: string): boolean {
    const q = this.find().trim().toLowerCase();
    return !!q && text.toLowerCase().includes(q);
  }
}
