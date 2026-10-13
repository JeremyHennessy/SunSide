export type CloudPoint = {
  model: string;
  family: string;
  value: number;
  valid: number;
  run: number;
  grid?: [number, number];
  layers?: { low: number | null; medium: number | null; high: number | null };
};
export type CloudProduct = { layer: string; label: string; family: string };
export const products: CloudProduct[] = [
  {
    layer: "GDPS_15km_TotalCloudCover",
    label: "GDPS · 15 km",
    family: "ECCC GEM",
  },
  {
    layer: "RDPS_10km_TotalCloudCover",
    label: "RDPS · 10 km",
    family: "ECCC GEM",
  },
  {
    layer: "HRDPS.CONTINENTAL_NT",
    label: "HRDPS · 2.5 km",
    family: "ECCC GEM",
  },
];
export type Availability = { times: number[]; run: number; bounds: number[] };
const hour = 3600000;
export type MetForecast = {
  properties?: {
    meta?: { updated_at?: string; units?: Record<string, string> };
    timeseries?: {
      time?: string;
      data?: { instant?: { details?: Record<string, unknown> } };
    }[];
  };
};
export function parseMet(
  raw: unknown,
  target: number,
  now: number,
): CloudPoint {
  const r = raw as MetForecast,
    meta = r.properties?.meta;
  const updated = Date.parse(meta?.updated_at || "");
  if (!freshRun(updated, now) || meta?.units?.cloud_area_fraction !== "%")
    throw Error("Stale or unexpected MET Norway product.");
  const rows = r.properties?.timeseries || [];
  const times = rows
    .map((r) => Date.parse(r.time || ""))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  const valid = nearestTime(times, target);
  if (valid === null) throw Error("No MET forecast for this hour.");
  const details = rows.find((r) => Date.parse(r.time || "") === valid)?.data
    ?.instant?.details;
  const number = (field: string) => {
    const v = details?.[field];
    return meta?.units?.[field] === "%" &&
      typeof v === "number" &&
      Number.isFinite(v) &&
      v >= 0 &&
      v <= 100
      ? v
      : null;
  };
  const value = number("cloud_area_fraction");
  if (value === null) throw Error("Missing MET total cloud cover.");
  return {
    model: "MET Norway · location forecast",
    family: "MET Norway",
    value,
    run: updated,
    valid,
    layers: {
      low: number("cloud_area_fraction_low"),
      medium: number("cloud_area_fraction_medium"),
      high: number("cloud_area_fraction_high"),
    },
  };
}
const metCache = new Map<string, { expires: number; raw: unknown }>();
let metThrottledUntil = 0;
export async function loadMet(
  lat: number,
  lon: number,
  target: number,
  signal: AbortSignal,
  now = Date.now(),
) {
  const c = cloudCoordinates(lat, lon),
    key = `${c.lat},${c.lon}`;
  if (now < metThrottledUntil) throw Error("MET Norway rate limit cooldown.");
  let cached = metCache.get(key);
  if (!cached || cached.expires <= now) {
    // Simple browser request: the browser's Origin identifies SunSide. No custom headers/preflight.
    const url =
      "https://api.met.no/weatherapi/locationforecast/2.0/complete?" +
      new URLSearchParams({ lat: String(c.lat), lon: String(c.lon) });
    const response = await fetch(url, { ...requestOptions, signal });
    if (response.status === 429) {
      metThrottledUntil = now + 10 * 60000;
      throw Error("MET Norway rate limit cooldown.");
    }
    if (!response.ok) throw Error("MET Norway unavailable.");
    if (response.status === 203) throw Error("MET product deprecated.");
    const expires = Date.parse(response.headers.get("Expires") || "");
    const maxAge = /max-age=(\d+)/i.exec(
      response.headers.get("Cache-Control") || "",
    );
    cached = {
      raw: await response.json(),
      expires: Number.isFinite(expires)
        ? expires
        : now + (maxAge ? Number(maxAge[1]) * 1000 : 15 * 60000),
    };
    metCache.set(key, cached);
    if (metCache.size > 32) metCache.delete(metCache.keys().next().value!);
  }
  return parseMet(cached.raw, target, now);
}
export function cloudCoordinates(lat: number, lon: number) {
  return { lat: Math.round(lat * 100) / 100, lon: Math.round(lon * 100) / 100 };
}
// GeoMet lists either explicit UTC instants or start/end/PTnH intervals.
export function expandTimes(text: string): number[] {
  const out: number[] = [];
  for (const part of text.trim().split(",")) {
    if (part.includes("/")) {
      const [a, b, step] = part.split("/");
      const hours = /^PT(\d+(?:\.\d+)?)H$/.exec(step || "");
      const start = Date.parse(a),
        end = Date.parse(b);
      const stride = hours ? Number(hours[1]) * hour : NaN;
      if (
        !Number.isFinite(start + end + stride) ||
        stride <= 0 ||
        end < start ||
        (end - start) / stride > 1000
      )
        continue;
      for (let t = start; t <= end; t += stride) out.push(t);
    } else {
      const t = Date.parse(part);
      if (Number.isFinite(t)) out.push(t);
    }
  }
  return [...new Set(out)].sort((a, b) => a - b);
}
export function nearestTime(times: number[], target: number) {
  if (!times.length || target < times[0] || target > times[times.length - 1])
    return null;
  const t = times.reduce((a, b) =>
    Math.abs(b - target) < Math.abs(a - target) ? b : a,
  );
  return Math.abs(t - target) <= 90 * 60000 ? t : null;
}
export function parseAvailability(xml: string, layer: string): Availability {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) throw Error("Invalid capabilities.");
  const el = Array.from(doc.getElementsByTagNameNS("*", "Layer")).find((l) =>
    Array.from(l.children).some(
      (n) => n.localName === "Name" && n.textContent === layer,
    ),
  );
  if (!el) throw Error("Cloud product not available.");
  const dimensions = Array.from(el.children).filter(
    (n) => n.localName === "Dimension",
  );
  const time = dimensions.find((n) => n.getAttribute("name") === "time");
  const run = Date.parse(
    dimensions
      .find((n) => n.getAttribute("name") === "reference_time")
      ?.getAttribute("default") || "",
  );
  const box = el.getElementsByTagNameNS("*", "EX_GeographicBoundingBox")[0];
  const bounds = [
    "westBoundLongitude",
    "eastBoundLongitude",
    "southBoundLatitude",
    "northBoundLatitude",
  ].map((n) =>
    Number(box?.getElementsByTagNameNS("*", n)[0]?.textContent ?? NaN),
  );
  const times = expandTimes(time?.textContent || "");
  if (
    !times.length ||
    !Number.isFinite(run) ||
    bounds.some((b) => !Number.isFinite(b))
  )
    throw Error("Missing forecast time or domain.");
  return { times, run, bounds };
}
export function inDomain(a: Availability, lat: number, lon: number) {
  return (
    lon >= a.bounds[0] &&
    lon <= a.bounds[1] &&
    lat >= a.bounds[2] &&
    lat <= a.bounds[3]
  );
}
export function capabilitiesUrl(layer: string) {
  return (
    "https://geo.weather.gc.ca/geomet?" +
    new URLSearchParams({
      SERVICE: "WMS",
      VERSION: "1.3.0",
      REQUEST: "GetCapabilities",
      LAYERS: layer,
    })
  );
}
export function pointUrl(
  layer: string,
  lat: number,
  lon: number,
  valid: number,
  run: number,
) {
  const c = cloudCoordinates(lat, lon);
  // WMS 1.3 EPSG:4326 axis order is latitude, longitude. Odd pixel count puts the query at the center.
  return (
    "https://geo.weather.gc.ca/geomet?" +
    new URLSearchParams({
      SERVICE: "WMS",
      VERSION: "1.3.0",
      REQUEST: "GetFeatureInfo",
      LAYERS: layer,
      QUERY_LAYERS: layer,
      CRS: "EPSG:4326",
      BBOX: `${c.lat - 0.01},${c.lon - 0.01},${c.lat + 0.01},${c.lon + 0.01}`,
      WIDTH: "101",
      HEIGHT: "101",
      I: "50",
      J: "50",
      INFO_FORMAT: "application/json",
      FORMAT: "image/png",
      TIME: new Date(valid).toISOString().replace(".000Z", "Z"),
      DIM_REFERENCE_TIME: new Date(run).toISOString().replace(".000Z", "Z"),
    })
  );
}
export function parsePoint(
  raw: unknown,
  product: CloudProduct,
  valid: number,
  run: number,
): CloudPoint {
  const r = raw as {
    layer?: string;
    features?: {
      properties?: {
        value?: unknown;
        time?: string;
        dim_reference_time?: string;
      };
      geometry?: { coordinates?: number[] };
    }[];
  };
  if (r.layer !== product.layer || r.features?.length !== 1)
    throw Error("Unexpected forecast product.");
  const f = r.features[0],
    p = f.properties;
  const value = p?.value;
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 100 ||
    Date.parse(p?.time || "") !== valid ||
    Date.parse(p?.dim_reference_time || "") !== run
  )
    throw Error("Missing, invalid or mismatched forecast.");
  const coords = f.geometry?.coordinates;
  return {
    model: product.label,
    family: product.family,
    value,
    valid,
    run,
    grid:
      coords?.length === 2 && coords.every(Number.isFinite)
        ? [coords[1], coords[0]]
        : undefined,
  };
}
export function consensus(points: CloudPoint[]) {
  const families = new Map<string, number[]>();
  for (const p of points) {
    const values = families.get(p.family) || [];
    values.push(p.value);
    families.set(p.family, values);
  }
  const means = [...families.values()].map(
    (v) => v.reduce((a, b) => a + b, 0) / v.length,
  );
  if (!means.length) return null;
  return {
    mean: means.reduce((a, b) => a + b, 0) / means.length,
    families: means.length,
    min: Math.min(...points.map((p) => p.value)),
    max: Math.max(...points.map((p) => p.value)),
  };
}
export function freshRun(run: number, now: number) {
  return run <= now && now - run <= 24 * hour;
}
export function parseNws(
  raw: unknown,
  target: number,
  now: number,
): CloudPoint {
  const r = raw as {
    properties?: {
      updateTime?: string;
      skyCover?: {
        uom?: string;
        values?: { validTime?: string; value?: unknown }[];
      };
    };
  };
  const p = r.properties,
    run = Date.parse(p?.updateTime || "");
  if (!freshRun(run, now) || p?.skyCover?.uom !== "wmoUnit:percent")
    throw Error("Stale or unexpected NWS forecast.");
  for (const row of p.skyCover.values || []) {
    const [stamp, duration] = (row.validTime || "").split("/");
    const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/.exec(duration || "");
    const start = Date.parse(stamp),
      span = m
        ? (Number(m[1] || 0) * 24 +
            Number(m[2] || 0) +
            Number(m[3] || 0) / 60) *
          hour
        : 0;
    if (
      target >= start &&
      target < start + span &&
      typeof row.value === "number" &&
      Number.isFinite(row.value) &&
      row.value >= 0 &&
      row.value <= 100
    )
      return {
        model: "NWS · forecaster grid",
        family: "NWS forecast",
        value: row.value,
        valid: start,
        run,
      };
  }
  throw Error("No NWS cloud forecast for this time.");
}
const requestOptions: RequestInit = {
  credentials: "omit",
  referrerPolicy: "no-referrer",
};
async function request(url: string, signal: AbortSignal) {
  const r = await fetch(url, { ...requestOptions, signal });
  if (!r.ok) throw Error("Weather service unavailable.");
  return r;
}
const availabilityCache = new Map<
  string,
  { at: number; value: Availability }
