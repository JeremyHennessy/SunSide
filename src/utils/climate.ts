export const months = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];
export type Climate = {
  means: (number | null)[];
  period: string;
  source: string;
  lat: number;
  lon: number;
};
export function climateCoordinates(lat: number, lon: number) {
  return { lat: Math.round(lat * 2) / 2, lon: Math.round(lon / 0.625) * 0.625 };
}
export function climateUrl(lat: number, lon: number) {
  const c = climateCoordinates(lat, lon);
  return (
    "https://power.larc.nasa.gov/api/temporal/climatology/point?" +
    new URLSearchParams({
      parameters: "T2M",
      community: "AG",
      latitude: String(c.lat),
      longitude: String(c.lon),
      format: "JSON",
    })
  );
}
export function parseClimate(raw: unknown, lat: number, lon: number): Climate {
  const r = raw as {
    properties?: { parameter?: { T2M?: Record<string, unknown> } };
    header?: { range?: string; fill_value?: number };
    parameters?: { T2M?: { units?: string } };
  };
  if (
    r.parameters?.T2M?.units !== "C" ||
    !r.properties?.parameter?.T2M ||
    typeof r.header?.range !== "string"
  )
    throw Error("Unexpected climate response.");
  const means = months.map((m) => {
    const v = r.properties!.parameter!.T2M![m];
    return typeof v === "number" &&
      Number.isFinite(v) &&
      v !== r.header?.fill_value &&
      v >= -100 &&
      v <= 70
      ? v
      : null;
  });
  if (means.every((v) => v === null))
    throw Error("No temperature averages available for this region.");
  return {
    means,
    period: r.header.range,
    source: "NASA POWER / MERRA-2",
    ...climateCoordinates(lat, lon),
  };
}
