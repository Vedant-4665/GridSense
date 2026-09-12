import { useEffect, useRef, useState } from "react";
import { LIMITS } from "../lib/plantForm.js";

const INDIA_VIEW = { center: [22.5, 79], zoom: 4 };
const SITE_ZOOM = 9;
const round = (value) => Number(value.toFixed(LIMITS.coordDecimals));

/**
 * A small slippy map for placing the plant. Leaflet and its stylesheet load on
 * demand, so the rest of the app never pays for them, and anything that goes
 * wrong — no network at the venue, blocked tiles — falls back to the coordinate
 * grid rather than leaving a hole in the page.
 */
export default function SiteMap({ latitude, longitude, onPick, height = 240 }) {
  const holder = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);
  const pick = useRef(onPick);
  pick.current = onPick;
  const [status, setStatus] = useState("loading");   // loading | ready | unavailable

  const placed = Number.isFinite(latitude) && Number.isFinite(longitude);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [{ default: L }] = await Promise.all([
          import("leaflet"),
          import("leaflet/dist/leaflet.css"),
        ]);
        if (cancelled || !holder.current) return;

        const instance = L.map(holder.current, {
          zoomControl: false,
          attributionControl: true,
          scrollWheelZoom: false,
          zoomAnimation: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        }).setView(INDIA_VIEW.center, INDIA_VIEW.zoom);
        L.control.zoom({ position: "bottomright" }).addTo(instance);

        const tiles = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 18,
          attribution: "© OpenStreetMap",
        });
        let tilesSeen = false;
        tiles.on("load", () => { tilesSeen = true; });
        tiles.on("tileerror", () => { if (!tilesSeen && !cancelled) setStatus("unavailable"); });
        tiles.addTo(instance);

        instance.on("click", (e) => pick.current?.(round(e.latlng.lat), round(e.latlng.lng)));
        map.current = instance;
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("unavailable");
      }
    })();

    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      marker.current = null;
    };
  }, []);

  // Keep the pin and the view in step with whatever the form says.
  useEffect(() => {
    const instance = map.current;
    if (!instance || status !== "ready") return;
    (async () => {
      const { default: L } = await import("leaflet");
      if (!map.current) return;
      if (!placed) {
        marker.current?.remove();
        marker.current = null;
        return;
      }
      const position = [latitude, longitude];
      if (!marker.current) {
        marker.current = L.marker(position, {
          draggable: true,
          keyboard: true,
          title: "Plant location — drag to move",
          icon: L.divIcon({ className: "map-pin", html: '<span class="map-pin-dot"></span>', iconSize: [18, 18] }),
        }).addTo(instance);
        marker.current.on("dragend", (e) => {
          const { lat, lng } = e.target.getLatLng();
          pick.current?.(round(lat), round(lng));
        });
      } else {
        marker.current.setLatLng(position);
      }
      instance.setView(position, Math.max(instance.getZoom(), SITE_ZOOM), { animate: false });
    })();
  }, [latitude, longitude, placed, status]);

  if (status === "unavailable") {
    return <CoordinateGrid latitude={latitude} longitude={longitude} note="Map tiles couldn't load. Coordinates still work." />;
  }

  return (
    <div className="sitemap" style={{ height }}>
      <div ref={holder} className="sitemap-canvas" role="application"
        aria-label="Map of the plant location. Click to place the plant, or type coordinates in the fields." />
      {status === "loading" && <span className="sitemap-state">Loading map…</span>}
      {status === "ready" && !placed && <span className="sitemap-state">Click the map to place the plant</span>}
    </div>
  );
}

/** Offline stand-in: the site's position on a plain lat/lon grid over India. */
export function CoordinateGrid({ latitude, longitude, note }) {
  const known = Number.isFinite(latitude) && Number.isFinite(longitude);
  const x = known ? ((longitude - 66) / 34) * 200 : 100;
  const y = known ? ((38 - latitude) / 32) * 200 : 100;
  const inside = known && x >= 0 && x <= 200 && y >= 0 && y <= 200;

  return (
    <div className="sitemap sitemap-fallback">
      <svg viewBox="0 0 200 200" className="locator" role="img"
        aria-label={known ? `Plant at ${latitude}, ${longitude}` : "No coordinates entered yet"}>
        {Array.from({ length: 11 }, (_, i) => Array.from({ length: 11 }, (_, j) => (
          <circle key={`${i}-${j}`} cx={i * 20} cy={j * 20} r="1" className="locator-dot" />
        )))}
        <circle cx="100" cy="100" r="60" className="locator-ring" />
        <circle cx="100" cy="100" r="95" className="locator-ring" />
        {inside && (
          <g transform={`translate(${x} ${y})`}>
            <line x1="-200" x2="200" y1="0" y2="0" className="locator-cross" />
            <line x1="0" x2="0" y1="-200" y2="200" className="locator-cross" />
            <circle r="16" className="locator-ping" />
            <circle r="4.5" fill="#a86c05" />
          </g>
        )}
        {known && !inside && <text x="100" y="104" textAnchor="middle" className="locator-note">Outside the India grid</text>}
      </svg>
      {note && <p className="sitemap-note">{note}</p>}
    </div>
  );
}
