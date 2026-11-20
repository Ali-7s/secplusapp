import { expectedMs, speedRating } from './answer-speed';

describe('Answer speed', () => {
  const tcp = 'SSH on port 22: TCP, UDP or both?';
  const situation = 'A help desk technician needs to log in to a branch office router to change its settings, and the session must be encrypted end to end. Which port?';

  it('rates a quick answer Easy, a steady one Good and a slow one Hard', () => {
    const base = expectedMs(tcp, 'TCP', true);
    expect(speedRating(base + 1000, tcp, 'TCP', true)).toBe('easy');
    expect(speedRating(base + 5000, tcp, 'TCP', true)).toBe('good');
    expect(speedRating(base + 12000, tcp, 'TCP', true)).toBe('hard');
  });

  it('allows for reading a long question and typing the answer', () => {
    expect(expectedMs(situation, '22', false)).toBeGreaterThan(expectedMs(tcp, 'TCP', true) + 5000);
    expect(expectedMs('Port 143: which protocol?', 'IMAP', false)).toBeGreaterThan(expectedMs('Port 143: which protocol?', 'IMAP', true));
    expect(speedRating(10_000, situation, '22', false)).withContext('ten seconds is quick for a long situation').toBe('easy');
    expect(speedRating(10_000, tcp, 'TCP', true)).withContext('but not for a tap').toBe('good');
  });

  it('counts an answer after a long time away as Good, since it says nothing about recall', () => {
    expect(speedRating(5 * 60_000, tcp, 'TCP', true)).toBe('good');
    expect(speedRating(undefined, tcp, 'TCP', true)).toBe('good');
  });
});
