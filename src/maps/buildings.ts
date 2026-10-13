import { PMTiles, FetchSource } from "pmtiles";
import { VectorTile } from "@mapbox/vector-tile";
import { PbfReader } from "pbf";
import { project, type MappedBuilding, type BuildingMap } from "./geometry";
export const RELEASE = "2026-09-23.1";
export const BUILDINGS_URL = `https://overturemaps-extras-us-west-2.s3.us-west-2.amazonaws.com/tiles/${RELEASE}/buildings.pmtiles`;
const source = new FetchSource(BUILDINGS_URL);
const archive = new PMTiles({
  getKey: () => source.getKey(),
  getBytes: (offset, length, signal, etag) =>
    source.getBytes(
      offset,
      length,
      signal
        ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
        : AbortSignal.timeout(15000),
      etag,
    ),
});
const cache = new Map<string, Promise<unknown[]>>();
export function tileXY(lat: number, lon: number, z: number) {
  const n = 2 ** z;
  return {
    x: Math.floor(((lon + 180) / 360) * n),
    y: Math.floor(
      ((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2) * n,
    ),
  };
}
export function parseFeature(
  feature: unknown,
  lat: number,
  lon: number,
  part = false,
): MappedBuilding | null {
  const f = feature as {
    properties?: Record<string, unknown>;
    geometry?: { type: string; coordinates: unknown };
  };
  const p = f.properties;
  if (!p || !f.geometry || p.is_underground === true) return null;
  const raw =
    f.geometry.type === "Polygon"
      ? [f.geometry.coordinates]
      : f.geometry.type === "MultiPolygon"
        ? f.geometry.coordinates
        : [];
  if (!Array.isArray(raw)) return null;
  const rings: MappedBuilding["rings"] = [];
  for (const poly of raw) {
    if (!Array.isArray(poly)) return null;
    for (const ring of poly) {
      if (!Array.isArray(ring) || ring.length < 4) return null;
      const points = [];
      for (const pair of ring) {
        if (
          !Array.isArray(pair) ||
          !Number.isFinite(pair[0]) ||
          !Number.isFinite(pair[1])
        )
          return null;
        points.push(project(pair[0], pair[1], lon, lat));
      }
      rings.push(points);
    }
  }
  if (!rings.length) return null;
  const h = p.height;
  return {
    id: String(p.id || ""),
    rings,
    height:
      typeof h === "number" && Number.isFinite(h) && h > 0 && h <= 2000
        ? h
        : null,
    minHeight:
      typeof p.min_height === "number" &&
      Number.isFinite(p.min_height) &&
      p.min_height >= 0
        ? p.min_height
        : 0,
    source: String(p["@geometry_source"] || "Overture contributors"),
    heightSource: String(p["@height_source"] || "Overture dataset"),
    hasParts: p.has_parts === true,
    part,
  };
}
async function tile(z: number, x: number, y: number) {
  const key = `${z}/${x}/${y}`;
  if (cache.has(key)) return cache.get(key)!;
  const job = (async () => {
    const response = await archive.getZxy(z, x, y);
    if (!response) return [];
    const data = new VectorTile(new PbfReader(new Uint8Array(response.data)));
    const features = [];
    for (const name of ["building", "building_part"]) {
      const layer = data.layers[name];
      if (layer)
        for (let i = 0; i < layer.length; i++) {
          const f = layer.feature(i).toGeoJSON(x, y, z);
          f.properties = { ...f.properties, _part: name === "building_part" };
          features.push(f);
        }
    }
    return features;
  })();
  cache.set(key, job);
  if (cache.size > 24) cache.delete(cache.keys().next().value!);
  try {
    return await job;
  } catch (e) {
    cache.delete(key);
    throw e;
  }
}
export async function loadBuildings(
  lat: number,
  lon: number,
  signal?: AbortSignal,
): Promise<BuildingMap> {
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    Math.abs(lat) > 85 ||
    Math.abs(lon) > 180
  )
    throw Error("Building map coverage is unavailable at this latitude.");
  const radius = 600,
    z = 14,
    n = 2 ** z,
    dy = radius / 111195,
    dx = dy / Math.cos((lat * Math.PI) / 180);
  const a = tileXY(lat + dy, lon - dx, z),
    b = tileXY(lat - dy, lon + dx, z);
  const features: unknown[] = [];
  // Sequential tile requests, bounded small area. PMTiles reads only HTTP ranges.
  for (let x = a.x; x <= b.x; x++)
    for (let y = a.y; y <= b.y; y++) {
      signal?.throwIfAborted();
      features.push(...(await tile(z, ((x % n) + n) % n, y)));
    }
  signal?.throwIfAborted();
  const seen = new Set<string>(),
    buildings: MappedBuilding[] = [];
  for (const f of features) {
    const part =
      (f as { properties: Record<string, unknown> }).properties._part === true;
    const building = parseFeature(f, lat, lon, part);
    if (!building) continue;
    // Keep all tile fragments (same id can be clipped at tile boundaries).
    const signature = building.id + JSON.stringify(building.rings);
    if (seen.has(signature)) continue;
    seen.add(signature);
    const points = building.rings.flat();
    if (
      Math.min(...points.map((p) => p.x)) > radius ||
      Math.max(...points.map((p) => p.x)) < -radius ||
      Math.min(...points.map((p) => p.y)) > radius ||
      Math.max(...points.map((p) => p.y)) < -radius
    )
      continue;
    buildings.push(building);
  }
  return { lat, lon, radius, release: RELEASE, buildings };
}
