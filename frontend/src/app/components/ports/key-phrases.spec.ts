import { PORTS } from '../reference/reference-data';
import { KEY_PHRASES, NO_PORT } from './key-phrases';
import { whereOf } from './port-phrases.component';

describe('Port cheat sheet', () => {
  it('has key phrases for every port, and each phrase points to one port only', () => {
    expect(Object.keys(KEY_PHRASES).sort()).toEqual(PORTS.map(p => p.port).sort());
    const all = [...Object.values(KEY_PHRASES), ...NO_PORT.map(n => n.phrases)].flat().map(p => p.toLowerCase());
    expect(all.filter((p, i) => all.indexOf(p) !== i)).withContext('used twice').toEqual([]);
    for (const [port, phrases] of Object.entries(KEY_PHRASES)) expect(phrases.length).withContext(port).toBeGreaterThan(0);
  });

  it('gives each number its own transport where they differ', () => {
    expect(whereOf('22')).toBe('TCP 22');
    expect(whereOf('53')).toBe('TCP/UDP 53');
    expect(whereOf('1194')).toBe('TCP/UDP 1194');
    expect(whereOf('67/68')).toBe('UDP 67/68');
    expect(whereOf('137-139')).toBe('UDP 137/138 · TCP 139');
    expect(whereOf('5060/5061')).toBe('TCP/UDP 5060 · TCP 5061');
  });
});
