import { useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../api/client.js";
import { useApi } from "../components/useApi.js";

const HORIZONS = [24, 48, 72];

export default function Forecast() {
  const [horizon, setHorizon] = useState(24);
  const { data, error, loading } = useApi(() => api.forecast(1, horizon), [horizon]);

  if (loading) return <p>Loading forecast…</p>;
  if (error) return <p className="error">Forecast unavailable. Is the API running on port 5000?</p>;

  const blocks = data.blocks.map((b) => ({
    time: b.target_timestamp.slice(5, 16).replace("T", " "),
    predicted: b.predicted_kw,
    scheduled: b.scheduled_kw,
  }));

  return (
    <section>
      <h1>Forecast</h1>
      <div className="horizon-toggle">
        {HORIZONS.map((h) => (
          <button key={h} onClick={() => setHorizon(h)} className={h === horizon ? "active" : ""}>
            {h}h
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={blocks}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" minTickGap={40} />
          <YAxis unit=" kW" width={80} />
          <Tooltip />
          <Line type="monotone" dataKey="predicted" dot={false} strokeWidth={2} />
          <Line type="monotone" dataKey="scheduled" dot={false} strokeDasharray="4 4" />
        </LineChart>
      </ResponsiveContainer>
    </section>
  );
}
