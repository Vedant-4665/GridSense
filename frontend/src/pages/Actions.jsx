import { api } from "../api/client.js";
import { useApi } from "../components/useApi.js";
import { rupees } from "../components/Money.jsx";

export default function Actions() {
  const { data, error, loading } = useApi(() => api.recommendations(1));

  if (loading) return <p>Loading grid actions…</p>;
  if (error) return <p className="error">Actions unavailable. Is the API running on port 5000?</p>;
  if (!data.length) return <p>No windows breach the tolerance band in the next 72 hours.</p>;

  return (
    <section>
      <h1>Grid actions</h1>
      <p className="lede">Ranked by financial impact, highest exposure first.</p>
      {data.map((r) => (
        <article className={`action severity-${r.severity}`} key={r.id}>
          <header>
            <strong>{r.window_start.slice(11, 16)}–{r.window_end.slice(11, 16)}</strong>
            <span>{r.window_type === "under" ? "Under-generation" : "Over-generation"}</span>
            <span className="money">{rupees(r.exposure_inr)}</span>
          </header>
          <p>{r.message}</p>
        </article>
      ))}
    </section>
  );
}
