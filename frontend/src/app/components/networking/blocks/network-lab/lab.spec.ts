import {
  LabScenario, LabWork, SERVICES, addrFaults, addressedHosts, emptyWork, gradeAddr, gradePort, gradeSlot, hostById, ipToNum, runFlow,
  subnetOf, zoneById,
} from './lab';
import { SCENARIOS } from './scenarios';

/** The network as the scenario intends it: the best device in each spot, every port and address right, the solution's rules. */
function reference(sc: LabScenario): LabWork {
  const w = emptyWork();
  for (const s of sc.slots) w.slots[s.id] = s.answer[0];
  for (const row of sc.ports) {
    if (!row.host) { w.ports[row.id] = { shut: true }; continue; }
    const h = hostById(sc, row.host)!;
    w.ports[row.id] = { vlan: zoneById(sc, h.zone)!.vlan, secure: h.secure ?? true };
  }
  for (const h of addressedHosts(sc)) {
    const z = zoneById(sc, h.zone)!;
    w.addr[h.id] = h.addr === 'dhcp' ? { mode: 'dhcp' }
      : h.addr === 'reserved' ? { mode: 'reserved', ip: h.ip }
      : { mode: 'static', ip: h.ip, prefix: subnetOf(z.subnet).prefix, gw: z.gateway };
  }
  w.rules = sc.solution.rules.map(r => ({ ...r }));
  w.detect = { ...sc.solution.detect };
  return w;
}

const failing = (sc: LabScenario, w: LabWork) => sc.flows.filter(f => !runFlow(sc, w, f).ok).map(f => f.id);

