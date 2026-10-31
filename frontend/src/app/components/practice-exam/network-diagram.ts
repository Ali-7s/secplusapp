/**
 * Lays out a firewall PBQ's network diagram, the way exam simulations draw it: the internet as a cloud on the
 * left, the firewall in the middle, one zone above it, one below, and any others in a column on the right, each
 * zone a shaded box whose hosts hang off one wire. A narrow screen gets a single column instead.
 *
 * Pure geometry, so it can be tested; network-diagram.component.ts draws the result as SVG.
 */

import { NetDiagram, NetHost } from '../../models/exam.model';

export const ICON_W = 36;
export const ICON_H = 44;
const PAD = 14;
const TITLE = 30;
const GAP = 64;
const ROW = 56;
const FW_W = 64;
const FW_H = 50;
const CLOUD_W = 170;
const CLOUD_H = 96;
/** Most hosts a zone above or below the firewall holds in its one row; bigger zones go in the right column. */
const MAX_ROW = 4;

export interface PlacedHost { x: number; y: number; host: NetHost }

export interface PlacedZone {
  x: number; y: number; w: number; h: number;
  /** Which of the four zone colours. */
  tone: number;
  name: string;
  subnet?: string;
  hosts: PlacedHost[];
  /** The title runs along the bottom edge (a zone below the firewall, whose wire enters from the top). */
  titleBelow?: boolean;
}

export interface DiagramLayout {
  w: number; h: number;
  cloud?: { x: number; y: number; w: number; h: number; label: string };
  /** A label on the wire between the cloud and the firewall ("IPsec tunnel to HQ"). */
  cloudNote?: { x: number; y: number; text: string };
  externals: PlacedHost[];
  firewall: { x: number; y: number; w: number; h: number; label: string; labelX: number; labelY: number; anchor: 'start' | 'end' };
  zones: PlacedZone[];
  /** Solid network links, as SVG path data. */
  wires: string[];
  /** Dashed links to the outside parties under the cloud. */
  dashed: string[];
}

/** Rough text widths, enough to size boxes so labels fit (names are bold 13px, addresses 12px monospace). */
const nameWidth = (s: string) => s.length * 7.4;
const monoWidth = (s: string) => s.length * 7.3;

/** Width of one host: icon, a gap, then the wider of its name and address. */
const hostWidth = (h: NetHost) => ICON_W + 10 + Math.max(nameWidth(h.name), monoWidth(h.ip ?? '')) + 14;

const titleWidth = (name: string, subnet?: string) => nameWidth(name) + (subnet ? 8 + monoWidth(subnet) : 0);

interface ZoneSize { w: number; h: number; cell: number }

/** A zone with its hosts side by side, its wire running along the side that faces the firewall. */
function rowZoneSize(hosts: NetHost[], name: string, subnet?: string): ZoneSize {
  const cell = Math.max(...hosts.map(hostWidth));
  return { cell, w: Math.max(PAD * 2 + hosts.length * cell, titleWidth(name, subnet) + PAD * 2), h: TITLE + ICON_H + 34 };
}

/** A zone with its hosts one under another, its wire down the left side. */
function columnZoneSize(hosts: NetHost[], name: string, subnet?: string, minW = 0): ZoneSize {
  const cell = Math.max(...hosts.map(hostWidth));
  return { cell, w: Math.max(PAD * 2 + 22 + cell, titleWidth(name, subnet) + PAD * 2, minW), h: TITLE + 6 + hosts.length * ROW + 4 };
}

function placeColumnZone(z: NetDiagram['zones'][number], tone: number, x: number, y: number, size: ZoneSize) {
  const hosts = z.hosts.map((host, i) => ({ host, x: x + PAD + 22, y: y + TITLE + 6 + i * ROW }));
  const busX = x + PAD + 6;
  const mids = hosts.map(h => h.y + ICON_H / 2);
  const entryY = (mids[0] + mids[mids.length - 1]) / 2;
  const wires = [
    `M${busX},${mids[0]} V${mids[mids.length - 1]}`,
    ...hosts.map((h, i) => `M${busX},${mids[i]} H${h.x}`),
  ];
  const zone: PlacedZone = { x, y, w: size.w, h: size.h, tone, name: z.name, subnet: z.subnet, hosts };
  return { zone, wires, busX, entryY };
}

/** The cloud's outside parties, listed under it on a dashed line. */
function placeExternals(hosts: NetHost[], cloudX: number, cloudBottom: number) {
  const lineX = cloudX + 24;
  const placed = hosts.map((host, i) => ({ host, x: lineX + 16, y: cloudBottom + 14 + i * ROW }));
  const mids = placed.map(p => p.y + ICON_H / 2);
  const dashed = placed.length
    ? [`M${lineX},${cloudBottom - 14} V${mids[mids.length - 1]}`, ...placed.map((p, i) => `M${lineX},${mids[i]} H${p.x}`)]
    : [];
  const bottom = placed.length ? placed[placed.length - 1].y + ICON_H : cloudBottom;
  const width = placed.length ? 40 + Math.max(...hosts.map(hostWidth)) : 0;
  return { placed, dashed, bottom, width };
}

