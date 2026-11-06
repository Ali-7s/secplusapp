import { awk } from './awk';
import { checkScript, checkSiem, checkTerminal, emptyTicket, markTicket } from './grade';
import { Alert, Shift } from './model';
import { runSiem } from './siem';
import { SHIFTS, shiftById } from './shifts';
import { World, buildEvents, buildWorld, shellFor } from './world';

const worldAt = (shift: Shift, now = shift.end) => buildWorld(shift, { now });
const sh = (w: World, src: string) => shellFor(w).run(src);
const out = (w: World, src: string) => sh(w, src).out;
const range = (s: Shift) => ({ from: s.start, to: s.end });

describe('SOC lab shell', () => {
  const w = worldAt(SHIFTS[0]);

  it('runs pipes, variables, loops, arithmetic and functions', () => {
    expect(out(w, 'echo a b c | tr " " "\\n" | sort -r | head -2')).toBe('c\nb\n');
    expect(out(w, 'x=5; echo $((x * 2 + 1))')).toBe('11\n');
    expect(out(w, 'for i in 1 2 3; do echo "n$i"; done')).toBe('n1\nn2\nn3\n');
    expect(out(w, 'for ((i=0; i<3; i++)); do printf "%d," $i; done; echo')).toBe('0,1,2,\n');
    expect(out(w, 'f() { echo "hi $1"; }; f there')).toBe('hi there\n');
    expect(out(w, 'if [ 3 -gt 2 ]; then echo yes; else echo no; fi')).toBe('yes\n');
    expect(out(w, 'case web01 in web*) echo web;; *) echo other;; esac')).toBe('web\n');
    expect(out(w, 'n=0; while true; do n=$((n+1)); [ $n -ge 3 ] && break; done; echo $n')).toBe('3\n');
  });

  it('keeps output printed before break, return and exit', () => {
    expect(out(w, 'for i in 1 2 3; do echo $i; [ $i = 2 ] && break; done')).toBe('1\n2\n');
    expect(out(w, 'f() { echo one; return 0; echo two; }; f')).toBe('one\n');
    expect(out(w, 'echo before; exit 3; echo after')).toBe('before\n');
  });

  it('expands parameters', () => {
    expect(out(w, 'p=/var/log/auth.log; echo ${p##*/} ${p%.*} ${#p} ${q:-none} ${p/log/LOG}')).toBe('auth.log /var/log/auth 17 none /var/LOG/auth.log\n');
    expect(out(w, 'echo $(echo inner) "$(( 7 % 4 ))"')).toBe('inner 3\n');
  });

  it('reports errors for unknown commands and missing files', () => {
    const r = sh(w, 'nosuchcmd');
    expect(r.code).not.toBe(0);
    expect(r.err).toContain('command not found');
    expect(sh(w, 'cat /nope').err).toContain('No such file');
  });

  it('only lets the analyst write in their home and /tmp', () => {
    expect(sh(w, 'echo x > /var/log/auth.log').err).toBeTruthy();
    const w2 = worldAt(SHIFTS[0]);
    expect(out(w2, 'echo hello > ~/note.txt; cat ~/note.txt')).toBe('hello\n');
  });

  it('saves only the analyst\'s own files, and restores them', () => {
    const w2 = worldAt(SHIFTS[0]);
    expect(w2.vfs.userFiles().files).toEqual({});
    sh(w2, 'echo "echo hi" > ~/bin/a.sh; chmod +x ~/bin/a.sh; echo extra >> ~/docs/oncall.txt; rm ~/docs/playbook.txt');
    const saved = w2.vfs.userFiles();
    expect(Object.keys(saved.files).sort()).toEqual(['/home/analyst/bin/a.sh', '/home/analyst/docs/oncall.txt']);
    expect(saved.removed).toEqual(['/home/analyst/docs/playbook.txt']);
    const w3 = worldAt(SHIFTS[0]);
    w3.vfs.restoreUserFiles(JSON.parse(JSON.stringify(saved)));
    expect(out(w3, 'a.sh; tail -1 ~/docs/oncall.txt; ls ~/docs | grep -c playbook')).toBe('hi\nextra\n0\n');
  });

  it('only shows log lines that have happened by the shift clock', () => {
    const s = SHIFTS[0];
    const early = Number(out(worldAt(s, s.start + 600), 'wc -l < /var/log/auth.log'));
    const late = Number(out(worldAt(s), 'wc -l < /var/log/auth.log'));
    expect(early).toBeGreaterThan(0);
    expect(late).toBeGreaterThan(early);
  });
});

