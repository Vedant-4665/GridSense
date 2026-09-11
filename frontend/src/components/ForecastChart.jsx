import {
  Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { dayShort, hhmm, pct, rupeesExact } from "../lib/format.js";

// Hex values of the CSS tokens: SVG presentation attributes can't read custom properties everywhere.
const C = {
  signal: "#36f1c2", sun: "#ffb547", danger: "#ff5c63", actual: "#c9d8d4",
  grid: "rgba(128,226,205,0.07)", axis: "#6b7f7a",
};
const HOUR = 3600 * 1000;
const TICK = { fontSize: 11, fontFamily: "JetBrains Mono, monospace", fill: C.axis };

// Actual output, forecast with its confidence ribbon, the declared schedule
// with its tolerance band, and a marker on every block that breaches it.
export default function ForecastChart({ blocks, actuals = [], band, capacityKw, height = 380 }) {
  if (!blocks.length) {
    return (
      <div className="chart-empty" style={{ height }}>
        No forecast blocks yet. Run a forecast to fill the next 72 hours.
      </div>
    );
  }

  const mw = capacityKw >= 1000;
  const scale = mw ? 1000 : 1;
  const unit = mw ? "MW" : "kW";
  const b = (band ?? 0) / 100;

  const data = [
    ...actuals.map((a) => ({ t: new Date(a.timestamp).getTime(), actual: a.ac_power / scale })),
    ...blocks.map((x) => ({
      t: x.t,
      predicted: x.predicted_kw / scale,
      scheduled: x.scheduled_kw == null ? null : x.scheduled_kw / scale,
      band: x.scheduled_kw ? [(x.scheduled_kw * (1 - b)) / scale, (x.scheduled_kw * (1 + b)) / scale] : null,
      conf: x.confidence_low == null ? null : [x.confidence_low / scale, x.confidence_high / scale],
      breach: x.rec ? x.predicted_kw / scale : null,
      rec: x.rec,
    })),
  ].sort((p, q) => p.t - q.t);

  const first = data[0].t;
  const last = data[data.length - 1].t;
  const now = Date.now();

  return (
    <div className="chart" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 18, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="fc-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.signal} stopOpacity={0.3} />
              <stop offset="100%" stopColor={C.signal} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={C.grid} vertical={false} />
          <XAxis dataKey="t" type="number" scale="time" domain={[first, last]}
            ticks={sixHourTicks(first, last)} tick={TICK} tickLine={false}
            axisLine={{ stroke: C.grid }}
            tickFormatter={(t) => (new Date(t).getHours() === 0 ? dayShort(t) : hhmm(t))} />
          <YAxis tick={TICK} tickLine={false} axisLine={false} width={48}
            tickFormatter={(v) => (mw ? v.toFixed(0) : v.toFixed(1))}
            label={{ value: unit, position: "insideTopLeft", offset: -14, fill: C.axis, fontSize: 10 }} />
          <Tooltip content={<ChartTooltip unit={unit} />} isAnimationActive={false}
            cursor={{ stroke: "rgba(228,240,236,0.25)", strokeDasharray: "3 3" }} />

          <Area dataKey="band" stroke="none" fill={C.sun} fillOpacity={0.13} isAnimationActive={false} />
          <Area dataKey="conf" stroke="none" fill={C.signal} fillOpacity={0.07} isAnimationActive={false} />
          <Line dataKey="scheduled" stroke={C.sun} strokeWidth={1.4} strokeDasharray="5 4"
            dot={false} activeDot={false} isAnimationActive={false} />
          <Area className="fc-predicted" dataKey="predicted" stroke={C.signal} strokeWidth={2.2}
            fill="url(#fc-fill)" dot={false} activeDot={{ r: 4, fill: C.signal, stroke: "#04080a" }}
            animationDuration={1100} />
          <Line dataKey="actual" stroke={C.actual} strokeWidth={1.5} dot={false} isAnimationActive={false} />
          <Line dataKey="breach" stroke="none" dot={<BreachDot />} activeDot={false}
            isAnimationActive={false} legendType="none" />
          {now > first && now < last && (
            <ReferenceLine x={now} stroke="rgba(228,240,236,0.45)" strokeDasharray="2 4" label={<NowLabel />} />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ChartLegend({ band, showActual = true }) {
  return (
    <div className="legend">
      {showActual && <span><i className="lg-line lg-actual" />Actual</span>}
      <span><i className="lg-line lg-forecast" />Forecast</span>
      <span><i className="lg-line lg-schedule" />Schedule</span>
      <span><i className="lg-area" />±{band ?? "–"}% band</span>
      <span><i className="lg-dot" />Breach</span>
    </div>
  );
}

function sixHourTicks(from, to) {
  const d = new Date(from);
  d.setMinutes(0, 0, 0);
  d.setHours(Math.ceil(d.getHours() / 6) * 6);
  const ticks = [];
  for (let t = d.getTime(); t <= to; t += 6 * HOUR) ticks.push(t);
  return ticks;
}

function BreachDot({ cx, cy, payload }) {
  if (payload?.breach == null || cx == null || cy == null) return null;
  const high = payload.rec?.severity === "high";
  return (
    <g>
      <circle cx={cx} cy={cy} r={high ? 6.5 : 5} fill={C.danger} opacity={0.2} />
      <circle cx={cx} cy={cy} r={2.3} fill={high ? C.danger : C.sun} />
    </g>
  );
}

function NowLabel({ viewBox }) {
  if (!viewBox) return null;
  return (
    <text x={viewBox.x + 6} y={viewBox.y + 4} fill="#e4f0ec" fontSize={10}
      fontFamily="JetBrains Mono, monospace" letterSpacing="0.14em">NOW</text>
  );
}

function ChartTooltip({ active, payload, unit }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const fmt = (v) => `${v.toFixed(2)} ${unit}`;
  return (
    <div className="tip">
      <div className="tip-time">{dayShort(p.t)} · {hhmm(p.t)}</div>
      {p.actual != null && <TipRow color={C.actual} label="Actual" value={fmt(p.actual)} />}
      {p.predicted != null && <TipRow color={C.signal} label="Forecast" value={fmt(p.predicted)} />}
      {p.scheduled != null && <TipRow color={C.sun} label="Schedule" value={fmt(p.scheduled)} />}
      {p.band && <TipRow label="Allowed" value={`${p.band[0].toFixed(1)}–${p.band[1].toFixed(1)} ${unit}`} />}
      {p.rec && (
        <div className="tip-breach">
          {pct(p.rec.deviation_pct)} {p.rec.window_type} · <strong>{rupeesExact(p.rec.exposure_inr)}</strong>
        </div>
      )}
    </div>
  );
}

function TipRow({ color, label, value }) {
  return (
    <div className="tip-row">
      <span>{color && <i style={{ background: color }} />}{label}</span>
      <span className="num">{value}</span>
    </div>
  );
}
