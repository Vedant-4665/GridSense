import { motion } from "framer-motion";
import { energy, pct, rupeesExact } from "../lib/format.js";
import CountUp from "./CountUp.jsx";

const SPRING = { type: "spring", stiffness: 180, damping: 24 };
const share = (v, max) => `${Math.max(0, (v / max) * 100)}%`;

// Schedule, its tolerance band, the forecast, and the chargeable slice beyond the band, on one track.
export function DeviationGauge({ scheduled, forecast, bandPct }) {
  const b = (bandPct ?? 0) / 100;
  const lo = scheduled * (1 - b);
  const hi = scheduled * (1 + b);
  const max = Math.max(hi, forecast, 1) * 1.12;
  const outside = forecast < lo || forecast > hi;
  const edge = forecast < lo ? lo : hi;

  return (
    <div className="gauge" role="img"
      aria-label={`Forecast ${energy(forecast)} against a schedule of ${energy(scheduled)}, band ±${bandPct}%`}>
      <div className="gauge-track">
        <motion.div className="gauge-band" initial={false}
          animate={{ left: share(lo, max), width: share(hi - lo, max) }} transition={SPRING} />
        <motion.div className="gauge-charge" initial={false} transition={SPRING}
          animate={{
            left: share(Math.min(edge, forecast), max),
            width: outside ? share(Math.abs(forecast - edge), max) : "0%",
          }} />
        <motion.div className="gauge-mark gauge-schedule" initial={false}
          animate={{ left: share(scheduled, max) }} transition={SPRING}>
          <span>Schedule</span>
        </motion.div>
        <motion.div className={`gauge-mark gauge-forecast ${outside ? "is-out" : ""}`} initial={false}
          animate={{ left: share(forecast, max) }} transition={SPRING}>
          <span>Forecast</span>
        </motion.div>
      </div>
    </div>
  );
}

// The costing arithmetic, step by step, exactly as /api/costing/preview returned it.
export function CostWorking({ result }) {
  if (!result) return null;
  const steps = [
    ["Deviation", result.direction ? `${pct(result.deviation_pct)} ${result.direction}` : pct(result.deviation_pct),
      "gap between forecast and schedule"],
    ["Tolerance band", result.band_pct == null ? "—" : `± ${pct(result.band_pct)}`, "free of charge"],
    ["Chargeable energy", energy(result.chargeable_units ?? 0), "only the part beyond the band"],
    ["Slab rate", result.breached ? `₹${result.rate_per_unit.toFixed(2)} / kWh` : "—", "set by how far off"],
  ];

  return (
    <div className="working">
      {steps.map(([label, value, hint], i) => (
        <motion.div className="working-row" key={label}
          initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.06 * i }}>
          <span className="working-k">{label}</span>
          <span className="working-v num">{value}</span>
          <span className="working-hint">{hint}</span>
        </motion.div>
      ))}
      <div className={`working-total ${result.breached ? "is-breach" : "is-ok"}`}>
        <span>{result.breached ? "Exposure for this block" : "Within band: no charge"}</span>
        <strong><CountUp value={result.exposure_inr} format={rupeesExact} duration={0.6} /></strong>
      </div>
    </div>
  );
}
