import {
  wallAndShadow,
  buildingBlocks,
  shadowLength,
  type Building,
  validBuilding,
} from "../solar/shadows";
import { type Config, type Position } from "../solar/engine";
export function BuildingPlanner({
  c,
  p,
  onChange,
}: {
  c: Config;
  p: Position;
  onChange: (patch: Partial<Config>) => void;
}) {
  const buildings = c.buildings || [];
  function edit(i: number, key: keyof Building, value: number) {
    onChange({
      buildings: buildings.map((b, n) =>
        n === i ? { ...b, [key]: value } : b,
      ),
    });
  }
  return (
    <section className="building-section">
      <span className="eyebrow">WHAT’S BETWEEN YOU AND THE SUN?</span>
      <h2>Give nearby buildings a shape.</h2>
      <p>
        Measure from one point on your patio. Add a building’s near wall, facing
        that point. The model treats each wall as a flat, opaque rectangle on
        level ground. No building measurements are guessed.
      </p>
      <p className="hint">
        An open patio can receive sun from every direction. Facing direction
        applies only to the balcony/window mode. This estimates a single point,
        not the sunny percentage of a whole patio.
      </p>
      {buildings.length === 0 ? (
        <p className="hint">
          No building geometry supplied. The existing horizon assumption still
          applies.
        </p>
      ) : (
        buildings.map((b, i) => {
          const g = wallAndShadow(p, b);
          const scale =
            130 /
            Math.max(
              b.distance + b.width / 2,
              Math.min(shadowLength(p, b) || 0, 200) + b.distance,
              10,
            );
          const q = (v: { x: number; y: number }) =>
            `${200 + v.x * scale},${200 - v.y * scale}`;
          return (
            <article className="building-card" key={i}>
              <div>
                <h3>Building {i + 1}</h3>
                <div className="building-fields">
                  {(
                    [
                      ["bearing", "Bearing toward building (°)", 0, 359],
                      ["distance", "Distance to near wall (m)", 0.1, 10000],
                      ["width", "Wall width (m)", 0.1, 10000],
                      ["height", "Top height above ground (m)", 0, 2000],
                      ["pointHeight", "Patio point above ground (m)", 0, 2000],
                    ] as const
                  ).map(([key, label, min, max]) => (
                    <label key={key}>
                      {label}
                      <input
                        type="number"
                        min={min}
                        max={max}
                        step="0.1"
                        key={`${i}-${key}-${b[key]}`}
                        defaultValue={b[key]}
                        onBlur={(e) => {
                          const n = Number(e.target.value);
                          if (
                            e.target.value &&
                            Number.isFinite(n) &&
                            n >= min &&
                            n <= max
                          )
                            edit(i, key, n);
                          else e.target.value = String(b[key]);
                        }}
                      />
                    </label>
                  ))}
                </div>
                <button
                  className="text-button"
                  onClick={() =>
                    onChange({ buildings: buildings.filter((_, n) => n !== i) })
                  }
                >
                  Remove building {i + 1}
                </button>
                <p className="hint">
                  {!validBuilding(b)
                    ? "Enter distance, width and top height to use this building."
                    : p.altitude <= 0
                      ? "Sun below horizon."
                      : buildingBlocks(p, b)
                        ? "This wall blocks the selected patio point at this time."
                        : "This wall does not block the selected point at this time."}{" "}
                  {validBuilding(b) &&
                    p.altitude > 0 &&
                    `Projected shadow length at the patio’s height: ≈ ${shadowLength(p, b)!.toFixed(1)} m.`}
                </p>
              </div>
              <div className="building-diagram">
                <svg
                  viewBox="0 0 400 400"
                  role="img"
                  aria-label={`Building ${i + 1} measured wall and projected shadow. ${buildingBlocks(p, b) ? "Selected point blocked" : "Selected point not blocked"}.`}
                >
                  <defs>
                    <clipPath id={`wallClip${i}`}>
                      <rect x="30" y="30" width="340" height="340" />
                    </clipPath>
                  </defs>
                  <rect
                    x="30"
                    y="30"
                    width="340"
                    height="340"
                    rx="16"
                    fill="#eff2e9"
                  />
                  <g clipPath={`url(#wallClip${i})`}>
                    {g.polygon.length > 0 && (
                      <polygon
                        points={g.polygon.map(q).join(" ")}
                        fill="#ce8553"
                        opacity=".35"
                      />
                    )}
                    <polyline
                      points={g.wall.map(q).join(" ")}
                      stroke="#163744"
                      strokeWidth="8"
                    />
                    <circle
                      cx="200"
                      cy="200"
                      r="7"
                      fill={buildingBlocks(p, b) ? "#9e5334" : "#b88712"}
                    />
                    <line
                      x1="200"
                      y1="200"
                      x2={200 + 100 * Math.sin((p.azimuth * Math.PI) / 180)}
                      y2={200 - 100 * Math.cos((p.azimuth * Math.PI) / 180)}
                      stroke="#b88712"
                      strokeDasharray="4 5"
                    />
                  </g>
                  <text x="200" y="22" textAnchor="middle" fill="#163744">
                    N
                  </text>
                  <text x="200" y="390" textAnchor="middle" fill="#163744">
                    Patio point ● · wall ━ · shadow area
                  </text>
                </svg>
                <p className="hint">
                  Top-down wall projection, north up. Long shadows can extend
                  beyond the view. Trees, roofs, wall depth and terrain are
                  excluded.
                </p>
              </div>
            </article>
          );
        })
      )}
      <button
        className="secondary"
        disabled={buildings.length >= 5}
        onClick={() =>
          onChange({
            buildings: [
              ...buildings,
              {
                bearing: c.facing,
                distance: 0,
                width: 0,
                height: 0,
                pointHeight: 0,
              },
            ],
          })
        }
      >
        Add a measured building
      </button>
      <p className="hint">
        Enter your measurements. Buildings with missing distance, width or
        height are ignored. These are not real map data.
      </p>
    </section>
  );
}
