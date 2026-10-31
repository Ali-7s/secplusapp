import { fileLines, logLine, message, terminalLines } from './exhibit-text';

describe('exhibit text', () => {
  const kinds = (line: string) => logLine(line).parts.map(p => (p.k ? `${p.k}:${p.t}` : p.t));

  it('finds the timestamp and field names in a log line', () => {
    expect(kinds('2026-10-12 02:14:07  cam-lobby-03  login  user=admin  result=success'))
      .toEqual(['time:2026-10-12 02:14:07', '  cam-lobby-03  login  ', 'key:user=', 'admin  ', 'key:result=', 'success']);
    expect(kinds('Sat 23:41  ConsoleLogin')[0]).toBe('time:Sat 23:41');
    expect(kinds('10:41:02.113 198.51.100.44.61522 > 10.1.1.20.21: Flags [FPU]')[0]).toBe('time:10:41:02.113');
    expect(kinds('01:40-02:11  4625  An account failed to log on')[0]).toBe('time:01:40-02:11');
  });

  it('leaves addresses, ports and late times alone', () => {
    expect(logLine('10:03:11 ALLOW TCP 10.8.1.23:49702 -> 10.8.1.1:445').parts.filter(p => p.k)).toEqual([{ t: '10:03:11', k: 'time' }]);
    expect(logLine('Policy engine says ALLOW and logs it at the end, around 22:00 or so').parts.filter(p => p.k)).toEqual([]);
  });

  it('marks lines about the log as asides', () => {
    expect(logLine('   ... 250 more from 10.8.1.23, one per address').aside).toBeTrue();
    expect(logLine('(no further entries for this session)').aside).toBeTrue();
    expect(logLine('  dst=ff:ff:ff:ff:ff:ff').aside).toBeFalse();
  });

  it('splits prompts from commands in a terminal', () => {
    expect(terminalLines('$ dig NS shop.example +short\nns1.example.')).toEqual([
      { prompt: '$ ', text: 'dig NS shop.example +short' }, { text: 'ns1.example.' },
    ]);
    expect(terminalLines('SW-LOBBY# show interfaces trunk')[0].prompt).toBe('SW-LOBBY# ');
    expect(terminalLines('PS> Resolve-DnsName hr.example.com')[0].prompt).toBe('PS> ');
  });

  it('marks comments in a file', () => {
    expect(fileLines('#AllowGroups\nMaxAuthTries 6\n ! no crypto map').map(l => l.comment)).toEqual([true, false, true]);
  });

  it('reads headers and body from a message', () => {
    const m = message('POST /transfer HTTP/1.1\nHost: bank.example\n\nto_account=1&amount=900');
    expect(m.headers).toEqual([{ name: '', value: 'POST /transfer HTTP/1.1' }, { name: 'Host', value: 'bank.example' }]);
    expect(m.body).toBe('to_account=1&amount=900');
    expect(message('From: a@b.example\n   spf=pass').headers[1]).toEqual({ name: '', value: 'spf=pass' });
  });
});
