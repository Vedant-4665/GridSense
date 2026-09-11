import { api } from "../api/client.js";
import { useApi } from "../components/useApi.js";
import { rupees } from "../components/Money.jsx";

export default function AssetHealth() {
  const { data, error, loading } = useApi(() => api.alerts("open"));

  if (loading) return <p>Loading asset health…</p>;
  if (error) return <p className="error">Alerts unavailable. Is the API running on port 5000?</p>;
  if (!data.length) return <p>Every asset is tracking its forecast. Nothing needs attention.</p>;

  return (
    <section>
      <h1>Asset health</h1>
      <p className="lede">
        Sustained divergence from forecast on clear-sky periods, ranked by revenue lost.
      </p>
      <table>
        <thead>
          <tr>
            <th>Asset</th><th>Suspected cause</th><th>Gap</th>
            <th>Energy lost</th><th>Revenue lost</th>
          </tr>
        </thead>
        <tbody>
          {data.map((a) => (
            <tr key={a.id}>
              <td>Inverter {a.asset_id}</td>
              <td>{a.suspected_cause}</td>
              <td>{a.deviation_pct}%</td>
              <td>{a.est_loss_kwh?.toLocaleString("en-IN")} kWh</td>
              <td>{rupees(a.est_revenue_loss)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
