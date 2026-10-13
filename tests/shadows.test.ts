import { describe, it, expect } from "vitest";
import {
  buildingBlocks,
  shadowLength,
  wallAndShadow,
  validBuilding,
} from "../src/solar/shadows";
import { calculate, exposure, type Config } from "../src/solar/engine";
const b = { bearing: 180, distance: 10, width: 10, height: 10, pointHeight: 0 };
describe("measured wall geometry, independent trigonometric cases", () => {
  it("10 m wall casts a 10 m shadow at 45 degrees", () => {
    expect(shadowLength({ azimuth: 180, altitude: 45 }, b)).toBeCloseTo(10, 10);
    expect(buildingBlocks({ azimuth: 180, altitude: 30 }, b)).toBe(true);
    expect(buildingBlocks({ azimuth: 180, altitude: 60 }, b)).toBe(false);
  });
  it("tests wall width and oblique ray distance", () => {
    expect(buildingBlocks({ azimuth: 200, altitude: 30 }, b)).toBe(true);
    expect(buildingBlocks({ azimuth: 210, altitude: 30 }, b)).toBe(false);
    expect(buildingBlocks({ azimuth: 0, altitude: 30 }, b)).toBe(false);
  });
  it("elevated patio shortens shadow and avoids below-point roofs", () => {
    expect(
      shadowLength({ azimuth: 180, altitude: 45 }, { ...b, pointHeight: 5 }),
    ).toBeCloseTo(5, 10);
    expect(
      buildingBlocks({ azimuth: 180, altitude: 30 }, { ...b, pointHeight: 5 }),
    ).toBe(false);
    expect(
      buildingBlocks({ azimuth: 180, altitude: 10 }, { ...b, pointHeight: 11 }),
    ).toBe(false);
  });
  it("handles wrap, horizon and missing inputs", () => {
    expect(
      buildingBlocks({ azimuth: 359, altitude: 30 }, { ...b, bearing: 0 }),
    ).toBe(true);
    expect(buildingBlocks({ azimuth: 180, altitude: 0 }, b)).toBe(false);
    expect(shadowLength({ azimuth: 180, altitude: 0 }, b)).toBeNull();
    expect(validBuilding({ ...b, distance: 0 })).toBe(false);
    expect(
      buildingBlocks({ azimuth: 180, altitude: 30 }, { ...b, distance: 0 }),
    ).toBe(false);
  });
  it("maps a south wall shadow north toward patio", () => {
    const g = wallAndShadow({ azimuth: 180, altitude: 45 }, b);
    expect(g.wall[0].y).toBeCloseTo(-10, 10);
    expect(g.polygon[2].y).toBeCloseTo(0, 10);
  });
  it("open patio accepts all bearings and walls only reduce exposure", () => {
    const c: Config = {
      lat: 44.65,
      lon: -63.57,
      zone: "America/Halifax",
      date: "2026-06-21",
      facing: 0,
      horizon: 0,
      space: "patio",
    };
    expect(exposure({ azimuth: 180, altitude: 30 }, c)).toBe(true);
    expect(
      exposure({ azimuth: 180, altitude: 30 }, { ...c, space: "opening" }),
    ).toBe(false);
    const clear = calculate(c),
      blocked = calculate({
        ...c,
        buildings: [{ ...b, width: 20, height: 50 }],
      });
    expect(blocked.sunMinutes).toBeLessThan(clear.sunMinutes);
    expect(blocked.dayMinutes).toBe(clear.dayMinutes);
    expect(blocked.sun.length).toBeGreaterThan(1);
  });
});
