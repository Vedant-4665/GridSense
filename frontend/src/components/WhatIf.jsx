import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { energy } from "../lib/format.js";
import { CostWorking, DeviationGauge } from "./CostWorking.jsx";
import Segmented from "./Segmented.jsx";

const PRESETS = [
  ["Inside band", 1.03],
  ["14% short", 0.86],
  ["28% over", 1.28],
  ["Cloudburst", 0.3],
];

// Drag a schedule and a forecast; the server does the costing, live.
export default function WhatIf({ initial = {} }) {
  const [plantType, setPlantType] = useState(initial.plantType ?? "solar");
  const [scheduled, setScheduled] = useState(initial.scheduled || 10000);
  const [forecast, setForecast] = useState(initial.forecast || 8600);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [max] = useState(() => Math.max(20000, Math.ceil((Math.max(scheduled, forecast) * 1.5) / 1000) * 1000));

  useEffect(() => {
    let alive = true;
    const id = setTimeout(() => {
      api.costingPreview({ scheduled_kwh: scheduled, forecast_kwh: forecast, plant_type: plantType })
        .then((r) => { if (alive) { setResult(r); setError(null); } })
        .catch((e) => { if (alive) setError(e); });
    }, 120);
    return () => { alive = false; clearTimeout(id); };
  }, [scheduled, forecast, plantType]);

  return (
    <div className="whatif">
      <div className="whatif-controls">
        <Segmented id="whatif-type" options={[["solar", "Solar"], ["wind", "Wind"]]}
          value={plantType} onChange={setPlantType} />
        <Slider label="Declared schedule" tone="sun" value={scheduled} max={max} onChange={setScheduled} />
        <Slider label="Forecast output" tone="signal" value={forecast} max={max} onChange={setForecast} />
        <div className="chips">
          {PRESETS.map(([label, ratio]) => (
            <button key={label} type="button" className="chip"
              onClick={() => setForecast(Math.min(max, Math.round(scheduled * ratio)))}>{label}</button>
          ))}
        </div>
      </div>
      <div className="whatif-output">
        {result && <DeviationGauge scheduled={scheduled} forecast={forecast} bandPct={result.band_pct} />}
        <CostWorking result={result} />
        {result?.message && <p className="whatif-message">{result.message}</p>}
        {error && <p className="error">{error.message}</p>}
      </div>
    </div>
  );
}

function Slider({ label, tone, value, max, onChange }) {
  return (
    <label className={`slider slider-${tone}`}>
      <span className="slider-head"><span>{label}</span><strong className="num">{energy(value)}</strong></span>
      <input type="range" min={100} max={max} step={50} value={value}
        onChange={(e) => onChange(Number(e.target.value))} style={{ "--fill": `${(value / max) * 100}%` }} />
    </label>
  );
}
