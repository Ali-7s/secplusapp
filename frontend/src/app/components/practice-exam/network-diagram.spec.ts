import { ExamQuestion, FirewallQuestion, NetDiagram } from '../../models/exam.model';
import { DiagramLayout, ICON_H, ICON_W, narrowLayout, wideLayout } from './network-diagram';

/** Every firewall PBQ is drawn, the drawing shows every address its text exhibit had, and nothing overlaps. */
describe('firewall network diagrams', () => {
  let firewalls: FirewallQuestion[];

  beforeAll(async () => {
    const pool = await (await fetch('/data/practice-exam.json')).json() as ExamQuestion[];
    firewalls = pool.filter((q): q is FirewallQuestion => q.kind === 'firewall');
  });

  const text = (d: NetDiagram) => JSON.stringify(d);

  it('has a diagram for every firewall question, with every address from its exhibit', () => {
    expect(firewalls.length).toBeGreaterThan(0);
    for (const q of firewalls) {
      expect(q.diagram).withContext(q.id).toBeDefined();
      for (const ip of q.exhibit?.match(/\d+\.\d+\.\d+\.\d+(?:\/\d+)?/g) ?? []) {
        expect(text(q.diagram!)).withContext(`${q.id} ${ip}`).toContain(ip);
      }
      for (const z of q.diagram!.zones) expect(z.hosts.length).withContext(`${q.id} ${z.name}`).toBeGreaterThan(0);
    }
  });

  const inside = (x: number, y: number, w: number, h: number, box: { x: number; y: number; w: number; h: number }) =>
    x >= box.x && y >= box.y && x + w <= box.x + box.w && y + h <= box.y + box.h;

  const overlaps = (a: { x: number; y: number; w: number; h: number }, b: typeof a) =>
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

  function checkLayout(id: string, l: DiagramLayout) {
    const canvas = { x: 0, y: 0, w: l.w, h: l.h };
    l.zones.forEach((z, i) => {
      expect(inside(z.x, z.y, z.w, z.h, canvas)).withContext(`${id} ${z.name} on the canvas`).toBeTrue();
      for (const h of z.hosts) expect(inside(h.x, h.y, ICON_W, ICON_H, z)).withContext(`${id} ${h.host.name} in ${z.name}`).toBeTrue();
      l.zones.slice(i + 1).forEach(o => expect(overlaps(z, o)).withContext(`${id} ${z.name} and ${o.name}`).toBeFalse());
    });
    for (const e of l.externals) expect(inside(e.x, e.y, ICON_W, ICON_H, canvas)).withContext(`${id} ${e.host.name}`).toBeTrue();
    expect(inside(l.firewall.x, l.firewall.y, l.firewall.w, l.firewall.h, canvas)).withContext(`${id} firewall`).toBeTrue();
  }

  it('keeps every box on the canvas and apart, wide and narrow', () => {
    for (const q of firewalls) {
      checkLayout(`${q.id} wide`, wideLayout(q.diagram!));
      checkLayout(`${q.id} narrow`, narrowLayout(q.diagram!));
    }
  });
});
