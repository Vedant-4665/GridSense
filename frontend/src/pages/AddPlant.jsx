import { AnimatePresence, motion } from "framer-motion";
import { Gauge, MapPin, Plus, RotateCcw, Sun, TriangleAlert, Wind, Zap } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { api } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";
import Field from "../components/Field.jsx";
import PageHeader from "../components/PageHeader.jsx";
import Panel from "../components/Panel.jsx";
import { usePlants } from "../components/PlantContext.jsx";
import ReadyList from "../components/ReadyList.jsx";
import Segmented from "../components/Segmented.jsx";
import SiteConditions from "../components/SiteConditions.jsx";
import SiteMap from "../components/SiteMap.jsx";
import SubmitProgress, { STAGE } from "../components/SubmitProgress.jsx";
import { useToast } from "../components/Toast.jsx";
import { power } from "../lib/format.js";
import {
  EMPTY_FORM, LIMITS, PRESETS, checklist, fieldErrors, parseNumber, toPayload, warnings,
} from "../lib/plantForm.js";

const newKey = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));

export default function AddPlant() {
  const { isOwner } = useAuth();
  const { plants, refresh, select } = usePlants();
  const toast = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY_FORM);
  const [touched, setTouched] = useState({});
  const [stage, setStage] = useState(STAGE.DRAFT);
  const [created, setCreated] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [createError, setCreateError] = useState(null);
  const [forecastError, setForecastError] = useState(null);
  // One key for this draft. A retry reuses it, so the server recognises the
  // second attempt as the same creation and never makes two plants.
  const idempotencyKey = useRef(newKey());
  const formRef = useRef(null);
  // React state settles a tick later, so rapid clicks would all read the old
  // stage. This ref flips synchronously and is the real guard.
  const inFlight = useRef(false);

  const errors = useMemo(() => fieldErrors(form), [form]);
  const notes = useMemo(() => warnings(form, { existingPlants: plants ?? [] }), [form, plants]);
  const items = useMemo(() => checklist(form), [form]);

  if (!isOwner) return <Navigate to="/overview" replace />;

  const latitude = parseNumber(form.latitude);
  const longitude = parseNumber(form.longitude);
  const capacity = parseNumber(form.capacity_kw);
  const busy = stage === STAGE.CREATING || stage === STAGE.FORECASTING;
  const settled = stage === STAGE.READY || stage === STAGE.FORECAST_FAILED;
  const shown = (key) => (touched[key] ? errors[key] : undefined);

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));
  const blur = (key) => () => setTouched((t) => ({ ...t, [key]: true }));

  function choosePreset(preset) {
    setForm((f) => ({
      ...f, preset: preset.name, location: preset.location,
      latitude: String(preset.lat), longitude: String(preset.lon),
    }));
    setTouched((t) => ({ ...t, latitude: true, longitude: true }));
  }

  function pickOnMap(lat, lon) {
    setForm((f) => ({ ...f, latitude: String(lat), longitude: String(lon) }));
    setTouched((t) => ({ ...t, latitude: true, longitude: true }));
  }

  async function retryForecast() {
    if (inFlight.current || !created) return;
    inFlight.current = true;
    try {
      await runForecast(created);
    } finally {
      inFlight.current = false;
    }
  }

  async function runForecast(plant) {
    // Wind plants are registered but not forecast: the API is solar-only.
    if (plant.plant_type !== "solar") {
      await settle();
      setStage(STAGE.READY);
      return;
    }
    setForecastError(null);
    setStage(STAGE.FORECASTING);
    try {
      const summary = await api.runForecast(plant.id);
      setForecast(summary);
      await settle();
      setStage(STAGE.READY);
    } catch (error) {
      setForecastError(error);
      await settle();
      setStage(STAGE.FORECAST_FAILED);
    }
  }

  /**
   * The plant exists either way, so the switcher should know about it. It does
   * not become the *current* plant until the user opens it: switching plants
   * remounts this page, which would throw away the progress they are reading.
   */
  async function settle() {
    await refresh().catch(() => {});
  }

  async function submit(event) {
    event?.preventDefault();
    if (inFlight.current) return;                       // a second click changes nothing

    if (Object.keys(errors).length) {
      setTouched({ name: true, location: true, latitude: true, longitude: true, capacity_kw: true });
      const first = ["name", "location", "latitude", "longitude", "capacity_kw"].find((key) => errors[key]);
      // After the state above has painted, so the field is showing its message.
      setTimeout(() => formRef.current?.querySelector(`[data-field="${first}"]`)?.focus(), 0);
      return;
    }

    inFlight.current = true;
    setCreateError(null);
    setStage(STAGE.CREATING);
    try {
      let plant = created;
      if (!plant) {
        try {
          plant = await api.createPlant(toPayload(form), idempotencyKey.current);
          setCreated(plant);
        } catch (error) {
          setCreateError(error);
          setStage(STAGE.CREATE_FAILED);
          return;
        }
      }
      await runForecast(plant);
    } finally {
      inFlight.current = false;
    }
  }

  function open() {
    select(created.id);
    toast({
      tone: forecastError ? "warn" : "ok",
      title: `${created.name} is in your control room`,
      body: forecastError
        ? "Its forecast hasn't run yet. Use Update forecast when you're ready."
        : forecast
          ? `${forecast.blocks_written} quarter-hour blocks from live weather.`
          : "Wind forecasting is on the roadmap; the plant is registered.",
    });
    navigate("/overview");
  }

  return (
    <div className="page">
      <PageHeader eyebrow="New plant" title="Add a plant to your control room"
        meta="What it is, where it is, how big it is. Then GridSense reads the weather at that spot and forecasts its next 72 hours." />

      <div className="addplant">
        <form className="addplant-form" ref={formRef} onSubmit={submit} noValidate aria-busy={busy}>
          <Panel title="1 · Plant details" delay={0.02}>
            <Field icon={Zap} label="Plant name" required maxLength={LIMITS.nameChars}
              data-field="name" value={form.name} onChange={set("name")} onBlur={blur("name")}
              error={shown("name")} placeholder="Kutch Solar 2"
              hint="How it will appear in the plant switcher." />
          </Panel>

          <Panel title="2 · Location and site" delay={0.06}
            meta="The forecast reads weather at these coordinates, so they matter more than the label.">
            <fieldset className="presets">
              <legend>Quick locations</legend>
              <div className="chips">
                {PRESETS.map((preset) => (
                  <button key={preset.name} type="button"
                    className={`chip ${form.preset === preset.name ? "is-selected" : ""}`}
                    aria-pressed={form.preset === preset.name}
                    onClick={() => choosePreset(preset)}>
                    <MapPin size={13} aria-hidden="true" />{preset.name}
                  </button>
                ))}
              </div>
            </fieldset>

            <Field icon={MapPin} label="Location" maxLength={LIMITS.locationChars}
              data-field="location" value={form.location} onChange={set("location")} onBlur={blur("location")}
              error={shown("location")} placeholder="District, State"
              hint="A label for people. Optional." />

            <div className="form-row">
              <Field label="Latitude" type="text" inputMode="decimal" required
                data-field="latitude" value={form.latitude} onChange={set("latitude")} onBlur={blur("latitude")}
                error={shown("latitude")} placeholder="23.73" hint="−90 to 90" />
              <Field label="Longitude" type="text" inputMode="decimal" required
                data-field="longitude" value={form.longitude} onChange={set("longitude")} onBlur={blur("longitude")}
                error={shown("longitude")} placeholder="69.86" hint="−180 to 180" />
            </div>

            <SiteMap latitude={latitude} longitude={longitude} onPick={pickOnMap} />
          </Panel>

          <Panel title="3 · Capacity and configuration" delay={0.1}>
            <Field icon={Gauge} label="Capacity (kW)" type="text" inputMode="decimal" required
              data-field="capacity_kw" value={form.capacity_kw} onChange={set("capacity_kw")} onBlur={blur("capacity_kw")}
              error={shown("capacity_kw")} placeholder="25000"
              hint={capacity > 0
                ? `${power(capacity)} — AC capacity at the grid connection`
                : "AC capacity at the grid connection, in kilowatts"} />

            <div className="form-row">
              <div className="field">
                <span className="field-label" id="tech-label">Technology</span>
                <Segmented id="plant-type" options={[["solar", "Solar"], ["wind", "Wind"]]}
                  value={form.plant_type} onChange={set("plant_type")} />
                <small className="field-hint">
                  {form.plant_type === "solar"
                    ? "Forecast from sunlight, temperature and cloud."
                    : "Registered, but not forecast yet — the model is solar-only."}
                </small>
              </div>
              <div className="field">
                <span className="field-label" id="conn-label">Connection</span>
                <Segmented id="owner-type" options={[["utility", "Utility-scale"], ["distributed", "Rooftop"]]}
                  value={form.owner_type} onChange={set("owner_type")} />
                <small className="field-hint">
                  {form.owner_type === "utility"
                    ? "Scheduled with the grid, so deviation charges apply."
                    : "Behind the meter: savings rather than deviation charges."}
                </small>
              </div>
            </div>
          </Panel>

          <Panel title="4 · Review and forecast" delay={0.14}>
            <ReadyList items={items} warnings={notes} />

            <AnimatePresence>
              {createError && (
                <motion.div className="form-error" role="alert"
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <TriangleAlert size={15} aria-hidden="true" />
                  <span>
                    <strong>This plant wasn't saved.</strong> {createError.message} Nothing you typed is lost.
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {!settled && (
              <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>
                {busy
                  ? <><RotateCcw size={16} className="spin" />Working…</>
                  : stage === STAGE.CREATE_FAILED
                    ? <><RotateCcw size={16} />Try again</>
                    : <><Plus size={16} />Add plant and forecast</>}
              </button>
            )}

            <SubmitProgress stage={stage} plant={created} forecast={forecast} error={createError}
              forecastError={forecastError} onRetryForecast={retryForecast} onOpen={open} />
          </Panel>

          {import.meta.env.DEV && <DevScenarios plants={plants} onPick={(values) => setForm({ ...EMPTY_FORM, ...values })} />}
        </form>

        <aside className="addplant-rail">
          <Panel title="Live preview" delay={0.08}>
            <div className="preview">
              <span className="switcher-icon">
                {form.plant_type === "wind" ? <Wind size={16} /> : <Sun size={16} />}
              </span>
              <div>
                <strong>{form.name.trim() || "Unnamed plant"}</strong>
                <small>
                  {form.location.trim() || "Location not set"} · {capacity > 0 ? power(capacity) : "capacity not set"}
                </small>
              </div>
            </div>
            <dl className="preview-coords">
              <div>
                <dt>Latitude</dt>
                <dd className="num">{latitude === null ? "—" : `${Math.abs(latitude).toFixed(3)}°${latitude >= 0 ? "N" : "S"}`}</dd>
              </div>
              <div>
                <dt>Longitude</dt>
                <dd className="num">{longitude === null ? "—" : `${Math.abs(longitude).toFixed(3)}°${longitude >= 0 ? "E" : "W"}`}</dd>
              </div>
            </dl>
            <p className="preview-tags">
              {form.plant_type === "wind" ? "Wind" : "Solar"} · {form.owner_type === "utility" ? "Utility-scale" : "Rooftop"}
            </p>
            <p className="note">
              A new plant has no schedule filed with the grid yet, so its blocks are forecast but not costed
              until you declare one.
            </p>
          </Panel>

          <Panel title="Conditions at the site" delay={0.12}
            meta="Live, from the same weather service the forecast uses.">
            <SiteConditions latitude={latitude} longitude={longitude} />
          </Panel>
        </aside>
      </div>
    </div>
  );
}

/** Fills the form with a case worth showing. Development builds only. */
function DevScenarios({ plants, onPick }) {
  const existing = plants?.[0]?.name ?? "Ahmedabad Solar Park";
  const cases = [
    ["Solar · utility", { name: "Bhadla Solar 4", location: "Rajasthan, India", latitude: "27.536", longitude: "71.915", capacity_kw: "25000", preset: "Bhadla" }],
    ["Solar · rooftop", { name: "Warehouse roof", location: "Ahmedabad, India", latitude: "23.0225", longitude: "72.5714", capacity_kw: "12", owner_type: "distributed", preset: "Ahmedabad" }],
    ["Wind · utility", { name: "Kutch Wind 1", location: "Kutch, Gujarat", latitude: "23.242", longitude: "69.667", capacity_kw: "18000", plant_type: "wind", preset: "Bhuj" }],
    ["Oversized rooftop", { name: "Rooftop 25 MW", location: "Ahmedabad, India", latitude: "23.0225", longitude: "72.5714", capacity_kw: "25000", owner_type: "distributed", preset: "Ahmedabad" }],
    ["Coordinates away from site", { name: "Drifted site", location: "Rajasthan, India", latitude: "9.93", longitude: "78.12", capacity_kw: "5000", preset: "Bhadla" }],
    ["Invalid coordinates", { name: "Bad coordinates", latitude: "123.4", longitude: "999", capacity_kw: "5000" }],
    ["Invalid capacity", { name: "Bad capacity", latitude: "23.0225", longitude: "72.5714", capacity_kw: "-5" }],
    ["Duplicate name", { name: existing, latitude: "23.0225", longitude: "72.5714", capacity_kw: "5000" }],
    ["Very long name", { name: "N".repeat(130), latitude: "23.0225", longitude: "72.5714", capacity_kw: "5000" }],
  ];

  return (
    <details className="devtools">
      <summary>Demo scenarios (development only)</summary>
      <div className="chips">
        {cases.map(([label, values]) => (
          <button key={label} type="button" className="chip" onClick={() => onPick(values)}>{label}</button>
        ))}
      </div>
    </details>
  );
}
