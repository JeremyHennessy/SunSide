import type { Position } from "../solar/engine";
export type XY = { x: number; y: number };
export type MappedBuilding = {
  id: string;
  rings: XY[][];
  height: number | null;
  minHeight: number;
  source: string;
  heightSource: string;
  hasParts: boolean;
  part: boolean;
};
export type BuildingMap = {
  lat: number;
  lon: number;
  radius: number;
  release: string;
  buildings: MappedBuilding[];
};
const rad = Math.PI / 180;
export function project(
  lon: number,
  lat: number,
  originLon: number,
  originLat: number,
): XY {
  const delta = ((lon - originLon + 540) % 360) - 180;
  return {
    x: delta * rad * 6371008.8 * Math.cos(originLat * rad),
    y: (lat - originLat) * rad * 6371008.8,
  };
}
export function contains(rings: XY[][], point: XY = { x: 0, y: 0 }) {
  let inside = false;
  for (const ring of rings)
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i],
        b = ring[j];
      if (
        a.y > point.y !== b.y > point.y &&
        point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
      )
        inside = !inside;
    }
  return inside;
}
// Intersection of a rising solar ray with a polygon extrusion. Rings use even/odd fill,
// preserving courtyards. Heights are dataset values, on a shared level-ground datum.
export function mappedBlocks(p: Position, b: MappedBuilding) {
  if (p.altitude <= 0 || b.height === null) return false;
  const slope = Math.tan(p.altitude * rad),
    d = { x: Math.sin(p.azimuth * rad), y: Math.cos(p.azimuth * rad) };
  const hits: number[] = [0];
  for (const ring of b.rings)
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        next = ring[(i + 1) % ring.length],
        e = { x: next.x - a.x, y: next.y - a.y };
      const denom = d.x * e.y - d.y * e.x;
      if (Math.abs(denom) < 1e-10) continue;
      const t = (a.x * e.y - a.y * e.x) / denom,
        u = (a.x * d.y - a.y * d.x) / denom;
      if (t >= 0 && u >= 0 && u <= 1) hits.push(t);
    }
  hits.sort((a, b) => a - b);
  for (let i = 0; i < hits.length - 1; i++) {
    const lo = hits[i],
      hi = hits[i + 1],
      mid = (lo + hi) / 2;
    if (
      hi - lo > 1e-8 &&
      contains(b.rings, { x: d.x * mid, y: d.y * mid }) &&
      hi * slope >= b.minHeight &&
      lo * slope <= b.minHeight + b.height
    )
      return true;
  }
  return false;
}
export function shadowShift(p: Position, height: number): XY {
  const length = p.altitude > 0 ? height / Math.tan(p.altitude * rad) : 0;
  return {
    x: -length * Math.sin(p.azimuth * rad),
    y: -length * Math.cos(p.azimuth * rad),
  };
}
export function projectedShadow(p: Position, b: MappedBuilding) {
  if (p.altitude <= 0 || b.height === null)
    return { roof: [], sides: [] } as { roof: XY[][]; sides: XY[][] };
  const low = shadowShift(p, b.minHeight),
    high = shadowShift(p, b.minHeight + b.height);
  const shifted = (a: XY, s: XY) => ({ x: a.x + s.x, y: a.y + s.y });
  const roof = b.rings.map((r) => r.map((a) => shifted(a, high)));
  const sides = b.rings.flatMap((r) =>
    r.map((a, i) => {
      const next = r[(i + 1) % r.length];
      const polygon = [
        shifted(a, low),
        shifted(next, low),
        shifted(next, high),
        shifted(a, high),
      ];
      const area = polygon.reduce((n, a, i) => {
        const next = polygon[(i + 1) % 4];
        return n + a.x * next.y - next.x * a.y;
      }, 0);
      // Same winding for union fill: overlaps do not cut holes in the SVG.
      return area < 0 ? polygon.reverse() : polygon;
    }),
  );
  return { roof, sides };
}
