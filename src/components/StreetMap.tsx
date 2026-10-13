import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { type Config, type Position } from "../solar/engine";
import { mappedBlocks, projectedShadow, type XY } from "../maps/geometry";
export default function StreetMap({
  c,
  p,
  onChange,
  onLocate,
}: {
  c: Config;
  p: Position;
  onChange: (patch: Partial<Config>) => void;
  onLocate: () => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    map = useRef<L.Map | null>(null),
    tiles = useRef<L.TileLayer | null>(null),
    overlays = useRef<L.LayerGroup | null>(null);
  const callback = useRef(onChange);
  callback.current = onChange;
  const [failed, setFailed] = useState(false);
  const [streetDetail, setStreetDetail] = useState(70);
  const [showShadows, setShowShadows] = useState(true);
  useEffect(() => {
    if (!host.current) return;
    const m = L.map(host.current, {
      scrollWheelZoom: false,
      zoomControl: true,
    }).setView([c.lat, c.lon], 17);
    map.current = m;
    m.attributionControl.setPrefix(
      '<a href="https://leafletjs.com">Leaflet</a>',
    );
    overlays.current = L.layerGroup().addTo(m);
    tiles.current = L.tileLayer(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 19,
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
        keepBuffer: 0,
        updateWhenIdle: true,
        opacity: 0.7,
      },
    )
      .on("tileerror", () => setFailed(true))
      .addTo(m);
    L.control.scale({ imperial: false }).addTo(m);
    m.on("click", (e: L.LeafletMouseEvent) =>
      callback.current({
        lat: e.latlng.lat,
        lon: e.latlng.wrap().lng,
        space: "patio",
      }),
    );
    const resize = new ResizeObserver(() => m.invalidateSize());
    resize.observe(host.current);
    return () => {
      resize.disconnect();
      m.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    tiles.current?.setOpacity(streetDetail / 100);
  }, [streetDetail]);
  useEffect(() => {
    const m = map.current,
      group = overlays.current;
    if (!m || !group) return;
    if (m.getCenter().distanceTo([c.lat, c.lon]) > 1500)
      m.setView([c.lat, c.lon], 17);
    group.clearLayers();
    const ll = (a: XY): L.LatLngTuple => [
      c.lat + a.y / 111195.08,
      c.lon + a.x / (111195.08 * Math.cos((c.lat * Math.PI) / 180)),
    ];
    if (c.mapped?.lat === c.lat && c.mapped.lon === c.lon) {
      // Draw every shadow first so no adjacent shadow covers a building roof.
      for (const b of c.mapped.buildings) {
        if (showShadows && b.height !== null && p.altitude > 0) {
          const s = projectedShadow(p, b);
          L.polygon(
            [...s.roof, ...s.sides].map((r) => r.map(ll)),
            {
              stroke: false,
              fillColor: "#344b5b",
              fillOpacity: 0.32,
              fillRule: "nonzero",
              className: "calculated-map-shadow",
              interactive: false,
            },
          ).addTo(group);
        }
      }
      for (const b of c.mapped.buildings) {
        L.polygon(
          b.rings.map((r) => r.map(ll)),
          {
            color: b.height === null ? "#84643e" : "#214b60",
            weight: 1.2,
            fillColor: b.height === null ? "#f4eddb" : "#274854",
            fillOpacity: b.height === null ? 0.35 : 0.78,
            dashArray: b.height === null ? "3 4" : undefined,
            interactive: false,
          },
        ).addTo(group);
      }
    }
    if (p.altitude > 0) {
      const angle = (p.azimuth * Math.PI) / 180;
      L.polyline(
        [
          [c.lat, c.lon],
          ll({ x: 55 * Math.sin(angle), y: 55 * Math.cos(angle) }),
        ],
        {
          color: "#9b6500",
          weight: 3,
          dashArray: "6 6",
          interactive: false,
        },
      ).addTo(group);
      L.circleMarker(ll({ x: 55 * Math.sin(angle), y: 55 * Math.cos(angle) }), {
        radius: 6,
        color: "#936300",
        fillColor: "#ffcf57",
        fillOpacity: 1,
        interactive: false,
      })
        .bindTooltip(`Toward the sun · ${Math.round(p.azimuth)}° true`, {
          direction: "top",
        })
        .addTo(group);
    }
    const blocked =
      c.mapped?.lat === c.lat &&
      c.mapped.lon === c.lon &&
      c.mapped.buildings.some((b) => mappedBlocks(p, b));
    L.circleMarker([c.lat, c.lon], {
      radius: 9,
      color: "#163744",
      weight: 3,
      fillColor: blocked ? "#c96542" : "#f4c348",
      fillOpacity: 1,
      interactive: false,
    })
      .bindTooltip("Patio point", {
        permanent: true,
        direction: "top",
        offset: [0, -9],
      })
      .addTo(group);
  }, [c.lat, c.lon, c.mapped, p.azimuth, p.altitude, showShadows]);
  return (
    <>
      <div className="combined-map">
        <div
          ref={host}
          className="street-map"
          role="group"
          aria-label="OpenStreetMap street map. Drag to explore, tap to select your patio. Arrow keys pan the map."
        />
        <span className="map-north" aria-label="North is up">
          ↑ N
        </span>
      </div>
      <div className="map-blend-controls">
        <label htmlFor="street-detail">
          Street detail <output>{streetDetail}%</output>
        </label>
        <input
          id="street-detail"
          type="range"
          min="0"
          max="100"
          step="5"
          value={streetDetail}
          onChange={(e) => setStreetDetail(Number(e.target.value))}
        />
        <label className="map-shadow-toggle">
          <input
            type="checkbox"
            checked={showShadows}
            onChange={(e) => setShowShadows(e.target.checked)}
          />{" "}
          Show calculated shadows
        </label>
      </div>
      <div className="combined-map-legend" aria-label="Map legend">
        <span>
          <i className="legend-building" /> Recorded height
        </span>
        <span>
          <i className="legend-shadow" /> Estimated shadow
        </span>
        <span>
          <i className="legend-unknown" /> Height unknown
        </span>
        <span>
          <i className="legend-sun" /> Toward sun
        </span>
      </div>
      <div className="street-map-actions">
        <button className="secondary" onClick={onLocate}>
          Find me on this map
        </button>
        <button
          className="secondary"
          onClick={() => map.current?.setView([c.lat, c.lon], 17)}
        >
          Center on patio point
        </button>
        <span>
          {c.lat.toFixed(5)}°, {c.lon.toFixed(5)}°
        </span>
      </div>
      {failed && (
        <p className="hint" role="status">
          Some street tiles could not load. The selected point and building
          calculations remain available.
        </p>
      )}
      <p className="hint">
        Drag to explore · pinch or + / − to zoom · tap to place your patio. The
        marker is your selected point, not a detected location. Coral means a
        mapped building blocks it. Adjust street detail to see the shadow
        geometry more clearly; hiding shadows changes the display only.{" "}
        <a href="https://www.openstreetmap.org/fixthemap">Report a map issue</a>
      </p>
    </>
  );
}