describe('SOC lab awk', () => {
  const run = (prog: string, text: string, fs?: string) => awk(prog, [{ name: '-', text }], { fs });

  it('splits fields, counts from the end and sums', () => {
    expect(run('{print $2, $(NF-1)}', 'a b c d\ne f g h\n')).toBe('b c\nf g\n');
    expect(run('{s += $1} END {print s}', '1\n2\n3.5\n')).toBe('6.5\n');
    expect(run('{print $2}', 'a,b\nc,d\n', ',')).toBe('b\nd\n');
  });

  it('supports arrays, printf, patterns and string functions', () => {
    expect(run('{c[$1]++} END {for (k in c) n++; print n}', 'x\ny\nx\n')).toBe('2\n');
    expect(run('/err/ {printf "%-4s|%3d\\n", $1, $2}', 'err 5\nok 6\n')).toBe('err |  5\n');
    expect(run('{gsub(/o/, "0"); print toupper($0), length($0)}', 'foo\n')).toBe('F00 3\n');
    expect(run('$2 > 10', 'a 5\nb 20\nc 100\n')).toBe('b 20\nc 100\n');
    // A field against a number compares numerically; against a string constant, as text.
    expect(run('$1 == 10', '10\n10.0\n')).toBe('10\n10.0\n');
    expect(run('$1 == "10"', '10\n10.0\n')).toBe('10\n');
  });
});

describe('SOC lab SIEM', () => {
  const s = shiftById('ssh')!;
  const events = buildEvents(s);

  it('counts with stats and sorts', () => {
    const r = runSiem('source=auth action=failed | stats count by src | sort -count | head 1', events, range(s));
    expect(r.kind).toBe('table');
    expect(r.rows).toEqual([{ src: '203.0.113.50', count: '400' }]);
  });

  it('counts distinct values, filters with where and supports NOT', () => {
    const r = runSiem('source=auth src=203.0.113.50 action=failed | stats dc(user) as names', events, range(s));
    expect(r.rows[0]['names']).toBe('24');
    const all = runSiem('source=auth', events, range(s)).rows.length;
    const notFailed = runSiem('source=auth NOT action=failed', events, range(s)).rows.length;
    const failed = runSiem('source=auth action=failed', events, range(s)).rows.length;
    expect(failed + notFailed).toBe(all);
    const big = runSiem('source=auth action=failed | stats count by src | where count > 100', events, range(s));
    expect(big.rows.length).toBe(1);
  });

  it('keeps to the time range', () => {
    const r = runSiem('source=auth action=failed', events, { from: s.start, to: s.start + 60 });
    expect(r.rows.length).toBe(0);
  });

  it('rejects unknown commands', () => {
    expect(() => runSiem('source=auth | frobnicate', events, range(s))).toThrow();
  });
});

