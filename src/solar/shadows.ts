import type { Position } from "./engine";
export type Building = {
  bearing: number;
  distance: number;
  width: number;
  height: number;
  pointHeight: number;
};
const rad = Math.PI / 180;
export function validBuilding(b: Building) {
  return (
    Object.values(b).every(Number.isFinite) &&
    b.bearing >= 0 &&
    b.bearing < 360 &&
    b.distance > 0 &&
    b.distance <= 10000 &&
    b.width > 0 &&
    b.width <= 10000 &&
    b.height > 0 &&
    b.height <= 2000 &&
    b.pointHeight >= 0 &&
    b.pointHeight <= 2000
  );
}
// A measured vertical rectangular facade, perpendicular to the center bearing.
// Observer is at origin. Height is above a shared flat ground datum.
export function buildingBlocks(p: Position, b: Building) {
  if (p.altitude <= 0 || !validBuilding(b)) return false;
  const delta = (p.azimuth - b.bearing) * rad,
    forward = Math.cos(delta);
  if (forward <= 1e-10) return false;
  const rayDistance = b.distance / forward;
  const lateral = rayDistance * Math.sin(delta);
  const rayHeight = b.pointHeight + rayDistance * Math.tan(p.altitude * rad);
  return Math.abs(lateral) <= b.width / 2 && rayHeight <= b.height;
}
export function shadowLength(p: Position, b: Building) {
  return p.altitude > 0
    ? Math.max(0, b.height - b.pointHeight) / Math.tan(p.altitude * rad)
    : null;
}
export function wallAndShadow(p: Position, b: Building) {
  const a = b.bearing * rad;
  const cx = b.distance * Math.sin(a),
    cy = b.distance * Math.cos(a);
  const side = {
    x: (Math.cos(a) * b.width) / 2,
    y: (-Math.sin(a) * b.width) / 2,
  };
  const wall = [
    { x: cx - side.x, y: cy - side.y },
    { x: cx + side.x, y: cy + side.y },
  ];
  const length = shadowLength(p, b);
  if (length === null) return { wall, polygon: [] };
  const shift = {
    x: -length * Math.sin(p.azimuth * rad),
    y: -length * Math.cos(p.azimuth * rad),
  };
  return {
    wall,
    polygon: [
      ...wall,
      { x: wall[1].x + shift.x, y: wall[1].y + shift.y },
      { x: wall[0].x + shift.x, y: wall[0].y + shift.y },
    ],
  };
}
