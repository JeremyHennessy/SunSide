import React, { useState, useMemo, useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  calculate,
  clock,
  today,
  duration,
  position,
  qualifies,
  skyPoint,
  type Config,
} from "./solar/engine";
import "./style.css";
const places = [
  ["Halifax example", 44.6488, -63.5752, "America/Halifax"],
  ["New York", 40.7128, -74.006, "America/New_York"],
  ["London", 51.5074, -0.1278, "Europe/London"],
  ["Sydney", -33.8688, 151.2093, "Australia/Sydney"],
  ["Singapore", 1.3521, 103.8198, "Asia/Singapore"],
  ["Tromsø", 69.6492, 18.9553, "Europe/Oslo"],
] as const;
const initial: Config = {
  lat: 44.6488,
  lon: -63.5752,
  zone: "America/Halifax",
  date: today("America/Halifax"),
  facing: 225,
  horizon: 0,
};
const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
function App() {
  const [c, setC] = useState(initial),
    [minute, setMinute] = useState(720),
    [playing, setPlaying] = useState(false),
    [message, setMessage] = useState(
      "Halifax example · choose your own location",
    ),
    [error, setError] = useState("");
  const update = (patch: Partial<Config>) => {
    setC((s) => ({ ...s, ...patch }));
    setPlaying(false);
  };
  const data = useMemo(() => calculate(c), [c]);
  const selected =
    data.start + Math.min(minute, (data.end - data.start) / 60000 - 1) * 60000;
  const p = position(selected, c.lat, c.lon),
    point = skyPoint(p),
    visible = qualifies(p, c.facing, c.horizon);
  const seasons = useMemo(
    () =>
      ["03-20", "06-21", "09-22", "12-21"].map((d, i) => {
        const labels =
          c.lat >= 0
            ? ["Spring", "Summer", "Autumn", "Winter"]
            : ["Autumn", "Winter", "Spring", "Summer"];
        return {
          label: labels[i],
          date: c.date.slice(0, 4) + "-" + d,
          result: calculate({ ...c, date: c.date.slice(0, 4) + "-" + d }),
        };
      }),
    [c],
  );
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(
      () => setMinute((m) => (m + 5) % ((data.end - data.start) / 60000)),
      100,
    );
    return () => clearInterval(id);
  }, [playing, data.start, data.end]);
  function locate() {
    setMessage("Waiting for your browser location permission…");
    navigator.geolocation.getCurrentPosition(
      (s) => {
        update({ lat: s.coords.latitude, lon: s.coords.longitude });
        setMessage(
          "Device coordinates · confirm the location’s time zone below",
        );
      },
      (e) => setMessage(e.message),
      { timeout: 10000 },
    );
  }
  function save() {
    try {
      localStorage.setItem("sunside", JSON.stringify(c));
      setMessage("Settings saved only in this browser.");
    } catch {
      setMessage("Browser storage is unavailable.");
    }
  }
  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem("sunside") || "null");
      if (!saved) throw Error();
      if (
        !Number.isFinite(saved.lat) ||
        Math.abs(saved.lat) > 90 ||
        !Number.isFinite(saved.lon) ||
        Math.abs(saved.lon) > 180 ||
        !Number.isFinite(saved.facing) ||
        saved.facing < 0 ||
        saved.facing > 359 ||
        !Number.isFinite(saved.horizon) ||
        saved.horizon < 0 ||
        saved.horizon > 89
      )
        throw Error();
      calculate(saved);
      setC(saved);
      setMessage("Loaded your saved settings.");
    } catch {
      setMessage("No valid saved settings found.");
    }
  }
  return (
    <>
      <header>
        <a className="brand" href="/">
          <img src="/sun.svg" alt="" />
          SunSide<span>Know your sunny side.</span>
        </a>
        <a href="#learn">A little sun wisdom ↗</a>
      </header>
      <main>
        <section className="intro">
          <span className="eyebrow">YOUR SPACE. YOUR SUNSHINE.</span>
          <h1>
            Find your place
            <br />
            in the sun.
          </h1>
          <p>
            See when sunlight could reach your balcony, window or patio.
            <br className="desktop" /> Pick a direction. Follow the sun. Plan a
            better day.
          </p>
        </section>
        <div className="planner">
          <aside className="controls">
            <div className="card-title">
              <span>01</span>
              <h2>Make it your space</h2>
            </div>
            <label>
              Location
              <select
                aria-label="Location"
                onChange={(e) => {
                  const v = places[Number(e.target.value)];
                  update({ lat: v[1], lon: v[2], zone: v[3] });
                  setMessage(v[0] + " · preset location");
                }}
                value={String(
                  places.findIndex(
                    (v) => v[1] === c.lat && v[2] === c.lon && v[3] === c.zone,
                  ),
                )}
              >
                <option value="-1" disabled>
                  Custom coordinates
                </option>
                {places.map((v, i) => (
                  <option value={i} key={v[0]}>
                    {v[0]}
                  </option>
                ))}
              </select>
            </label>
            <div className="two">
              <label>
                Latitude
                <input
                  type="number"
                  min="-90"
                  max="90"
                  step="0.0001"
                  key={c.lat}
                  defaultValue={c.lat}
                  onBlur={(e) => {
                    const v = Number(e.target.value);
                    if (e.target.value && v >= -90 && v <= 90) {
                      update({ lat: v });
                      setMessage(
                        "Custom coordinates · confirm the location’s time zone below",
                      );
                      setError("");
                    } else {
                      e.target.value = String(c.lat);
                      setError("Latitude must be between −90 and 90°.");
                    }
                  }}
                />
              </label>
              <label>
                Longitude
                <input
                  type="number"
                  min="-180"
                  max="180"
                  step="0.0001"
                  key={c.lon}
                  defaultValue={c.lon}
                  onBlur={(e) => {
                    const v = Number(e.target.value);
                    if (e.target.value && v >= -180 && v <= 180) {
                      update({ lon: v });
                      setMessage(
                        "Custom coordinates · confirm the location’s time zone below",
                      );
                      setError("");
                    } else {
                      e.target.value = String(c.lon);
                      setError("Longitude must be between −180 and 180°.");
                    }
                  }}
                />
              </label>
            </div>
            <button className="secondary" onClick={locate}>
              ◎ Use my location
            </button>
            <label>
              Location time zone
              <input
                list="zones"
                key={c.zone}
                defaultValue={c.zone}
                onBlur={(e) => {
                  try {
                    today(e.target.value);
                    update({ zone: e.target.value });
                    setError("");
                  } catch {
                    setError(
                      "Enter a valid IANA zone, such as America/Halifax.",
                    );
                  }
                }}
              />
              <datalist id="zones">
                {Intl.supportedValuesOf("timeZone").map((z) => (
                  <option key={z} value={z} />
                ))}
              </datalist>
            </label>
            {error && <p role="alert">{error}</p>}
            <p className="hint" role="status">
              {message}
            </p>
            <div className="divider" />
            <label>Which way does your space face?</label>
            <div className="directions">
              {dirs.map((d, i) => (
                <button
                  key={d}
                  className={c.facing === i * 45 ? "active" : ""}
                  onClick={() => update({ facing: i * 45 })}
                >
                  {d}
                </button>
              ))}
            </div>
            <label className="bearing">
              Exact bearing{" "}
              <input
                aria-label="Exact bearing"
                type="number"
                min="0"
                max="359"
                value={c.facing}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (v >= 0 && v <= 359) update({ facing: v });
                }}
              />
              <span>° true north</span>
            </label>
            <p className="hint">
              Face outward through the opening, away from the building. That
              direction is your bearing.
            </p>
            <div className="divider" />
            <label>
              Date
              <input
                type="date"
                min="1900-01-01"
                max="2100-12-31"
                value={c.date}
                onChange={(e) => {
                  if (e.target.value) update({ date: e.target.value });
                }}
              />
            </label>
            <button
              className="text-button"
              onClick={() => update({ date: today(c.zone) })}
            >
              Return to today ↗
            </button>
            <label>
              Horizon obstruction <strong>{c.horizon}°</strong>
              <input
                type="range"
                min="0"
                max="89"
                value={c.horizon}
                onChange={(e) => update({ horizon: Number(e.target.value) })}
              />
            </label>
            <p className="hint">
              0° = clear horizon. Raise this angle to model a uniform
              obstruction blocking the lower sky.
            </p>
          </aside>
          <section className="simulation">
            <div className="sim-top">
              <span className="eyebrow">THE SUN, FROM YOUR SIDE</span>
              <span className="badge">
                {p.altitude <= 0
                  ? "Below horizon"
                  : visible
                    ? "Potential direct sun"
                    : "Outside your facing side"}
              </span>
            </div>
            <div className="sky">
              <svg
                viewBox="0 0 400 400"
                role="img"
                aria-label={`Sun azimuth ${p.azimuth.toFixed(1)} degrees, altitude ${p.altitude.toFixed(1)} degrees. Bearings clockwise from north.`}
              >
                <defs>
                  <radialGradient id="sky">
                    <stop stopColor="#365c6b" />
                    <stop offset="1" stopColor="#183d4c" />
                  </radialGradient>
                </defs>
                <circle
                  cx="200"
                  cy="200"
                  r="150"
                  fill="url(#sky)"
                  stroke="#64808b"
                />
                {[50, 100].map((r) => (
                  <circle
                    key={r}
                    cx="200"
                    cy="200"
                    r={r}
                    fill="none"
                    stroke="#486674"
                    strokeDasharray="3 6"
                  />
                ))}
                <path
                  d={`M200 200 L${200 + 150 * Math.sin(((c.facing - 90) * Math.PI) / 180)} ${200 - 150 * Math.cos(((c.facing - 90) * Math.PI) / 180)} A150 150 0 0 1 ${200 + 150 * Math.sin(((c.facing + 90) * Math.PI) / 180)} ${200 - 150 * Math.cos(((c.facing + 90) * Math.PI) / 180)} Z`}
                  fill="#ffce65"
                  opacity=".09"
                />
                {data.samples
                  .filter((s) => s.altitude > 0)
                  .map((s, i) => {
                    const q = skyPoint(s);
                    return (
                      <circle
                        key={i}
                        cx={q.x}
                        cy={q.y}
                        r="2"
                        fill={s.visible ? "#ffce65" : "#789ba8"}
                      />
                    );
                  })}
                <line
                  x1="200"
                  y1="200"
                  x2={200 + 130 * Math.sin((c.facing * Math.PI) / 180)}
                  y2={200 - 130 * Math.cos((c.facing * Math.PI) / 180)}
                  stroke="#b7d6e0"
                  strokeWidth="2"
                />
                <circle cx="200" cy="200" r="7" fill="#b7d6e0" />
                {p.altitude > 0 && (
                  <>
                    <line
                      x1="200"
                      y1="200"
                      x2={point.x}
                      y2={point.y}
                      stroke="#ffce65"
                      strokeDasharray="4 5"
                    />
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r="17"
                      fill="#ffce65"
                      opacity=".15"
                    />
                    <circle cx={point.x} cy={point.y} r="9" fill="#ffce65" />
                  </>
                )}
                {[
                  ["N", 200, 29],
                  ["E", 374, 205],
                  ["S", 200, 382],
                  ["W", 26, 205],
                ].map(([d, x, y]) => (
                  <text
                    key={d}
                    x={x}
                    y={y}
                    textAnchor="middle"
                    fill="#d7e9ed"
                    fontSize="14"
                  >
                    {d}
                  </text>
                ))}
                <text x="205" y="154" fill="#9bb9c4" fontSize="10">
                  60°
                </text>
                <text x="205" y="105" fill="#9bb9c4" fontSize="10">
                  30°
                </text>
              </svg>
              <div className="sky-caption">
                <span>Looking down on the sky</span>
                <span>Center = overhead · edge = horizon</span>
              </div>
            </div>
            <div className="time-control">
              <button
                aria-label={playing ? "Pause animation" : "Play animation"}
                onClick={() => setPlaying(!playing)}
              >
                {playing ? "Ⅱ" : "▶"}
              </button>
              <div>
                <strong>{clock(selected, c.zone)}</strong>
                <span>
                  {c.zone} · {c.date}
                </span>
              </div>
              <div className="angles" aria-label="Solar angles">
                <span>{p.altitude.toFixed(1)}° altitude</span>
                <span>{p.azimuth.toFixed(1)}° azimuth</span>
              </div>
            </div>
            <input
              className="time-slider"
              aria-label="Time of day"
              type="range"
              min="0"
              max={(data.end - data.start) / 60000 - 1}
              step="1"
              value={Math.min(minute, (data.end - data.start) / 60000 - 1)}
              onChange={(e) => {
                setMinute(Number(e.target.value));
                setPlaying(false);
              }}
            />
            <div className="slider-labels">
              <span>Start of local day</span>
              <span>End of local day</span>
            </div>
            <div className="legend">
              <span>
                <i className="yellow" />
                Potential sun
              </span>
              <span>
                <i />
                Other daylight
              </span>
              <span>True-north bearings</span>
            </div>
          </section>
        </div>
        <section className="results">
          <div className="result-heading">
            <div>
              <span className="eyebrow">YOUR DAY AT A GLANCE</span>
              <h2>A little more clarity.</h2>
            </div>
            <p>Geometric potential · estimates in 5-minute steps</p>
          </div>
          <div className="stats">
            <article>
              <span>Potential direct sun</span>
              <strong>≈ {duration(data.sunMinutes)}</strong>
              <p>On the outward-facing side of your space</p>
            </article>
            <article>
              <span>First / last possible sun</span>
              <strong className="small">
                {data.sun.length
                  ? clock(data.sun[0].start, c.zone) +
                    " / " +
                    clock(data.sun.at(-1)!.end, c.zone)
                  : "No qualifying sunlight"}
              </strong>
              <p>See individual intervals below</p>
            </article>
            <article>
              <span>Daylight above horizon</span>
              <strong>≈ {duration(data.dayMinutes)}</strong>
              <p>
                {data.dayMinutes === 0
                  ? "Sun remains below horizon"
                  : data.dayMinutes === (data.end - data.start) / 60000
                    ? "Sun remains above horizon all day"
                    : "Sun center above the apparent horizon"}
              </p>
            </article>
          </div>
          <div
            className="timeline"
            role="img"
            aria-label="Daily potential sunlight timeline"
          >
            {data.samples.map((s, i) => (
              <span
                key={i}
                style={{
                  background: s.visible
                    ? "#e9b846"
                    : s.daylight
                      ? "#9bbcc7"
                      : "#e1e6e5",
                }}
              />
            ))}
          </div>
          <div className="slider-labels">
            <span>{clock(data.start, c.zone)}</span>
            <span>{clock(data.end, c.zone)} (next day)</span>
          </div>
          <ul className="intervals">
            {data.sun.map((i, n) => (
              <li key={n}>
                ☀ {clock(i.start, c.zone)} – {clock(i.end, c.zone)}
              </li>
            ))}
          </ul>
          <div className="assumption">
            <strong>Potential sunshine, with a clear explanation.</strong>
            <p>
              This models the sun above your horizon and in front of a vertical
              opening. Trees, buildings, clouds, balcony depth and overhangs can
              change what actually reaches your space. Your obstruction angle is
              a simplified assumption, not verified building geometry.
            </p>
          </div>
        </section>
        <section className="season-section">
          <span className="eyebrow">A DIFFERENT SEASON, A DIFFERENT STORY</span>
          <h2>Follow the year’s light.</h2>
          <p>
            Representative equinox and solstice dates for your hemisphere. Dates
            are approximate, not exact astronomical event instants.
          </p>
          <div className="seasons">
            {seasons.map((s) => (
              <button key={s.date} onClick={() => update({ date: s.date })}>
                <span>{s.label} ↗</span>
                <strong>{duration(s.result.sunMinutes)}</strong>
                <div className="bar">
                  <i
                    style={{ width: (s.result.sunMinutes / 1440) * 100 + "%" }}
                  />
                </div>
                <small>{s.date} · potential sun</small>
              </button>
            ))}
          </div>
        </section>
        <section id="learn" className="learn">
          <span className="eyebrow">SUN WISDOM</span>
          <h2>Small details. Brighter decisions.</h2>
          <div className="guides">
            <article>
              <h3>Does a north-facing balcony get sun?</h3>
              <p>
                It can. At northern latitudes, summer sunrise and sunset can
                fall north of east and west. In the Southern Hemisphere,
                north-facing spaces often receive more midday sun. Latitude,
                season and your opening matter more than a simple rule.
              </p>
            </article>
            <article>
              <h3>Why does the season change everything?</h3>
              <p>
                The Earth’s tilt changes the sun’s daily arc. A higher summer
                sun and longer days can create very different exposure from
                winter. June is summer in the north and winter in the south.
                Explore both before choosing a space.
              </p>
            </article>
            <article>
              <h3>What does this estimate tell me?</h3>
              <p>
                Facing the sun is a starting point. A patio umbrella, roof or
                nearby tree may block it. Window light entering a room also
                depends on dimensions. Use this planner to compare directions,
                then check your real space on site.
              </p>
            </article>
          </div>
        </section>
        <section className="storage">
          <button onClick={save}>Save in this browser</button>
          <button className="secondary" onClick={load}>
            Load saved settings
          </button>
          <button
            className="text-button"
            onClick={() => {
              localStorage.removeItem("sunside");
              setC(initial);
              setMessage("Saved settings deleted. Halifax example restored.");
            }}
          >
            Delete & reset
          </button>
        </section>
      </main>
      <footer>
        <nav aria-label="SunSide guides">
          <a href="/guides/balcony-direction/">Balcony direction</a> ·{" "}
          <a href="/guides/seasons/">Seasonal sunlight</a> ·{" "}
          <a href="/guides/understanding-estimates/">Understanding estimates</a>{" "}
          · <a href="/privacy/">Privacy</a> · <a href="/terms/">Terms</a> ·{" "}
          <a href="/suncalc-license.txt">Solar library license</a>
        </nav>
        <a className="brand" href="/">
          ☀ SunSide
        </a>
        <p>More light on everyday decisions.</p>
        <details>
          <summary>Privacy & terms</summary>
          <p>
            Calculations run in your browser. SunSide does not send your
            coordinates to a location service. Geolocation runs only when you
            request it. Saving stores your configuration on this device; delete
            it with Delete & reset. Hosting providers may process routine
            request logs. No analytics, ads or affiliate tracking are installed.
            Estimates are informational and are not a guarantee of actual
            exposure or a property assessment.
          </p>
        </details>
        <p>
          Solar calculations:{" "}
          <a href="https://github.com/mourner/suncalc">
            SunCalc 2.1.1 (BSD-2-Clause)
          </a>{" "}
          · <a href="https://gml.noaa.gov/grad/solcalc/">NOAA reference</a>
        </p>
      </footer>
    </>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
