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
            // tcpdump announces the file it reads on standard error, as the real one does.
            expect(r.err.replace(/^reading from file .*\n/gm, '')).withContext(t.id).toBe('');
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

describe('SOC lab network commands', () => {
  const s = shiftById('net')!;
  const before = worldAt(s, s.start + 60);
  const after = worldAt(s);

  it('shows the workstation\'s own address, route, neighbours and sockets', () => {
    expect(out(before, 'ip addr')).toContain('inet 10.0.8.15/24 brd 10.0.8.255 scope global eth0');
    expect(out(before, 'ip route')).toContain('default via 10.0.8.1 dev eth0');
    expect(out(before, 'ip -br a')).toContain('10.0.8.15/24');
    expect(out(before, 'arp -n')).toContain('00:1a:2b:00:08:01');
    expect(out(before, 'ss -tuln')).toContain('0.0.0.0:22');
    expect(out(before, 'ss -tul')).toContain('0.0.0.0:ssh');
    expect(out(before, 'netstat -tan')).toContain('ESTABLISHED');
    expect(sh(before, 'ip bogus').code).toBe(1);
  });

  it('pings with TTLs that tell the system apart, and treats silence honestly', () => {
    const dc = sh(before, 'ping -c 2 dc01');
    expect(dc.code).toBe(0);
    expect(dc.out).toContain('PING dc01.fernco.example (10.0.1.5) 56(84) bytes of data.');
    expect(dc.out).toContain('ttl=127');
    expect(dc.out).toContain('2 packets transmitted, 2 received, 0% packet loss');
    expect(out(before, 'ping -c 1 web01')).toContain('ttl=63');
    expect(out(before, 'ping -c 1 10.0.8.20')).toContain('ttl=64');
    const laptop = sh(before, 'ping -c 2 10.0.4.101');
    expect(laptop.code).toBe(1);
    expect(laptop.out).toContain('100% packet loss');
    expect(sh(before, 'ping -c 1 10.0.8.99').out).toContain('Destination Host Unreachable');
    expect(sh(before, 'ping -c 1 nosuchhost').err).toContain('Name or service not known');
    // The same command, same answer: times are repeatable.
    expect(out(before, 'ping -c 3 dc01')).toBe(out(before, 'ping -c 3 dc01'));
    // The rogue device answers once the shift has it.
    expect(out(after, 'ping -c 1 10.0.4.177')).toContain('ttl=63');
  });

  it('traces the route through the gateway, and stops at the edge for the internet', () => {
    const t = out(before, 'traceroute -n web01');
    expect(t.split('\n')[1]).toMatch(/^ 1 {2}10\.0\.8\.1 /);
    expect(t.split('\n')[2]).toMatch(/^ 2 {2}10\.0\.2\.10 /);
    const far = out(before, 'traceroute -n -m 5 crm.saas-vendor.example');
    expect(far).toContain(' 2  10.0.0.1 ');
    expect(far).toContain(' 5  * * *');
  });

  it('answers DNS, then fails with SERVFAIL on dns01 only after the change', () => {
    expect(out(before, 'dig crm.saas-vendor.example +short')).toBe('192.0.2.21\n');
    expect(out(before, 'dig crm.saas-vendor.example')).toContain('status: NOERROR');
    expect(out(after, 'dig crm.saas-vendor.example')).toContain('status: SERVFAIL');
    expect(out(after, 'dig @10.0.1.54 crm.saas-vendor.example +short')).toBe('192.0.2.21\n');
    expect(out(after, 'dig intranet.fernco.example +short')).toBe('10.0.2.20\n');
    expect(out(after, 'dig -x 10.0.1.5 +short')).toBe('dc01.fernco.example.\n');
    expect(out(after, 'dig nosuch.fernco.example')).toContain('status: NXDOMAIN');
    expect(sh(after, 'dig @8.8.8.8 crm.saas-vendor.example').code).toBe(9);
    expect(sh(after, 'nslookup crm.saas-vendor.example').out).toContain("server can't find crm.saas-vendor.example: SERVFAIL");
    expect(out(after, 'nslookup dc01')).toContain('Address: 10.0.1.5');
    expect(out(before, 'host fernco.example')).toContain('mail is handled by 10 mail.fernco.example.');
    expect(sh(after, 'ping -c 1 crm.saas-vendor.example').err).toContain('Temporary failure in name resolution');
  });

  it('reads captures only once they are saved, with filters and payloads', () => {
    expect(out(before, 'ls /var/captures')).toBe('');
    expect(sh(before, 'tcpdump -nr /var/captures/floor2-1344.pcap').err).toContain('No such file or directory');
    expect(out(after, 'ls /var/captures').split(/\s+/).filter(Boolean)).toEqual(['bk01-1310.pcap', 'dns01-1405.pcap', 'floor2-1344.pcap']);
    expect(out(after, 'file /var/captures/bk01-1310.pcap')).toContain('pcap capture file');
    expect(sh(after, 'tcpdump -i eth0').err).toContain("You don't have permission");
    const arp = out(after, 'tcpdump -enr /var/captures/floor2-1344.pcap arp');
    expect(arp).toContain('b4:2e:99:5c:1e:42 > 28:d2:44:7a:10:65, ethertype ARP (0x0806), length 42: Reply 10.0.4.1 is-at b4:2e:99:5c:1e:42');
    expect(out(after, 'tcpdump -nAr /var/captures/floor2-1344.pcap tcp port 80')).toContain('user=a.ng&password=');
    const syn = out(after, 'tcpdump -nr /var/captures/bk01-1310.pcap dst port 22').trim().split('\n');
    expect(syn.length).toBe(8);
    expect(syn.every(l => l.includes('Flags [S]'))).toBeTrue();
    expect(out(after, 'tcpdump -nr /var/captures/dns01-1405.pcap')).toContain('ServFail 0/0/0');
    expect(out(after, 'tcpdump -r /var/captures/bk01-1310.pcap -c 1 port 22')).toContain('bk01.fernco.example.');
    expect(out(after, 'tcpdump -nr /var/captures/bk01-1310.pcap -c 2 port 22').trim().split('\n').length).toBe(2);
    expect(sh(after, 'tcpdump -nr /var/captures/bk01-1310.pcap port').err).toContain('tcpdump:');
  });

  it('prints tcpdump\'s "reading from file" line before the packets, and redirects it like any error', () => {
    const reading = /^reading from file \/var\/captures\/bk01-1310\.pcap, link-type EN10MB/;
    const plain = sh(after, 'tcpdump -nr /var/captures/bk01-1310.pcap -c 2');
    expect(plain.display).toMatch(reading);
    expect(plain.display.split('\n')[1]).toMatch(/^\d\d:\d\d:\d\d\.\d+ /);
    expect(plain.out).not.toMatch(reading);
    // Through a pipe the line still comes first on screen, and never reaches grep.
    const piped = sh(after, 'tcpdump -nr /var/captures/bk01-1310.pcap | grep -c Flags');
    expect(piped.display).toMatch(reading);
    expect(piped.out.trim()).toMatch(/^\d+$/);
    // A second command's output follows the first command's.
    expect(sh(after, 'echo first; tcpdump -nr /var/captures/bk01-1310.pcap -c 1').display).toMatch(/^first\nreading from file/);
    expect(sh(after, 'tcpdump -nr /var/captures/bk01-1310.pcap -c 1 2>/dev/null').display).not.toContain('reading from file');
    expect(sh(after, 'tcpdump -nr /var/captures/bk01-1310.pcap -c 1 2>&1 | head -1').out).toMatch(reading);
  });
});

