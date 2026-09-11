import { motion } from "framer-motion";
import { Gauge, LoaderCircle, MapPin, Plus, Sun, Wind, Zap } from "lucide-react";
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { api } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";
import Field from "../components/Field.jsx";
import PageHeader from "../components/PageHeader.jsx";
import Panel from "../components/Panel.jsx";
import { usePlants } from "../components/PlantContext.jsx";
import Segmented from "../components/Segmented.jsx";
import { useToast } from "../components/Toast.jsx";
import { power } from "../lib/format.js";

// Approximate coordinates of well-known Indian solar sites, to fill the form in one click.
const PRESETS = [
  { name: "Ahmedabad", location: "Gujarat, India", lat: 23.0225, lon: 72.5714 },
  { name: "Bhadla", location: "Rajasthan, India", lat: 27.536, lon: 71.915 },
  { name: "Bhuj", location: "Kutch, Gujarat", lat: 23.242, lon: 69.667 },
  { name: "Pavagada", location: "Karnataka, India", lat: 14.1, lon: 77.28 },
  { name: "Kamuthi", location: "Tamil Nadu, India", lat: 9.347, lon: 78.389 },
];

export default function AddPlant() {
  const { isOwner } = useAuth();
  const { refresh, select } = usePlants();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "", location: "", latitude: "", longitude: "", capacity_kw: "", plant_type: "solar", owner_type: "utility",
  });
  const [stage, setStage] = useState(null);
  const [error, setError] = useState(null);
  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  if (!isOwner) return <Navigate to="/overview" replace />;

  const lat = parseFloat(form.latitude);
  const lon = parseFloat(form.longitude);
  const capacity = parseFloat(form.capacity_kw);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    try {
      setStage("Registering the plant");
      const plant = await api.createPlant({
        name: form.name, location: form.location || null, latitude: lat, longitude: lon,
        capacity_kw: capacity, plant_type: form.plant_type, owner_type: form.owner_type,
      });
      if (plant.plant_type === "solar") {
        setStage("Pulling 72 hours of weather");
        try {
          const r = await api.runForecast(plant.id);
          toast({ title: `${plant.name} is live`, body: `${r.blocks_written} forecast blocks written. Declare a schedule to see them costed.` });
        } catch (err) {
          toast({ tone: "warn", title: `${plant.name} added`, body: `Its first forecast didn't run: ${err.message}` });
        }
      } else {
        toast({ title: `${plant.name} added`, body: "Wind forecasting is on the roadmap. The plant is registered." });
      }
      await refresh();
      select(plant.id);
      navigate("/overview");
    } catch (err) {
      setError(err.message);
      setStage(null);
    }
  }

  return (
    <div className="page">
      <PageHeader eyebrow="New plant" title="Add a plant to your control room"
        meta="GridSense forecasts from live weather at these coordinates. The first 72-hour forecast runs as soon as you save." />

      <div className="addplant">
        <Panel title="Plant details" delay={0.05}>
          <form className="form" onSubmit={submit}>
            <Field icon={Zap} label="Plant name" required value={form.name} onChange={set("name")} placeholder="Kutch Solar 2" />
            <div className="field">
              <span className="field-label">Quick locations</span>
              <div className="chips">
                {PRESETS.map((p) => (
                  <button key={p.name} type="button" className="chip"
                    onClick={() => setForm((f) => ({ ...f, location: p.location, latitude: String(p.lat), longitude: String(p.lon) }))}>
                    <MapPin size={12} />{p.name}
                  </button>
                ))}
              </div>
            </div>
            <Field icon={MapPin} label="Location" value={form.location} onChange={set("location")} placeholder="District, State" />
            <div className="form-row">
              <Field label="Latitude" type="number" step="any" min="-90" max="90" required
                value={form.latitude} onChange={set("latitude")} placeholder="23.73" />
              <Field label="Longitude" type="number" step="any" min="-180" max="180" required
                value={form.longitude} onChange={set("longitude")} placeholder="69.86" />
            </div>
            <Field icon={Gauge} label="Capacity (kW)" type="number" step="any" min="0.1" required
              value={form.capacity_kw} onChange={set("capacity_kw")} placeholder="25000"
              hint={capacity > 0 ? `= ${power(capacity)}` : "AC capacity at the grid connection"} />
            <div className="form-row">
              <div className="field">
                <span className="field-label">Technology</span>
                <Segmented id="plant-type" options={[["solar", "Solar"], ["wind", "Wind"]]}
                  value={form.plant_type} onChange={set("plant_type")} />
              </div>
              <div className="field">
                <span className="field-label">Connection</span>
                <Segmented id="owner-type" options={[["utility", "Utility-scale"], ["distributed", "Rooftop"]]}
                  value={form.owner_type} onChange={set("owner_type")} />
              </div>
            </div>
            {form.plant_type === "wind" && (
              <p className="note">Wind plants can be registered now. Forecasting them is on the roadmap.</p>
            )}
            {error && <p className="form-error" role="alert">{error}</p>}
            <button type="submit" className="btn btn-primary btn-lg" disabled={Boolean(stage)}>
              {stage
                ? <><LoaderCircle size={16} className="spin" />{stage}…</>
                : <><Plus size={16} />Add plant and forecast</>}
            </button>
          </form>
        </Panel>

        <Panel title="Preview" delay={0.1}>
          <Locator lat={lat} lon={lon} />
          <div className="preview">
            <span className="switcher-icon">{form.plant_type === "wind" ? <Wind size={16} /> : <Sun size={16} />}</span>
            <div>
              <strong>{form.name || "Unnamed plant"}</strong>
              <small>{form.location || "Location"} · {capacity > 0 ? power(capacity) : "capacity"}</small>
            </div>
          </div>
          <dl className="preview-coords">
            <div><dt>Latitude</dt><dd className="num">{Number.isFinite(lat) ? `${Math.abs(lat).toFixed(3)}°${lat >= 0 ? "N" : "S"}` : "—"}</dd></div>
            <div><dt>Longitude</dt><dd className="num">{Number.isFinite(lon) ? `${Math.abs(lon).toFixed(3)}°${lon >= 0 ? "E" : "W"}` : "—"}</dd></div>
          </dl>
          <p className="note">
            New plants have no declared schedule yet, so their blocks are forecast but not costed until one is on file.
          </p>
        </Panel>
      </div>
    </div>
  );
}