/** The exam-style layout for a wide screen. */
export function wideLayout(d: NetDiagram): DiagramLayout {
  // The first two zones small enough for one row go above and below the firewall; the rest go on the right.
  const rowZones = d.zones.filter(z => z.hosts.length <= MAX_ROW).slice(0, 2);
  const top = rowZones[0];
  const bottom = rowZones[1];
  const right = d.zones.filter(z => z !== top && z !== bottom);
  const tone = (z: NetDiagram['zones'][number]) => d.zones.indexOf(z) % 4;

  const topSize = top && rowZoneSize(top.hosts, top.name, top.subnet);
  const bottomSize = bottom && rowZoneSize(bottom.hosts, bottom.name, bottom.subnet);
  const rightSizes = right.map(z => columnZoneSize(z.hosts, z.name, z.subnet));
  const rightW = rightSizes.length ? Math.max(...rightSizes.map(s => s.w)) : 0;
  const rightH = rightSizes.reduce((s, z) => s + z.h, 0) + Math.max(0, rightSizes.length - 1) * 20;

  const outsideHosts = d.outside?.hosts ?? [];
  const leftW = d.outside ? Math.max(CLOUD_W, 24 + 40 + (outsideHosts.length ? Math.max(...outsideHosts.map(hostWidth)) : 0)) : 0;
  const fwLabelW = nameWidth(d.firewall) + FW_W / 2 + 10;
  const midW = Math.max(topSize?.w ?? 0, bottomSize?.w ?? 0, 2 * fwLabelW, 160);

  const midX = PAD + (leftW ? leftW + GAP : 0);
  const fwCx = midX + midW / 2;
  const fwCy = Math.max(PAD + (topSize ? topSize.h + 56 : 30) + FW_H / 2, PAD + CLOUD_H / 2, rightH ? PAD + Math.min(rightH, 260) / 2 : 0);

  const wires: string[] = [];
  const zones: PlacedZone[] = [];
  let bottomEdge = fwCy + FW_H / 2 + 30;

  if (top && topSize) {
    const x = fwCx - topSize.w / 2;
    const y = fwCy - FW_H / 2 - 56 - topSize.h;
    const hosts = top.hosts.map((host, i) => ({ host, x: x + PAD + i * topSize.cell, y: y + TITLE + 4 }));
    const busY = y + TITLE + 4 + ICON_H + 16;
    const xs = hosts.map(h => h.x + ICON_W / 2);
    wires.push(`M${Math.min(...xs, fwCx)},${busY} H${Math.max(...xs, fwCx)}`, ...xs.map(hx => `M${hx},${busY} V${y + TITLE + 4 + ICON_H}`));
    wires.push(`M${fwCx},${fwCy - FW_H / 2} V${busY}`);
    zones.push({ x, y, w: topSize.w, h: topSize.h, tone: tone(top), name: top.name, subnet: top.subnet, hosts });
  }

  if (bottom && bottomSize) {
    const x = fwCx - bottomSize.w / 2;
    const y = fwCy + FW_H / 2 + 56;
    // The wire comes in from above, so this zone's title sits along its bottom edge, clear of the wire.
    const busY = y + 16;
    const hosts = bottom.hosts.map((host, i) => ({ host, x: x + PAD + i * bottomSize.cell, y: busY + 14 }));
    const xs = hosts.map(h => h.x + ICON_W / 2);
    wires.push(`M${Math.min(...xs, fwCx)},${busY} H${Math.max(...xs, fwCx)}`, ...xs.map(hx => `M${hx},${busY} V${busY + 14}`));
    wires.push(`M${fwCx},${fwCy + FW_H / 2} V${busY}`);
    zones.push({ x, y, w: bottomSize.w, h: bottomSize.h, tone: tone(bottom), name: bottom.name, subnet: bottom.subnet, hosts, titleBelow: true });
    bottomEdge = Math.max(bottomEdge, y + bottomSize.h);
  }

  if (right.length) {
    const rightX = midX + midW + GAP;
    const trunkX = rightX - 26;
    let y = Math.max(PAD, fwCy - rightH / 2);
    const entries: number[] = [];
    right.forEach((z, i) => {
      const placed = placeColumnZone(z, tone(z), rightX, y, { ...rightSizes[i], w: rightW });
      zones.push(placed.zone);
      wires.push(...placed.wires, `M${trunkX},${placed.entryY} H${placed.busX}`);
      entries.push(placed.entryY);
      y += rightSizes[i].h + 20;
    });
    wires.push(`M${fwCx + FW_W / 2},${fwCy} H${trunkX}`, `M${trunkX},${Math.min(fwCy, ...entries)} V${Math.max(fwCy, ...entries)}`);
    bottomEdge = Math.max(bottomEdge, y - 20);
  }

  let cloud: DiagramLayout['cloud'];
  let cloudNote: DiagramLayout['cloudNote'];
  let externals: PlacedHost[] = [];
  let dashed: string[] = [];
  if (d.outside) {
    cloud = { x: PAD, y: fwCy - CLOUD_H / 2, w: CLOUD_W, h: CLOUD_H, label: d.outside.label };
    wires.push(`M${PAD + CLOUD_W - 8},${fwCy} H${fwCx - FW_W / 2}`);
    if (d.outside.note) cloudNote = { x: (PAD + CLOUD_W + fwCx - FW_W / 2) / 2, y: fwCy - 8, text: d.outside.note };
    const ext = placeExternals(outsideHosts, PAD, cloud.y + CLOUD_H);
    externals = ext.placed;
    dashed = ext.dashed;
    bottomEdge = Math.max(bottomEdge, ext.bottom);
  }

  const w = Math.max(midX + midW, ...zones.map(z => z.x + z.w)) + PAD;
  const topEdge = Math.min(PAD, ...zones.map(z => z.y));
  const shift = PAD - topEdge;
  const layout: DiagramLayout = {
    w, h: bottomEdge + PAD, cloud, cloudNote, externals, zones, wires, dashed,
    firewall: { x: fwCx - FW_W / 2, y: fwCy - FW_H / 2, w: FW_W, h: FW_H, label: d.firewall,
      labelX: fwCx + FW_W / 2 + 8, labelY: fwCy - FW_H / 2 - 6, anchor: 'start' },
  };
  return shift ? shiftLayout(layout, shift) : layout;
}