describe('SOC lab shift 4 answers match the data', () => {
  const s = shiftById('net')!;
  const w = worldAt(s);
  const ans = (alertId: string, q: string) => s.alerts.find(a => a.id === alertId)!.questions.find(x => x.id === q)!.answers[0];

  it('the blocked backup goes to port 22 and is covered by CHG-433', () => {
    expect(out(w, 'grep "src=10.0.6.40 " /var/log/firewall.log | grep deny | grep -o "dpt=[0-9]*" | sort -u')).toBe(`dpt=${ans('net-backup', 'port')}\n`);
    expect(out(w, 'grep bk01 ~/docs/change-calendar.txt')).toContain(ans('net-backup', 'chg'));
  });

  it('the rogue MAC leads to the switch port, the room and the exposed password', () => {
    const mac = ans('net-arp', 'mac');
    expect(out(w, `grep ${mac} ~/docs/sw-floor2-mac-table.txt`)).toContain(ans('net-arp', 'port'));
    expect(out(w, `grep "${ans('net-arp', 'port')}," ~/docs/floor2-ports.csv`)).toContain(ans('net-arp', 'where'));
    expect(out(w, 'tcpdump -nAr /var/captures/floor2-1344.pcap tcp port 80')).toContain(`user=${ans('net-arp', 'who')}&`);
  });

  it('dns01 forwards to the mistyped address after CHG-432', () => {
    expect(out(w, 'grep "src=10.0.1.53 " /var/log/firewall.log | grep deny | grep -o "dst=[0-9.]*" | sort -u')).toBe(`dst=${ans('net-dns', 'fwd')}\n`);
    expect(out(w, 'grep dns01 ~/docs/change-calendar.txt')).toContain(ans('net-dns', 'chg'));
    expect(out(w, 'grep -c "rcode=NXDOMAIN" /var/log/dns.log').trim()).not.toBe(out(w, 'grep -c "rcode=SERVFAIL" /var/log/dns.log').trim());
  });
});
