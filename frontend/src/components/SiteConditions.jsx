import { CloudSun, Loader, Sun, Thermometer, Wind } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api/client.js";

const DEBOUNCE_MS = 600;

/**
 * What the weather is doing at the site right now, from the same service the
 * forecast uses. Nothing is modelled here: if the call fails, the card says so
 * rather than showing a number nobody measured.
 */
export default function SiteConditions({ latitude, longitude }) {
  const [state, setState] = useState({ status: "idle" });
  const placed = Number.isFinite(latitude) && Number.isFinite(longitude);
  // Three decimals is ~100 m: finer than that should not trigger a new call.
  const key = placed ? `${latitude.toFixed(3)},${longitude.toFixed(3)}` : null;

  useEffect(() => {
    if (!key) {
      setState({ status: "idle" });
      return undefined;
    }
    let alive = true;
    setState((was) => (was.status === "ready" ? was : { status: "loading" }));
    const timer = setTimeout(() => {
      const [lat, lon] = key.split(",");
      api.currentWeather(lat, lon)
        .then((data) => alive && setState({ status: "ready", data }))
        .catch((error) => alive && setState({ status: "error", error }));
    }, DEBOUNCE_MS);
    return () => { alive = false; clearTimeout(timer); };
  }, [key]);

  if (state.status === "idle") {
    return (
      <p className="conditions-empty">
        Place the plant on the map, or type its coordinates, and the weather at that spot appears here.
      </p>
    );
  }
  if (state.status === "loading") {
    return <p className="conditions-empty"><Loader size={15} className="spin" /> Reading conditions at the site…</p>;
  }
  if (state.status === "error") {
    return (
      <p className="conditions-empty">
        Live conditions aren't available right now. It doesn't stop you adding the plant — the forecast
        fetches its own weather when it runs.
      </p>
    );
  }

  const { data } = state;
  const readings = [
    { id: "temp", icon: Thermometer, label: "Temperature", value: format(data.temperature_c, "°C") },
    { id: "wind", icon: Wind, label: "Wind", value: format(data.wind_speed_ms && data.wind_speed_ms * 3.6, "km/h") },
    { id: "cloud", icon: CloudSun, label: "Cloud cover", value: format(data.cloud_cover_pct, "%") },
    { id: "sun", icon: Sun, label: "Sunlight", value: data.irradiance_kw_m2 == null ? "—" : `${data.irradiance_kw_m2.toFixed(2)} kW/m²` },
  ];

  return (
    <div className="conditions">
      <dl className="conditions-grid">
        {readings.map(({ id, icon: Icon, label, value }) => (
          <div key={id}>
            <dt><Icon size={15} aria-hidden="true" />{label}</dt>
            <dd className="num">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="conditions-stamp">
        Measured {ago(data.observed_at)}{data.timezone ? ` · ${data.timezone}` : ""}
      </p>
    </div>
  );
}

const format = (value, unit) =>
  value == null || Number.isNaN(value) ? "—" : `${Math.round(value)} ${unit}`;

/** The service's own timestamp, in words. */
function ago(stamp) {
  if (!stamp) return "just now";
  const minutes = Math.round((Date.now() - new Date(stamp).getTime()) / 60000);
  if (!Number.isFinite(minutes)) return "just now";
  if (minutes < 1) return "moments ago";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours === 1 ? "an hour ago" : `${hours} hours ago`;
}