/**
 * A single column for a narrow screen: the cloud and its outside parties on the left with the firewall beside
 * it, then each zone under a wire down the left edge.
 */
export function narrowLayout(d: NetDiagram, w = 380): DiagramLayout {
  const wires: string[] = [];
  let cloud: DiagramLayout['cloud'];
  let cloudNote: DiagramLayout['cloudNote'];
  let externals: PlacedHost[] = [];
  let dashed: string[] = [];
  const fwCx = d.outside ? w - PAD - FW_W / 2 - 6 : w / 2;
  const fwCy = d.outside ? PAD + CLOUD_H / 2 : PAD + 16 + FW_H / 2;
  let below = fwCy + FW_H / 2 + 24;

  if (d.outside) {
    cloud = { x: PAD, y: PAD, w: CLOUD_W, h: CLOUD_H, label: d.outside.label };
    wires.push(`M${PAD + CLOUD_W - 8},${fwCy} H${fwCx - FW_W / 2}`);
    if (d.outside.note) cloudNote = { x: (PAD + CLOUD_W + fwCx - FW_W / 2) / 2, y: fwCy + 16, text: d.outside.note };
    const ext = placeExternals(d.outside.hosts ?? [], PAD, PAD + CLOUD_H);
    externals = ext.placed;
    dashed = ext.dashed;
    below = Math.max(below, ext.bottom + 20);
  }

  const trunkX = PAD + 4;
  const zoneX = PAD + 20;
  let y = below + 16;
  const entries: number[] = [];
  const zones = d.zones.map((z, i) => {
    const size = columnZoneSize(z.hosts, z.name, z.subnet, w - zoneX - PAD);
    const placed = placeColumnZone(z, i % 4, zoneX, y, size);
    wires.push(...placed.wires, `M${trunkX},${placed.entryY} H${placed.busX}`);
    entries.push(placed.entryY);
    y += size.h + 16;
    return placed.zone;
  });
  wires.push(`M${fwCx},${fwCy + FW_H / 2} V${below} H${trunkX} V${Math.max(...entries)}`);

  return {
    w: Math.max(w, ...zones.map(z => z.x + z.w + PAD)), h: y - 16 + PAD, cloud, cloudNote, externals, zones, wires, dashed,
    firewall: { x: fwCx - FW_W / 2, y: fwCy - FW_H / 2, w: FW_W, h: FW_H, label: d.firewall,
      ...(d.outside
        ? { labelX: fwCx - 8, labelY: fwCy + FW_H / 2 + 16, anchor: 'end' as const }
        : { labelX: fwCx + FW_W / 2 + 8, labelY: fwCy + 5, anchor: 'start' as const }) },
  };
}

/** Moves everything down, for a top zone that ended up above the canvas. */
function shiftLayout(l: DiagramLayout, dy: number): DiagramLayout {
  const move = (path: string) => path.replace(/([MHVL])([\d.-]+)(?:,([\d.-]+))?/g, (_, cmd: string, a: string, b?: string) =>
    cmd === 'V' ? `V${+a + dy}` : cmd === 'H' ? `H${a}` : `${cmd}${a},${+b! + dy}`);
  return {
    ...l,
    h: l.h + dy,
    cloud: l.cloud && { ...l.cloud, y: l.cloud.y + dy },
    cloudNote: l.cloudNote && { ...l.cloudNote, y: l.cloudNote.y + dy },
    externals: l.externals.map(e => ({ ...e, y: e.y + dy })),
    firewall: { ...l.firewall, y: l.firewall.y + dy, labelY: l.firewall.labelY + dy },
    zones: l.zones.map(z => ({ ...z, y: z.y + dy, hosts: z.hosts.map(h => ({ ...h, y: h.y + dy })) })),
    wires: l.wires.map(move),
    dashed: l.dashed.map(move),
  };
}
