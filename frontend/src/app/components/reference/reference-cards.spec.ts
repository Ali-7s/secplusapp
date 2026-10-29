import { DEFAULT_NEW_PER_DAY } from '../../utils/progress';
import { REFERENCE_DECK_SECTIONS, referenceCards } from './reference-cards';
import { PORTS } from './reference-data';

describe('Reference deck', () => {
  const cards = referenceCards();

  it('gives every card a unique id and a question with an answer', () => {
    expect(new Set(cards.map(c => c.id)).size).toBe(cards.length);
    for (const c of cards) {
      expect(c.name.trim()).withContext(c.id).not.toBe('');
      expect(c.prompt?.trim()).withContext(c.id).toBeTruthy();
      expect(c.expansion?.trim()).withContext(c.id).toBeTruthy();
      expect(c.definition.trim()).withContext(c.id).not.toBe('');
    }
  });

  it('asks every port both ways, without the answer on the front', () => {
    for (const p of PORTS) {
      const toProtocol = cards.find(c => c.id === `port:${p.port}`);
      const toPort = cards.find(c => c.id === `proto:${p.protocol}`);
      expect(toProtocol?.expansion).withContext(p.port).toContain(p.protocol);
      expect(toProtocol?.name).withContext(p.port).not.toContain(p.protocol);
      expect(toPort?.expansion).withContext(p.protocol).toContain(p.port);
      expect(toPort?.name).withContext(p.protocol).not.toContain(p.port);
    }
  });

  it('covers every listed section and nothing else', () => {
    const labels = REFERENCE_DECK_SECTIONS.map(s => s.label);
    for (const label of labels) expect(cards.some(c => c.category === label)).withContext(label).toBeTrue();
    for (const c of cards) expect(labels).withContext(c.id).toContain(c.category);
  });

  it('mixes the sections and keeps the two cards for one port on different days', () => {
    expect(new Set(cards.slice(0, DEFAULT_NEW_PER_DAY).map(c => c.category)).size).toBeGreaterThan(5);
    for (const p of PORTS) {
      const gap = Math.abs(cards.findIndex(c => c.id === `port:${p.port}`) - cards.findIndex(c => c.id === `proto:${p.protocol}`));
      expect(gap).withContext(p.port).toBeGreaterThanOrEqual(DEFAULT_NEW_PER_DAY);
    }
  });
});
