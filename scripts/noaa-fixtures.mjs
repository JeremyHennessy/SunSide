// Independent low-accuracy NOAA reference, not imported by the app or tests.
// https://gml.noaa.gov/grad/solcalc/solareqns.PDF
// Geometric altitude; allows 1.5° against SunCalc apparent position.
import { writeFileSync } from "node:fs";
const rad = Math.PI / 180;
const sites = [
  ["Halifax", 44.6488, -63.5752, 14],
  ["New York", 40.7128, -74.006, 15],
  ["London", 51.5074, -0.1278, 10],
  ["Sydney", -33.8688, 151.2093, 0],
  ["Singapore", 1.3521, 103.8198, 2],
  ["Tromsø", 69.6492, 18.9553, 9],
];
const fixtures = [];
for (const [name, lat, lon, hour] of sites)
  for (const day of ["03-20", "06-21", "09-22", "12-21"]) {
    const utc = `2026-${day}T${String(hour).padStart(2, "0")}:00:00Z`;
    const n =
      (Date.parse(utc) - Date.UTC(2026, 0, 1)) / 86400000 + 1 - hour / 24;
    const g = ((2 * Math.PI) / 365) * (n - 1 + (hour - 12) / 24);
    const eq =
      229.18 *
      (0.000075 +
        0.001868 * Math.cos(g) -
        0.032077 * Math.sin(g) -
        0.014615 * Math.cos(2 * g) -
        0.040849 * Math.sin(2 * g));
    const decl =
      0.006918 -
      0.399912 * Math.cos(g) +
      0.070257 * Math.sin(g) -
      0.006758 * Math.cos(2 * g) +
      0.000907 * Math.sin(2 * g) -
      0.002697 * Math.cos(3 * g) +
      0.00148 * Math.sin(3 * g);
    const ha = ((hour * 60 + eq + 4 * lon) / 4) * rad - Math.PI;
    const zenith = Math.acos(
      Math.sin(lat * rad) * Math.sin(decl) +
        Math.cos(lat * rad) * Math.cos(decl) * Math.cos(ha),
    );
    const altitude = 90 - zenith / rad;
    const azimuth =
      (((Math.atan2(
        Math.sin(ha),
        Math.cos(ha) * Math.sin(lat * rad) -
          Math.tan(decl) * Math.cos(lat * rad),
      ) /
        rad +
        180) %
        360) +
        360) %
      360;
    fixtures.push({
      name,
      lat,
      lon,
      utc,
      altitude,
      azimuth,
      tolerance: 1.5,
      source: "https://gml.noaa.gov/grad/solcalc/solareqns.PDF",
    });
  }
writeFileSync(
  "tests/noaa-fixtures.json",
  JSON.stringify(fixtures, null, 2) + "\n",
);
