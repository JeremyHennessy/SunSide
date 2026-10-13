import { describe, it, expect, vi } from "vitest";
import {
  contains,
  mappedBlocks,
  project,
  shadowShift,
  projectedShadow,
  type MappedBuilding,
} from "../src/maps/geometry";
import { parseFeature, loadBuildings } from "../src/maps/buildings";
import ranges from "./fixtures/overture-ranges.json";
const box = (x0: number, y0: number, x1: number, y1: number) => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
  { x: x0, y: y0 },
];
const building = (
  rings: MappedBuilding["rings"],
  height: number | null = 20,
): MappedBuilding => ({
  id: "analytic",
  rings,
  height,
  minHeight: 0,
  source: "analytic fixture",
  heightSource: "analytic fixture",
  part: false,
  hasParts: false,
});
describe("mapped polygon extrusion, independent analytic cases", () => {
  it("blocks a north building until solar ray clears its 20m wall at 10m", () => {
    const b = building([box(-5, 10, 5, 20)]);
    expect(mappedBlocks({ azimuth: 0, altitude: 45 }, b)).toBe(true);
    expect(mappedBlocks({ azimuth: 360, altitude: 45 }, b)).toBe(true);
    expect(mappedBlocks({ azimuth: 0, altitude: 70 }, b)).toBe(false);
    expect(mappedBlocks({ azimuth: 180, altitude: 45 }, b)).toBe(false);
    expect(mappedBlocks({ azimuth: 0, altitude: -1 }, b)).toBe(false);
  });
  it("uses complete footprint, concave geometry and courtyard holes", () => {
    const rings = [box(-20, -20, 20, 20), box(-10, -10, 10, 10)];
    expect(contains(rings)).toBe(false);
    expect(contains(rings, { x: 15, y: 0 })).toBe(true);
    expect(mappedBlocks({ azimuth: 90, altitude: 45 }, building(rings))).toBe(
      true,
    );
    expect(mappedBlocks({ azimuth: 90, altitude: 80 }, building(rings))).toBe(
      false,
    );
    const concave = building(
      [
        [
          { x: -10, y: 10 },
          { x: -2, y: 10 },
          { x: -2, y: 25 },
          { x: 2, y: 25 },
          { x: 2, y: 10 },
          { x: 10, y: 10 },
          { x: 10, y: 30 },
          { x: -10, y: 30 },
        ],
      ],
      20,
    );
    expect(mappedBlocks({ azimuth: 0, altitude: 45 }, concave)).toBe(false);
  });
  it("does not invent missing heights or ground-level walls for raised structures", () => {
    const b = building([box(-5, 10, 5, 20)], null);
    expect(mappedBlocks({ azimuth: 0, altitude: 5 }, b)).toBe(false);
    const raised = { ...b, height: 5, minHeight: 30 };
    expect(mappedBlocks({ azimuth: 0, altitude: 45 }, raised)).toBe(false);
    expect(mappedBlocks({ azimuth: 0, altitude: 65 }, raised)).toBe(true);
  });
  it("maps 20m shadows opposite east sun and handles the date line", () => {
    const s = shadowShift({ azimuth: 90, altitude: 45 }, 20);
    expect(s.x).toBeCloseTo(-20, 8);
    expect(s.y).toBeCloseTo(0, 8);
    expect(project(-179.999, 0, 179.999, 0).x).toBeCloseTo(222.39, 2);
  });
  it("projects raised roofs and walls from their actual lower height", () => {
    const b = { ...building([box(10, -5, 20, 5)], 10), minHeight: 20 };
    const shadow = projectedShadow({ azimuth: 90, altitude: 45 }, b);
    expect(shadow.roof[0][0].x).toBeCloseTo(-20, 8);
    expect(Math.min(...shadow.sides.flat().map((p) => p.x))).toBeCloseTo(
      -20,
      8,
    );
    expect(Math.max(...shadow.sides.flat().map((p) => p.x))).toBeCloseTo(0, 8);
    expect(projectedShadow({ azimuth: 90, altitude: -1 }, b).sides).toEqual([]);
  });
  it("parses metres only and refuses floor-count height guesses", () => {
    const geometry = {
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [0.001, 0],
          [0.001, 0.001],
          [0, 0],
        ],
      ],
    };
    expect(
      parseFeature({ geometry, properties: { num_floors: 30 } }, 0, 0)?.height,
    ).toBe(null);
    expect(
      parseFeature({ geometry, properties: { height: "50" } }, 0, 0)?.height,
    ).toBe(null);
    expect(
      parseFeature({ geometry, properties: { height: 50 } }, 0, 0)?.height,
    ).toBe(50);
    expect(
      parseFeature(
        { geometry, properties: { is_underground: true, height: 50 } },
        0,
        0,
      ),
    ).toBe(null);
  });
  it("decodes real pinned Overture tiles and retains unknown height coverage", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: unknown, init?: RequestInit) => {
        const range = new Headers(init?.headers).get("range");
        const r = ranges.find((r) => r.range === range);
        if (!r) throw Error("Unexpected fixture range " + range);
        return new Response(Buffer.from(r.base64, "base64"), {
          status: r.status,
          headers: r.headers,
        });
      }),
    );
    try {
      const map = await loadBuildings(44.6488, -63.5752);
      expect(map.buildings.length).toBeGreaterThan(30);
      expect(map.buildings.some((b) => b.height !== null)).toBe(true);
      expect(map.buildings.some((b) => b.height === null)).toBe(true);
      expect(map.buildings.some((b) => b.part)).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