// A dot on a stylised grid spanning India's latitudes and longitudes. Not a map, just a sense of place.
function Locator({ lat, lon }) {
  const known = Number.isFinite(lat) && Number.isFinite(lon);
  const x = known ? ((lon - 66) / 34) * 200 : 100;
  const y = known ? ((38 - lat) / 32) * 200 : 100;
  const inside = known && x >= 0 && x <= 200 && y >= 0 && y <= 200;

  return (
    <svg viewBox="0 0 200 200" className="locator" role="img"
      aria-label={known ? `Plant at ${lat}, ${lon}` : "No coordinates entered yet"}>
      {Array.from({ length: 11 }, (_, i) => Array.from({ length: 11 }, (_, j) => (
        <circle key={`${i}-${j}`} cx={i * 20} cy={j * 20} r="1" className="locator-dot" />
      )))}
      <circle cx="100" cy="100" r="60" className="locator-ring" />
      <circle cx="100" cy="100" r="95" className="locator-ring" />
      {inside && (
        <motion.g initial={false} animate={{ x, y }} transition={{ type: "spring", stiffness: 120, damping: 18 }}>
          <line x1="-200" x2="200" y1="0" y2="0" className="locator-cross" />
          <line x1="0" x2="0" y1="-200" y2="200" className="locator-cross" />
          <circle r="16" className="locator-ping" />
          <circle r="4.5" fill="#ffb547" />
        </motion.g>
      )}
      {known && !inside && <text x="100" y="104" textAnchor="middle" className="locator-note">Outside the India grid</text>}
    </svg>
  );
}
