import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { type Config, type Position } from "../solar/engine";
import { projectedShadow, type XY } from "../maps/geometry";
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
    overlays = useRef<L.LayerGroup | null>(null);
  const callback = useRef(onChange);
  callback.current = onChange;
  const [failed, setFailed] = useState(false);
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
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
      keepBuffer: 0,
      updateWhenIdle: true,
    })
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
      for (const b of c.mapped.buildings) {
        if (b.height !== null && p.altitude > 0) {
          const s = projectedShadow(p, b);
          L.polygon(
            [...s.roof, ...s.sides].map((r) => r.map(ll)),
            {
              stroke: false,
              fillColor: "#344b5b",
              fillOpacity: 0.16,
              fillRule: "nonzero",
              interactive: false,
            },
          ).addTo(group);
        }
        L.polygon(
          b.rings.map((r) => r.map(ll)),
          {
            color: b.height === null ? "#84643e" : "#214b60",
            weight: 1,
            fillOpacity: 0.08,
            dashArray: b.height === null ? "3 4" : undefined,
            interactive: false,
          },
        ).addTo(group);
      }
    }
    L.circleMarker([c.lat, c.lon], {
      radius: 9,
      color: "#163744",
      weight: 3,
      fillColor: "#f4c348",
      fillOpacity: 1,
      interactive: false,
    })
      .bindTooltip("Patio point", {
        permanent: true,
        direction: "top",
        offset: [0, -9],
      })
      .addTo(group);
  }, [c.lat, c.lon, c.mapped, p.azimuth, p.altitude]);
  return (
    <>
      <div
        ref={host}
        className="street-map"
        role="group"
        aria-label="OpenStreetMap street map. Drag to explore, tap to select your patio. Arrow keys pan the map."
      />
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
        yellow marker is your selected point, not a detected location.{" "}
        <a href="https://www.openstreetmap.org/fixthemap">Report a map issue</a>
      </p>
    </>
  );
}
