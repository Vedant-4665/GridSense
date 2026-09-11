import { useState } from "react";
import { BLOCK_MS } from "../lib/blocks.js";
import { dayShort, hhmm, pct, power, rupees, rupeesExact } from "../lib/format.js";

const HOUR_LABELS = ["00", "03", "06", "09", "12", "15", "18", "21"];

// The next 72 hours as a calendar strip: one row per day, one cell per
// 15-minute settlement block, coloured by rupee exposure.
export default function Runway({ blocks, capacityKw, selected, onSelect }) {
  const [hover, setHover] = useState(null);
  if (!blocks.length) return <p className="muted">No forecast blocks yet.</p>;

  const maxExposure = Math.max(1, ...blocks.map((b) => b.rec?.exposure_inr ?? 0));
  const days = byDay(blocks);

  return (
    <div className="runway">
      <div className="runway-hours" aria-hidden="true">
        <span />
        <div>{HOUR_LABELS.map((h) => <span key={h}>{h}:00</span>)}</div>
      </div>
      {days.map((day, row) => (
        <div className="runway-row" key={day.key}>
          <span className="runway-day">{day.label}</span>
          <div className="runway-cells">
            {day.slots.map((b, i) => (b ? (
              <button key={i} type="button" tabIndex={b.rec ? 0 : -1}
                className={`cell ${cellKind(b)} ${selected === b.target_timestamp ? "is-selected" : ""}`}
                style={{ "--i": row * 96 + i, "--heat": heat(b, maxExposure, capacityKw) }}
                onMouseEnter={() => setHover(b)} onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(b)} onBlur={() => setHover(null)}
                onClick={() => onSelect?.(b)} aria-label={describe(b, capacityKw)} />
            ) : <span key={i} className="cell cell-void" />))}
          </div>
        </div>
      ))}
      <div className="runway-foot">
        <div className="runway-readout" aria-live="polite">
          {hover ? describe(hover, capacityKw) : "Hover a block for detail · click one to open its costing"}
        </div>
        <div className="runway-scale">
          <span className="swatch swatch-ok" />In band
          <span className="swatch swatch-free" />No schedule
          <i className="scale-bar" />
          <span className="num">{rupees(maxExposure)}</span>
        </div>
      </div>
    </div>
  );
}

function byDay(blocks) {
  const days = new Map();
  for (const b of blocks) {
    const d = new Date(b.t);
    const key = d.toDateString();
    if (!days.has(key)) days.set(key, { key, label: dayShort(b.t), slots: Array(96).fill(null) });
    days.get(key).slots[d.getHours() * 4 + Math.floor(d.getMinutes() / 15)] = b;
  }
  return [...days.values()];
}

function cellKind(b) {
  if (b.rec) return "cell-breach";
  if (b.scheduled_kw == null) return "cell-unscheduled";
  if (!b.scheduled_kw && b.predicted_kw < 1) return "cell-night";
  return "cell-ok";
}

// 0..1: exposure relative to the worst block, or output relative to capacity when in band.
function heat(b, maxExposure, capacityKw) {
  if (b.rec) return (b.rec.exposure_inr / maxExposure).toFixed(3);
  return Math.min(1, b.predicted_kw / capacityKw).toFixed(3);
}

function describe(b, capacityKw) {
  const when = `${dayShort(b.t)} ${hhmm(b.t)}–${hhmm(b.t + BLOCK_MS)}`;
  const output = `forecast ${power(b.predicted_kw, capacityKw)}`;
  if (b.rec) return `${when} · ${output} · ${pct(b.rec.deviation_pct)} ${b.rec.window_type} · ${rupeesExact(b.rec.exposure_inr)}`;
  if (b.scheduled_kw == null) return `${when} · ${output} · no schedule on file`;
  return `${when} · ${output} · within band`;
}