describe('network lab scenarios', () => {
  for (const sc of SCENARIOS) {
    describe(sc.name, () => {
      it('can be solved: the reference network passes every stage and every flow', () => {
        const w = reference(sc);
        for (const s of sc.slots) expect(gradeSlot(s, w.slots[s.id]).ok).withContext(s.id).toBeTrue();
        for (const row of sc.ports) expect(gradePort(sc, w, row)).withContext(row.id).toEqual([]);
        for (const h of addressedHosts(sc)) expect(gradeAddr(sc, w, h)).withContext(h.id).toEqual([]);
        expect(failing(sc, w)).toEqual([]);
      });

      it('accepts every listed device in each spot', () => {
        for (const s of sc.slots) {
          for (const alt of s.answer) {
            const w = reference(sc);
            w.slots[s.id] = alt;
            expect(failing(sc, w)).withContext(`${s.id} = ${alt}`).toEqual([]);
          }
        }
      });

      it('needs every device: taking any one away lets some flow misbehave', () => {
        for (const s of sc.slots) {
          const w = reference(sc);
          delete w.slots[s.id];
          expect(failing(sc, w).length).withContext(s.id).toBeGreaterThan(0);
        }
      });

      it('fails everything while nothing is set up', () => {
        expect(failing(sc, emptyWork()).length).toBe(sc.flows.length);
      });

      it('lets attacks through when the firewall allows anything', () => {
        const w = reference(sc);
        w.rules = [{ from: 'any', to: 'any', service: 'any', action: 'allow' }];
        const bad = failing(sc, w);
        expect(bad.length).toBeGreaterThan(0);
        // Everything that should work still works: only the protection is lost.
        for (const id of bad) expect(sc.flows.find(f => f.id === id)!.expect).withContext(id).not.toBe('works');
      });

      it('needs alerts sent to the SIEM for attacks that are only seen', () => {
        const w = reference(sc);
        w.detect.siem = false;
        const bad = failing(sc, w);
        expect(bad.length).toBeGreaterThan(0);
        for (const id of bad) expect(sc.flows.find(f => f.id === id)!.expect).withContext(id).toBe('detected');
      });

      it('is consistent: ports, zones, addresses, MACs, flows and rules all refer to real things', () => {
        const externals = sc.externals ?? [];
        const ids = new Set([...sc.zones.map(z => z.id), ...sc.hosts.map(h => h.id), ...externals.map(e => e.id)]);
        expect(ids.size).withContext('zone, host and external ids are unique').toBe(sc.zones.length + sc.hosts.length + externals.length);
        expect(new Set(sc.zones.map(z => z.vlan)).size).withContext('VLANs are unique').toBe(sc.zones.length);
        expect(new Set(sc.hosts.map(h => h.mac)).size).withContext('MACs are unique').toBe(sc.hosts.length);
        for (const s of sc.slots) for (const a of s.answer) expect(sc.palette).withContext(s.id).toContain(a);
        for (const n of sc.chain) {
          if (n.slot) expect(sc.slots.some(s => s.id === n.slot)).withContext(n.slot).toBeTrue();
          if (n.tap) expect(sc.slots.find(s => s.id === n.tap)?.mode).withContext(n.tap).toBe('tap');
          for (const z of n.zones ?? []) expect(zoneById(sc, z)).withContext(z).toBeDefined();
        }
        // Every spot is drawn exactly once, in the chain or inside a zone.
        const drawn = [...sc.chain.flatMap(n => [n.slot, n.tap]), ...sc.zones.flatMap(z => z.slots ?? [])].filter(Boolean);
        expect([...drawn].sort()).toEqual(sc.slots.map(s => s.id).sort());
        // Every real zone is drawn once.
        expect(sc.chain.flatMap(n => n.zones ?? []).sort()).toEqual(sc.zones.filter(z => !z.virtual).map(z => z.id).sort());
        for (const h of sc.hosts) {
          expect(/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/.test(h.mac)).withContext(h.mac).toBeTrue();
          expect(zoneById(sc, h.zone)).withContext(h.id).toBeDefined();
          if (h.via) expect(hostById(sc, h.via)?.zone).withContext(h.id).toBe(h.zone);
          else expect(sc.ports.find(p => p.id === h.port)?.host).withContext(h.id).toBe(h.id);
        }
        for (const f of sc.flows) {
          for (const end of [f.from, f.to]) {
            const [kind, id] = end.includes(':') ? end.split(':') : ['', end];
            if (kind === 'port') expect(sc.ports.find(p => p.id === id)?.host).withContext(end).toBeUndefined();
            else if (kind === 'swap') expect(hostById(sc, id)?.port).withContext(end).toBeDefined();
            else if (end !== 'internet' && end !== 'remote') expect(ids.has(end) && !zoneById(sc, end)).withContext(end).toBeTrue();
          }
          if (f.service !== 'scan') expect(sc.services).withContext(f.id).toContain(f.service);
        }
        for (const s of sc.services) expect(SERVICES[s]).withContext(s).toBeDefined();
        for (const r of sc.solution.rules) {
          for (const end of [r.from, r.to]) expect(end === 'internet' || ids.has(end)).withContext(end).toBeTrue();
          expect(sc.services).toContain(r.service);
        }
      });

      it('gives fixed addresses that are usable, inside the subnet and outside the DHCP pool', () => {
        for (const z of sc.zones) {
          const net = subnetOf(z.subnet);
          expect(net.base).withContext(z.subnet).toBe(ipToNum(z.subnet.split('/')[0])!);
          const gw = ipToNum(z.gateway)! - net.base;
          expect(gw > 0 && gw < net.size - 1).withContext(z.gateway).toBeTrue();
          if (z.pool) expect(z.pool[1]).withContext(z.id).toBeLessThan(net.size - 1);
        }
        for (const h of sc.hosts.filter(x => x.addr !== 'dhcp')) {
          const z = zoneById(sc, h.zone)!;
          const off = ipToNum(h.ip)! - subnetOf(z.subnet).base;
          expect(off > 0 && off < subnetOf(z.subnet).size - 1).withContext(h.id).toBeTrue();
          if (z.pool) expect(off < z.pool[0] || off > z.pool[1]).withContext(`${h.id} outside the pool`).toBeTrue();
          if (h.addr === 'reserved') expect(z.pool).withContext(`${h.id} needs DHCP`).toBeDefined();
        }
        for (const h of sc.hosts.filter(x => x.addr === 'dhcp')) expect(zoneById(sc, h.zone)!.pool).withContext(h.id).toBeDefined();
      });

      it('tests every kind of outcome', () => {
        for (const e of ['works', 'blocked', 'detected'] as const) expect(sc.flows.some(f => f.expect === e)).withContext(e).toBeTrue();
      });
    });
  }

  it('offers five different scenarios', () => {
    expect(SCENARIOS.length).toBe(5);
    expect(new Set(SCENARIOS.map(s => s.id)).size).toBe(5);
  });
});

