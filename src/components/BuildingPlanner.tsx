import { useEffect, useRef, useState } from "react";
import { type Config, type Position } from "../solar/engine";
import { contains, mappedBlocks, projectedShadow } from "../maps/geometry";
export function BuildingPlanner({
  c,
  p,
  onChange,
}: {
  c: Config;
  p: Position;
  onChange: (patch: Partial<Config>) => void;
}) {
  const callback = useRef(onChange);
  callback.current = onChange;
  const [status, setStatus] = useState("Loading nearby public building data…"),
    [zoom, setZoom] = useState(200),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setStatus("Loading nearby public building data…");
    callback.current({ mapped: undefined, buildings: undefined });
    import("../maps/buildings")
      .then((m) => m.loadBuildings(c.lat, c.lon, controller.signal))
      .then((mapped) => {
        if (cancelled) return;
        callback.current({ mapped });
        setStatus("");
      })
      .catch(() => {
        if (!cancelled)
          setStatus(
            "Building data unavailable. Solar potential still works; nearby shadows are unknown.",
          );
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [c.lat, c.lon, retry]);
  const map =
    c.mapped?.lat === c.lat && c.mapped.lon === c.lon ? c.mapped : undefined;
  const buildings = map?.buildings || [];
  const known = buildings.filter((b) => b.height !== null),
    unknown = buildings.filter((b) => b.height === null);
  const inside = buildings.some((b) => contains(b.rings));
  const blocked = known.some((b) => mappedBlocks(p, b));
  const xy = (v: { x: number; y: number }) =>
    `${250 + (v.x * 230) / zoom},${250 - (v.y * 230) / zoom}`;
  const path = (rings: (typeof buildings)[number]["rings"]) =>
    rings.map((r) => `M${r.map(xy).join(" L")} Z`).join(" ");
  function move(x: number, y: number) {
    callback.current({
      space: "patio",
      lat: c.lat + y / 111195,
      lon:
        ((c.lon + x / (111195 * Math.cos((c.lat * Math.PI) / 180)) + 540) %
          360) -
        180,
    });
  }
  return (
    <section className="building-section" aria-labelledby="map-title">
      <span className="eyebrow">NEARBY BUILDINGS · AUTOMATICALLY</span>
      <h2 id="map-title">Put your patio on the map.</h2>
      <p>
        Public building outlines and recorded heights load automatically for
        your location. Tap the map to place your patio point. No building
        measurements needed.
      </p>
      <div className="mapped-layout">
        <div className="mapped-map">
          <svg
            viewBox="0 0 500 500"
            role="img"
            aria-label="Nearby mapped building footprints and calculated ground-level shadows, north up"
            onClick={(e) => {
              if (!map) return;
              const r = e.currentTarget.getBoundingClientRect();
              move(
                ((((e.clientX - r.left) / r.width) * 500 - 250) * zoom) / 230,
                (-(((e.clientY - r.top) / r.height) * 500 - 250) * zoom) / 230,
              );
            }}
          >
            <defs>
              <clipPath id="mapped-clip">
                <rect x="20" y="20" width="460" height="460" rx="22" />
              </clipPath>
              <pattern
                id="unknown-height"
                width="8"
                height="8"
                patternUnits="userSpaceOnUse"
              >
                <rect width="8" height="8" fill="#e2e7e5" />
                <path d="M0 8L8 0" stroke="#8c9e9d" strokeWidth="1" />
              </pattern>
            </defs>
            <rect
              x="20"
              y="20"
              width="460"
              height="460"
              rx="22"
              fill="#edf1e7"
            />
            <g clipPath="url(#mapped-clip)">
              {[100, 175, 250, 325, 400].map((v) => (
                <path
                  key={v}
                  d={`M20 ${v}H480 M${v} 20V480`}
                  stroke="#dae2d8"
                  strokeWidth="1"
                />
              ))}
              {p.altitude > 0 &&
                known.map((b, i) => {
                  const shadow = projectedShadow(p, b);
                  return (
                    <g key={`s${i}`} fill="#657c86" opacity=".3">
                      <path d={path(shadow.roof)} fillRule="evenodd" />
                      <path d={path(shadow.sides)} fillRule="nonzero" />
                    </g>
                  );
                })}
              {buildings.map((b, i) => (
                <path
                  key={i}
                  d={path(b.rings)}
                  fill={b.height === null ? "url(#unknown-height)" : "#274854"}
                  stroke="#f9fbf4"
                  strokeWidth="1"
                  fillRule="evenodd"
                >
                  <title>
                    {b.height === null
                      ? "Height unknown"
                      : `Recorded height ${b.height.toFixed(1)} m`}{" "}
                    · {b.source} · {b.heightSource}
                  </title>
                </path>
              ))}
              <line
                x1="250"
                y1="250"
                x2={250 + 85 * Math.sin((p.azimuth * Math.PI) / 180)}
                y2={250 - 85 * Math.cos((p.azimuth * Math.PI) / 180)}
                stroke="#ae7700"
                strokeWidth="3"
                strokeDasharray="5 5"
              />
              <circle
                cx="250"
                cy="250"
                r="11"
                fill={blocked ? "#a85636" : "#f0bd48"}
                stroke="#fff"
                strokeWidth="4"
              />
            </g>
            <text x="250" y="16" textAnchor="middle" fill="#163744">
              N
            </text>
            <text x="36" y="461" fill="#163744" fontSize="14">
              {zoom} m from center to edge
            </text>
          </svg>
          <div className="map-controls">
            <button
              className="secondary"
              onClick={() => setZoom((z) => Math.max(50, z / 2))}
              disabled={zoom <= 50}
              aria-label="Zoom in on buildings"
            >
              +
            </button>
            <button
              className="secondary"
              onClick={() => setZoom((z) => Math.min(600, z * 2))}
              disabled={zoom >= 600}
              aria-label="Zoom out on buildings"
            >
              −
            </button>
            <span>Patio point ● · sun direction ┄</span>
          </div>
        </div>
        <div className="mapped-details">
          {c.space !== "patio" && (
            <button
              className="secondary"
              onClick={() => onChange({ space: "patio" })}
            >
              Use mapped ground-level patio mode
            </button>
          )}
          <p className="map-status" role="status">
            {status ||
              (inside
                ? "Your point is inside a mapped building. Tap an outdoor patio or use the point controls below."
                : p.altitude <= 0
                  ? "Sun below the horizon."
                  : blocked
                    ? "A mapped building blocks this ground-level point."
                    : "No known mapped building blocks this point. Missing heights may still hide shadows.")}
          </p>
          {map && (
            <>
              <div className="map-counts">
                <strong>
                  {known.length}
                  <small>outlines with heights</small>
                </strong>
                <strong>
                  {unknown.length}
                  <small>heights unknown</small>
                </strong>
              </div>
              <p className="hint">
                Shadows use recorded heights, which may themselves be estimates.
                Hatched outlines have no usable height and are excluded.
                Buildings with parts use simplified extrusions; rooftop shape is
                not resolved.
              </p>
            </>
          )}
          <fieldset className="map-point">
            <legend>Move patio point 10 metres</legend>
            <div className="map-controls">
              {[
                ["North", 0, 10],
                ["East", 10, 0],
                ["South", 0, -10],
                ["West", -10, 0],
              ].map(([label, x, y]) => (
                <button
                  className="secondary"
                  key={label}
                  onClick={() => move(Number(x), Number(y))}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
          <p className="hint">
            Ground-level patio estimate · level terrain · buildings within 600
            m. Trees, roof overhangs, elevated balconies and distant shadows are
            not resolved. This is partial mapped coverage, not verified actual
            exposure.
          </p>
          {status.includes("unavailable") && (
            <button
              className="secondary"
              onClick={() => setRetry((n) => n + 1)}
            >
              Retry building lookup
            </button>
          )}
          <p className="hint">
            Map tiles load from Overture’s public archive, revealing the
            surrounding map area to its host. Coordinates are not sent as a
            search query. <a href="/privacy/">Privacy</a>
          </p>
          <p className="map-attribution">
            ©{" "}
            <a href="https://docs.overturemaps.org/attribution/">
              Overture Maps contributors
            </a>{" "}
            · ©{" "}
            <a href="https://www.openstreetmap.org/copyright">
              OpenStreetMap contributors
            </a>{" "}
            · <a href="https://opendatacommons.org/licenses/odbl/1-0/">ODbL</a>
            <br />
            Release {map?.release || "2026-09-23.1"} ·{" "}
            <a href="https://docs.overturemaps.org/examples/overture-tiles/">
              Source data
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
