import { useState } from "react";
import {
  climateCoordinates,
  climateUrl,
  parseClimate,
  months,
  type Climate,
} from "../utils/climate";
const cache = new Map<string, Climate>();
export function ClimateCard({
  lat,
  lon,
  date,
}: {
  lat: number;
  lon: number;
  date: string;
}) {
  const coords = climateCoordinates(lat, lon);
  const key = `${coords.lat},${coords.lon}`;
  const [data, setData] = useState<{ key: string; value: Climate } | null>(
      null,
    ),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const current = data?.key === key ? data.value : null;
  const month = Number(date.slice(5, 7)) - 1;
  async function load() {
    setLoading(true);
    setError("");
    try {
      let value = cache.get(key);
      if (!value) {
        const response = await fetch(climateUrl(lat, lon), {
          signal: AbortSignal.timeout(20000),
          credentials: "omit",
          referrerPolicy: "no-referrer",
        });
        if (!response.ok)
          throw Error("Climate service is temporarily unavailable.");
        value = parseClimate(await response.json(), lat, lon);
        cache.set(key, value);
        if (cache.size > 32) cache.delete(cache.keys().next().value!);
      }
      setData({ key, value });
    } catch {
      setError(
        "Could not load regional climate averages. Try again later. Your sunlight model still works.",
      );
    } finally {
      setLoading(false);
    }
  }
  return (
    <section className="climate-section">
      <span className="eyebrow">SUNSHINE IS ONLY PART OF THE STORY</span>
      <h2>What does this month usually feel like?</h2>
      <p>
        Optional monthly temperature averages from NASA POWER. Regional
        reanalysis data on a roughly 50 × 70 km grid—not a forecast, a patio
        thermometer, or a guarantee of comfortable conditions.
      </p>
      {!current && (
        <>
          <p className="hint">
            Loading sends the rounded regional coordinates {coords.lat}°,{" "}
            {coords.lon}° and your network request to NASA. Your precise entered
            coordinates are not sent. No request runs until you choose to load.
          </p>
          <button disabled={loading} onClick={load}>
            {loading
              ? "Loading regional averages…"
              : "Load regional climate averages"}
          </button>
        </>
      )}
      {error && <p role="status">{error}</p>}
      {current && (
        <>
          <p>
            <strong>
              {months[month]} mean temperature:{" "}
              {current.means[month] === null
                ? "Unavailable"
                : `${current.means[month]!.toFixed(1)}°C`}
            </strong>
          </p>
          <div className="climate-months">
            {months.map((m, i) => (
              <div key={m} className={i === month ? "selected" : ""}>
                <span>{m}</span>
                <strong>
                  {current.means[i] === null
                    ? "—"
                    : `${current.means[i]!.toFixed(1)}°`}
                </strong>
              </div>
            ))}
          </div>
          <p className="hint">
            {current.period}. Source:{" "}
            <a href="https://power.larc.nasa.gov/docs/methodology/meteorology/">
              NASA POWER / MERRA-2
            </a>
            . Mean air temperature at 2 m above the grid’s average ground
            elevation. This does not combine multiple forecasts; they may share
            source data and averaging them can hide uncertainty.
          </p>
        </>
      )}
    </section>
  );
}