describe('network lab grading', () => {
  const sc = SCENARIOS[0];
  const fix = (patch: (w: LabWork) => void) => { const w = reference(sc); patch(w); return w; };
  const web = hostById(sc, 'web')!;
  const faults = (w: LabWork) => addrFaults(sc, w, web).join(' ');

  it('catches common addressing mistakes', () => {
    expect(faults(fix(w => w.addr['web'].ip = '192.168.10.40'))).toContain('not in');
    expect(faults(fix(w => w.addr['web'].ip = '192.168.10.31'))).toContain('broadcast');
    expect(faults(fix(w => w.addr['web'].ip = '192.168.10.0'))).toContain('network address');
    expect(faults(fix(w => w.addr['web'].ip = '192.168.10.1'))).toContain('gateway\'s own address');
    expect(faults(fix(w => w.addr['web'].prefix = 24))).toContain('/27');
    expect(faults(fix(w => w.addr['web'].gw = '192.168.10.254'))).toContain('default gateway');
    expect(faults(fix(w => w.addr['web'].ip = '300.1.1.1'))).toContain('not an IPv4 address');
    expect(faults(fix(w => w.ports['c1'].vlan = 1))).toContain('VLAN 1');
    const acct = hostById(sc, 'acct')!;
    expect(addrFaults(sc, fix(w => w.addr['acct'].ip = '10.30.0.150'), acct).join(' ')).toContain('DHCP pool');
    expect(addrFaults(sc, fix(w => w.addr['db'] = { mode: 'dhcp' }), hostById(sc, 'db')!).join(' ')).toContain('no DHCP server');
    const printer = hostById(sc, 'printer')!;
    expect(addrFaults(sc, fix(w => w.addr['acct'] = { mode: 'static', ip: '10.20.0.50', prefix: 24, gw: '10.30.0.1' }), printer).join(' ')).toContain('already has');
  });

  it('says why a working but wrong address method is wrong', () => {
    const w = fix(w => w.addr['sales'] = { mode: 'reserved', ip: '10.20.0.60' });
    expect(addrFaults(sc, w, hostById(sc, 'sales')!)).toEqual([]);
    expect(gradeAddr(sc, w, hostById(sc, 'sales')!).length).toBe(1);
  });

  it('flags a server on DHCP as unreachable even though it gets an address', () => {
    const w = fix(w => { w.ports['c1'] = { vlan: 20, secure: true }; w.addr['web'] = { mode: 'dhcp' }; });
    expect(runFlow(sc, w, sc.flows[0]).delivered).toBeFalse();
  });

  it('follows the rules in order, first match wins', () => {
    const toDb = sc.flows.find(f => f.id === 's2')!;
    expect(runFlow(sc, fix(w => w.rules.unshift({ from: 'web', to: 'data', service: 'any', action: 'deny' })), toDb).delivered).toBeFalse();
    expect(runFlow(sc, fix(w => w.rules.push({ from: 'web', to: 'data', service: 'any', action: 'deny' })), toDb).delivered).toBeTrue();
  });

  it('only drops attacks when the IPS is in prevent mode', () => {
    const exploit = sc.flows.find(f => f.id === 's9')!;
    expect(runFlow(sc, reference(sc), exploit).blocked).toBeTrue();
    const r = runFlow(sc, fix(w => w.detect.ipsMode = 'detect'), exploit);
    expect(r.delivered).toBeTrue();
    expect(r.alerted).toBeTrue();
    expect(r.ok).toBeFalse();
  });

  it('stops a laptop in a spare port only if the port is shut, and a swapped device only with port security', () => {
    const spare = sc.flows.find(f => f.from === 'port:c10')!;
    expect(runFlow(sc, fix(w => w.ports['c10'] = {}), spare).ok).toBeFalse();
    const swap = sc.flows.find(f => f.from === 'swap:printer')!;
    expect(runFlow(sc, fix(w => w.ports['c5'].secure = false), swap).ok).toBeFalse();
  });
});
