import { analyse } from '../networking/blocks/cidr';
import { makeProblem, sameAnswer, solve } from './subnet-practice';
import { seededRandom } from '../../utils/exam-engine';

describe('subnet practice', () => {
  it('works out a /27 the way the steps describe', () => {
    const p = solve('192.168.7', 141, 27);
    expect(p.answers).toEqual({
      mask: '255.255.255.224', block: '32', network: '192.168.7.128', broadcast: '192.168.7.159',
      first: '192.168.7.129', last: '192.168.7.158', hosts: '30',
    });
    expect(p.steps.join(' ')).toContain('multiples of 32');
  });

  it('handles the edges of the range', () => {
    expect(solve('10.1.1', 200, 24).answers.network).toBe('10.1.1.0');
    expect(solve('10.1.1', 200, 24).answers.broadcast).toBe('10.1.1.255');
    expect(solve('10.1.1', 6, 30).answers).toEqual(jasmine.objectContaining({ network: '10.1.1.4', broadcast: '10.1.1.7', hosts: '2' }));
  });

  it('agrees with the lesson calculator on hundreds of random problems', () => {
    const rand = seededRandom(11);
    for (let i = 0; i < 300; i++) {
      const p = makeProblem(rand);
      const ref = analyse(`${p.address}/${p.prefix}`);
      expect(p.answers.mask).withContext(p.address).toBe(ref.mask!);
      expect(p.answers.network).withContext(p.address).toBe(ref.network!);
      expect(p.answers.broadcast).withContext(p.address).toBe(ref.broadcast!);
      expect(p.answers.first).withContext(p.address).toBe(ref.firstHost!);
      expect(p.answers.last).withContext(p.address).toBe(ref.lastHost!);
      expect(p.answers.hosts).withContext(p.address).toBe(ref.hosts!);
    }
  });

  it('accepts answers typed with spaces or a leading slash', () => {
    expect(sameAnswer(' 255.255.255.224 ', '255.255.255.224')).toBeTrue();
    expect(sameAnswer('/27', '27')).toBeTrue();
    expect(sameAnswer('', '0')).toBeFalse();
    expect(sameAnswer('192.168.7.129', '192.168.7.128')).toBeFalse();
  });
});
