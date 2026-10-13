import { useEffect, useRef, useState } from "react";
import { clock } from "../solar/engine";
import {
  cloudCoordinates,
  consensus,
  loadEccc,
  loadEnsemble,
  loadNws,
  products,
  type CloudPoint,
} from "../weather/clouds";
type Snapshot = {
  key: string;
  points: CloudPoint[];
  missing: string[];
  checked: number;
};
export function CloudCard({
  lat,
  lon,
  instant,
  zone,
}: {
  lat: number;
  lon: number;
  instant: number;
  zone: string;
}) {
  const c = cloudCoordinates(lat, lon),
    target = Math.floor(instant / 3600000) * 3600000;
  const key = `${c.lat},${c.lon},${target}`;
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [ensemble, setEnsemble] = useState<{
    key: string;
    points: CloudPoint[];
  } | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  // A location/hour change cancels in-flight work and clears provider messages.
  useEffect(() => {
    controller.current?.abort();
    controller.current = null;
    setBusy(false);
    setError("");
    return () => controller.current?.abort();
  }, [key]);
  const current = snapshot?.key === key ? snapshot : null;
  const members = ensemble?.key === key ? ensemble.points : null;
  const totalProducts =
    current?.points.filter((p) => p.family === "ECCC GEM") || [];
  // NDFD skyCover forecasts opaque sky cover; GEM total cloud includes visible clouds.
  // Show both, but do not blend different cloud definitions into one number.
  const summary = consensus(totalProducts);
  const outdated = current && Date.now() - current.checked > 15 * 60000;
  async function load(withEnsemble = false) {
    const ctrl = new AbortController();
    controller.current?.abort();
    controller.current = ctrl;
    const timer = setTimeout(() => ctrl.abort(), withEnsemble ? 60000 : 30000);
    setBusy(true);
    setError("");
    try {
      if (withEnsemble) {
        const points = await loadEnsemble(lat, lon, target, ctrl.signal);
        if (!points.length) throw Error("No ensemble members available.");
        if (!ctrl.signal.aborted) setEnsemble({ key, points });
      } else {
        const jobs = products.map((p) => ({
          label: p.label,
          load: () => loadEccc(p, lat, lon, target, ctrl.signal),
        }));
        // Avoid futile NWS requests outside its approximate continental/Alaska/Hawaii domains.
        if (lat >= 18 && lat <= 72 && lon >= -180 && lon <= -65)
          jobs.push({
            label: "NWS",
            load: () => loadNws(lat, lon, target, ctrl.signal),
          });
        const results = await Promise.allSettled(jobs.map((j) => j.load()));
        if (!ctrl.signal.aborted) {
          const points = results.flatMap((r) =>
            r.status === "fulfilled" ? [r.value] : [],
          );
          const missing = jobs
            .filter((_, i) => results[i].status === "rejected")
            .map((j) => j.label);
          setSnapshot({ key, points, missing, checked: Date.now() });
          setEnsemble(null);
          if (!points.length)
            setError(
              "No fresh cloud forecast available for this location and hour. Try a near-future date or refresh later.",
            );
        }
      }
    } catch {
      if (controller.current === ctrl)
        setError(
          "Cloud data could not be loaded. Your solar calculations still work.",
        );
    } finally {
      clearTimeout(timer);
      if (controller.current === ctrl) {
        setBusy(false);
        if (ctrl.signal.aborted)
          setError("Cloud request cancelled or timed out. Try again.");
      }
    }
  }
  return (
    <section className="cloud-section" aria-labelledby="cloud-title">
      <span className="eyebrow">SUN GEOMETRY. CHANGING SKIES.</span>
      <h2 id="cloud-title">Will clouds get in the way?</h2>
      <p>
        Compare fresh cloud forecasts for {clock(target, zone)} ·{" "}
        {new Intl.DateTimeFormat("en-CA", {
          timeZone: zone,
          year: "numeric",
          month: "short",
          day: "numeric",
        }).format(target)}
        . Forecasts describe a grid area, not the exact cloud in front of your
        sun.
      </p>
      <p className="hint">
        Only when you load: rounded coordinates {c.lat}°, {c.lon}° and your
        network request go to ECCC and, for North American coordinates, to NWS
        to check US coverage. No weather request follows the time slider
        automatically.
      </p>
      <button onClick={() => load()} disabled={busy}>
        {busy
          ? "Loading cloud data…"
          : current
            ? "Refresh cloud forecasts"
            : "Load cloud forecasts"}
      </button>
      {error && <p role="status">{error}</p>}
      {current && current.points.length > 0 && (
        <>
          {summary && (
            <>
              <div className="cloud-summary">
                <strong>≈ {Math.round(summary.mean)}% cloud cover</strong>
                <span>
                  Model range {Math.round(summary.min)}–
                  {Math.round(summary.max)}% · {totalProducts.length} products ·{" "}
                  {summary.families} forecast{" "}
                  {summary.families === 1 ? "family" : "families"}
                </span>
              </div>
              <p className="hint">
                ECCC total-cloud mean; related models share one forecast family.
                NWS opaque sky cover is shown separately and is not averaged
                into total cloud. Agreement is not measured accuracy or a
                probability of sunshine.{" "}
                {outdated
                  ? "Loaded more than 15 minutes ago: refresh before planning."
                  : `Loaded ${clock(current.checked, zone)}.`}
              </p>
            </>
          )}
          <div className="cloud-models">
            {current.points.map((p) => (
              <article key={p.model}>
                <div>
                  <strong>
                    {p.model}
                    {p.family === "NWS forecast" ? " · opaque sky" : ""}
                  </strong>
                  <b>{Math.round(p.value)}%</b>
                </div>
                <progress
                  aria-label={`${p.model} forecast cloud cover`}
                  max="100"
                  value={p.value}
                />
                <p className="hint">
                  Valid {clock(p.valid, zone)} · Run/update{" "}
                  {new Intl.DateTimeFormat("en-CA", {
                    timeZone: zone,
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                    timeZoneName: "short",
                  }).format(p.run)}
                  {p.grid
                    ? ` · Grid ${p.grid[0].toFixed(2)}°, ${p.grid[1].toFixed(2)}°`
                    : ""}
                </p>
              </article>
            ))}
          </div>
          {current.missing.length > 0 && (
            <p className="hint">
              Unavailable, outside coverage, or too old:{" "}
              {current.missing.join(", ")}. Missing forecasts are excluded,
              never replaced with clear sky.
            </p>
          )}
          <button
            className="secondary"
            disabled={busy}
            onClick={() => load(true)}
          >
            Compare regional ensemble
          </button>
          <p className="hint">
            Optional: up to 21 ECCC REPS members at the closest available time
            (within 90 minutes), fetched with three requests at a time. Members
            are scenarios from one model family, not 21 independent forecasts.
          </p>
        </>
      )}
      {members && (
        <div className="ensemble-result">
          <h3>Regional ensemble scenarios</h3>
          <p>
            <strong>
              {members.length} of 21 members · {Math.round(members[0].value)}–
              {Math.round(members[members.length - 1].value)}% cloud cover
            </strong>
          </p>
          <p className="hint">
            Valid {clock(members[0].valid, zone)}. Range is across available
            scenarios, not a calibrated confidence interval.{" "}
            {members.length < 21
              ? "Some members are missing; uncertainty may be understated."
              : ""}
          </p>
          <div
            className="ensemble-dots"
            aria-label="Individual ensemble cloud cover percentages"
          >
            {members.map((m) => (
              <span key={m.model} title={m.model}>
                {Math.round(m.value)}%
              </span>
            ))}
          </div>
        </div>
      )}
      <details>
        <summary>How much can I trust this?</summary>
        <p>
          These are raw forecast products, not a locally calibrated cloud model.
          ECCC GEM global, regional and high-resolution forecasts share inputs
          and model lineage. NWS sky cover is an official US forecast product
          and may also use numerical models. Their errors can be correlated. The
          displayed range can miss the true outcome. NWS forecasts opaque sky
          cover, while ECCC reports total cloud cover; the quantities are shown
          separately because thin clouds can transmit sunlight.
        </p>
        <p>
          Cloud fraction is not cloud opacity, solar radiation, or the chance
          the sun is blocked. We do not multiply sunlight hours by “clear-sky
          percentage.” No cloud observations, satellite nowcasting or
          cloud-specific accuracy backtest has been integrated yet. Model runs
          older than 24 hours are rejected; dates outside published forecast
          coverage stay unavailable.
        </p>
        <p>
          Data Source:{" "}
          <a href="https://eccc-msc.github.io/open-data/licence/readme_en/">
            Environment and Climate Change Canada
          </a>
          ;{" "}
          <a href="https://www.weather.gov/documentation/services-web-api">
            National Weather Service
          </a>{" "}
          where available. SunSide is not endorsed by these providers.
        </p>
      </details>
    </section>
  );
}