describe('SOC lab shifts', () => {
  it('have unique ids and build the same events every time', () => {
    expect(new Set(SHIFTS.map(s => s.id)).size).toBe(SHIFTS.length);
    for (const s of SHIFTS) {
      const a = buildEvents(s), b = buildEvents(s);
      expect(a.length).withContext(s.id).toBe(b.length);
      expect(a.map(e => e.raw).join('\n')).withContext(s.id).toBe(b.map(e => e.raw).join('\n'));
      for (let i = 1; i < a.length; i++) if (a[i].t < a[i - 1].t) fail(`${s.id}: events out of order at ${i}`);
    }
  });

  for (const s of SHIFTS) {
    describe(s.title, () => {
      it('has every task answerable by its model answer, once it is available', () => {
        for (const t of s.tasks) {
          expect(t.after).withContext(t.id).toBeGreaterThanOrEqual(s.start);
          expect(t.after).withContext(t.id).toBeLessThan(s.end);
          const w = worldAt(s, t.after);
          if (t.script) {
            expect(w.vfs.write(t.script.path, t.ref)).withContext(t.id).toBeNull();
            const r = checkScript(w, t);
            expect(r.ok).withContext(`${t.id}: ${r.detail}`).toBeTrue();
            // An empty script must not pass.
            w.vfs.write(t.script.path, '#!/bin/bash\n');
            expect(checkScript(w, t).ok).withContext(`${t.id} empty`).toBeFalse();
          } else if (t.where === 'terminal') {
            const r = sh(w, t.ref);
            expect(r.err).withContext(t.id).toBe('');
            expect(r.out.trim()).withContext(t.id).not.toBe('');
            expect(checkTerminal(w, t, r.out)).withContext(t.id).toBeTrue();
            expect(checkTerminal(w, t, 'nothing to see\n')).withContext(`${t.id} wrong`).toBeFalse();
          } else {
            const rg = { from: s.start, to: t.after };
            const r = runSiem(t.ref, w.events, rg);
            expect(r.rows.length).withContext(t.id).toBeGreaterThan(0);
            expect(checkSiem(w, t, r, rg)).withContext(t.id).toBeTrue();
          }
        }
      });

      it('has alerts inside the shift whose queries find events', () => {
        const w = worldAt(s);
        expect(new Set(s.alerts.map(a => a.id)).size).toBe(s.alerts.length);
        for (const a of s.alerts) {
          expect(a.t).withContext(a.id).toBeGreaterThan(s.start);
          expect(a.t).withContext(a.id).toBeLessThan(s.end);
          const r = runSiem(a.query, w.events, { from: s.start, to: a.t });
          expect(r.rows.length).withContext(a.id).toBeGreaterThan(0);
          expect(a.need.length).withContext(a.id).toBeGreaterThan(0);
          expect(a.need.filter(x => a.fine.includes(x))).withContext(a.id).toEqual([]);
          for (const q of a.questions) expect(q.answers.length).withContext(`${a.id}.${q.id}`).toBeGreaterThan(0);
        }
      });

      it('marks a perfect ticket full and an empty one zero', () => {
        for (const a of s.alerts) {
          const perfect = { ...emptyTicket(), verdict: a.verdict, actions: [...a.need], answers: Object.fromEntries(a.questions.map(q => [q.id, q.answers[0]])) };
          const m = markTicket(a, perfect);
          expect(m.points).withContext(a.id).toBe(m.max);
          expect(markTicket(a, emptyTicket()).points).withContext(a.id).toBe(0);
        }
      });
    });
  }
});

describe('SOC lab alert answers match the data', () => {
  const alert = (s: Shift, id: string): Alert => s.alerts.find(a => a.id === id)!;
  const ans = (s: Shift, alertId: string, q: string) => alert(s, alertId).questions.find(x => x.id === q)!.answers[0];

  it('shift 1: the brute force', () => {
    const s = shiftById('ssh')!;
    const w = worldAt(s);
    expect(ans(s, 'ssh-brute', 'src')).toBe('203.0.113.50');
    expect(out(w, `grep "Failed password" /var/log/auth.log | grep -c "from 203.0.113.50 "`).trim()).toBe('400');
    expect(out(w, `grep "Failed password" /var/log/auth.log | grep "from 203.0.113.50 " | awk '{print $(NF-5)}' | sort -u | wc -l`).trim())
      .toBe(ans(s, 'ssh-brute', 'names'));
    expect(out(w, 'grep "Accepted" /var/log/auth.log | grep -c "from 203.0.113.50 "').trim()).toBe('0');
  });
});
