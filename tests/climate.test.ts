import { it, expect } from "vitest";
import {
  parseClimate,
  climateCoordinates,
  climateUrl,
} from "../src/utils/climate";
it("coarsens coordinates before an explicit NASA request", () => {
  expect(climateCoordinates(44.6488, -63.5752)).toEqual({
    lat: 44.5,
    lon: -63.75,
  });
  expect(climateUrl(44.6488, -63.5752)).not.toContain("44.6488");
});
it("honors provider units, missing values and climatology period", () => {
  const r = {
    properties: { parameter: { T2M: { JAN: 2, FEB: -999, MAR: 0 } } },
    header: { fill_value: -999, range: "2001–2025" },
    parameters: { T2M: { units: "C" } },
  };
  const p = parseClimate(r, 0, 0);
  expect(p.means.slice(0, 3)).toEqual([2, null, 0]);
  expect(p.period).toBe("2001–2025");
  expect(() =>
    parseClimate({ ...r, parameters: { T2M: { units: "F" } } }, 0, 0),
  ).toThrow();
});