>();
export async function getAvailability(
  layer: string,
  signal: AbortSignal,
  now = Date.now(),
) {
  const cached = availabilityCache.get(layer);
  if (cached && now - cached.at < 15 * 60000) return cached.value;
  const value = parseAvailability(
    await (await request(capabilitiesUrl(layer), signal)).text(),
    layer,
  );
  availabilityCache.set(layer, { at: now, value });
  if (availabilityCache.size > 32)
    availabilityCache.delete(availabilityCache.keys().next().value!);
  return value;
}
export async function loadEccc(
  product: CloudProduct,
  lat: number,
  lon: number,
  target: number,
  signal: AbortSignal,
  now = Date.now(),
) {
  const a = await getAvailability(product.layer, signal, now);
  const c = cloudCoordinates(lat, lon),
    valid = nearestTime(a.times, target);
  if (!inDomain(a, c.lat, c.lon) || valid === null || !freshRun(a.run, now))
    throw Error("Outside product coverage or run too old.");
  return parsePoint(
    await (
      await request(pointUrl(product.layer, lat, lon, valid, a.run), signal)
    ).json(),
    product,
    valid,
    a.run,
  );
}
export async function loadNws(
  lat: number,
  lon: number,
  target: number,
  signal: AbortSignal,
  now = Date.now(),
) {
  const c = cloudCoordinates(lat, lon);
  const p = await (
    await request(`https://api.weather.gov/points/${c.lat},${c.lon}`, signal)
  ).json();
  const grid = p?.properties?.forecastGridData;
  if (
    typeof grid !== "string" ||
    !/^https:\/\/api\.weather\.gov\/gridpoints\/[A-Z]{3}\/\d+,\d+$/.test(grid)
  )
    throw Error("Outside NWS coverage.");
  return parseNws(await (await request(grid, signal)).json(), target, now);
}
export async function loadEnsemble(
  lat: number,
  lon: number,
  target: number,
  signal: AbortSignal,
  now = Date.now(),
) {
  const a = await getAvailability("REPS.MEM.ETA_NT.01", signal, now);
  const valid = nearestTime(a.times, target),
    c = cloudCoordinates(lat, lon);
  if (valid === null || !inDomain(a, c.lat, c.lon) || !freshRun(a.run, now))
    throw Error("Outside regional ensemble coverage.");
  const rows: CloudPoint[] = [];
  let cursor = 1;
  // A user-requested point probe, not a background crawler. At most three requests in flight.
  await Promise.all(
    Array.from({ length: 3 }, async () => {
      while (cursor <= 21 && !signal.aborted) {
        const n = cursor++;
        const product = {
          layer: `REPS.MEM.ETA_NT.${String(n).padStart(2, "0")}`,
          label: `REPS member ${n}`,
          family: "ECCC GEM",
        };
        try {
          rows.push(
            parsePoint(
              await (
                await request(
                  pointUrl(product.layer, lat, lon, valid, a.run),
                  signal,
                )
              ).json(),
              product,
              valid,
              a.run,
            ),
          );
        } catch {
          /* Missing members stay missing. */
        }
      }
    }),
  );
  if (signal.aborted) throw Error("Ensemble request cancelled.");
  return rows.sort((a, b) => a.value - b.value);
}
