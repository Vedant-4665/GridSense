import { api } from "../api/client.js";
import { useApi } from "../components/useApi.js";
import { rupees } from "../components/Money.jsx";

export default function Overview() {
  const { data, error, loading } = useApi(() => api.summary());

  if (loading) return <p>Loading summary…</p>;
  if (error) return <p className="error">Summary unavailable. Is the API running on port 5000?</p>;

  const cards = [
    { label: "Plants monitored", value: data.plants },
    { label: "Flagged windows, next 72h", value: data.flagged_windows },
    { label: "Projected deviation exposure", value: rupees(data.total_exposure_inr) },
    { label: "Open asset alerts", value: data.open_alerts },
    { label: "Revenue at risk", value: rupees(data.revenue_at_risk_inr) },
  ];

  return (
    <section>
      <h1>Overview</h1>
      <div className="kpi-row">
        {cards.map((c) => (
          <div className="kpi" key={c.label}>
            <div className="kpi-value">{c.value}</div>
            <div className="kpi-label">{c.label}</div>
          </div>
        ))}
      </div>
      {/* TODO(hackathon): forecast vs actual chart goes here. */}
    </section>
  );
}
