import { describe, it, expect } from "vitest";
import recorded from "./fixtures/eccc-cloud-point.json";
import {
  cloudCoordinates,
  consensus,
  expandTimes,
  freshRun,
  nearestTime,
  parseNws,
  parsePoint,
  pointUrl,
  products,
  type CloudPoint,
} from "../src/weather/clouds";
const t = Date.parse("2026-10-13T15:00:00Z"),
  run = Date.parse("2026-10-13T00:00:00Z");
function raw(value: unknown = 56) {
  return {
    layer: products[0].layer,
    features: [
      {
        properties: {
          value,
          time: new Date(t).toISOString(),
          dim_reference_time: new Date(run).toISOString(),
        },
        geometry: { coordinates: [-63.6, 44.7] },
      },
    ],
  };
}
describe("cloud products and evidence contracts", () => {
  it("parses an independently fetched official GDPS response with provenance", () => {
    const point = parsePoint(
      recorded,
      products[0],
      t,
      Date.parse("2026-10-12T12:00:00Z"),
    );
    expect(point.value).toBe(56);
    expect(point.grid).toEqual([44.7, -63.6]);
    expect(recorded.provenance.kind).toContain("not an observation");
  });
  it("accepts recorded ECCC percent data with exact valid and run times", () => {
    expect(parsePoint(raw(), products[0], t, run)).toEqual({
      model: products[0].label,
      family: "ECCC GEM",
      value: 56,
      valid: t,
      run,
      grid: [44.7, -63.6],
    });
  });
  it("rejects missing cloud truth, sentinel, strings and wrong product/run", () => {
    for (const v of [null, -9999, "56", 101, NaN])
      expect(() => parsePoint(raw(v), products[0], t, run)).toThrow();
    expect(() => parsePoint(raw(), products[1], t, run)).toThrow();
    expect(() => parsePoint(raw(), products[0], t + 3600000, run)).toThrow();
    expect(() => parsePoint(raw(), products[0], t, run + 3600000)).toThrow();
  });
  it("parses explicit and interval UTC availability without extrapolation", () => {
    const times = expandTimes("2026-10-13T00:00:00Z/2026-10-13T06:00:00Z/PT3H");
    expect(times).toEqual([run, run + 3 * 3600000, run + 6 * 3600000]);
    expect(expandTimes("bad,2026-10-13T00:00:00Z")).toEqual([run]);
    expect(nearestTime(times, run + 3600000)).toBe(run);
    expect(nearestTime(times, run - 1)).toBeNull();
    expect(nearestTime(times, run + 7 * 3600000)).toBeNull();
    expect(nearestTime([run, run + 6 * 3600000], run + 3 * 3600000)).toBeNull();
  });
  it("groups related models so duplicate family forecasts cannot dominate", () => {
    const p = (value: number, family: string): CloudPoint => ({
      value,
      family,
      model: "test",
      run,
      valid: t,
    });
    const result = consensus([
      p(10, "GEM"),
      p(20, "GEM"),
      p(30, "GEM"),
      p(80, "NWS"),
    ]);
    expect(result).toEqual({ mean: 50, families: 2, min: 10, max: 80 });
    expect(consensus([])).toBeNull();
    expect(consensus([p(0, "GEM")])?.mean).toBe(0);
  });
  it("pins WMS times, axis order and rounded coordinates", () => {
    expect(cloudCoordinates(44.6488, -63.5752)).toEqual({
      lat: 44.65,
      lon: -63.58,
    });
    const q = new URL(pointUrl(products[0].layer, 44.6488, -63.5752, t, run))
      .searchParams;
    expect(q.get("CRS")).toBe("EPSG:4326");
    const box = q.get("BBOX")!.split(",").map(Number);
    expect((box[0] + box[2]) / 2).toBeCloseTo(44.65);
    expect((box[1] + box[3]) / 2).toBeCloseTo(-63.58);
    expect(q.get("TIME")).toBe("2026-10-13T15:00:00Z");
    expect(q.get("DIM_REFERENCE_TIME")).toBe("2026-10-13T00:00:00Z");
  });
  it("rejects stale/future runs and interprets NWS validity as intervals", () => {
    expect(freshRun(run, run + 24 * 3600000)).toBe(true);
    expect(freshRun(run, run + 25 * 3600000)).toBe(false);
    expect(freshRun(run, run - 1)).toBe(false);
    const nws = {
      properties: {
        updateTime: new Date(run).toISOString(),
        skyCover: {
          uom: "wmoUnit:percent",
          values: [{ validTime: "2026-10-13T12:00:00Z/PT6H", value: 70 }],
        },
      },
    };
    expect(parseNws(nws, t, t).value).toBe(70);
    expect(() =>
      parseNws(nws, Date.parse("2026-10-13T18:00:00Z"), t),
    ).toThrow();
    expect(() => parseNws(nws, t, run + 25 * 3600000)).toThrow();
    nws.properties.skyCover.values[0].value = null as unknown as number;
    expect(() => parseNws(nws, t, t)).toThrow();
  });
});
