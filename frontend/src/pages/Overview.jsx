import { MapPin } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";
import ActionList from "../components/ActionList.jsx";
import ForecastChart, { ChartLegend } from "../components/ForecastChart.jsx";
import InverterGrid from "../components/InverterGrid.jsx";
import Kpi from "../components/Kpi.jsx";
import PageHeader from "../components/PageHeader.jsx";
import Panel from "../components/Panel.jsx";
import { usePlants } from "../components/PlantContext.jsx";
import Runway from "../components/Runway.jsx";
import { EmptyState, ErrorState, PageSkeleton } from "../components/States.jsx";
import { useApi } from "../components/useApi.js";
import { useBand } from "../components/useBand.js";
import { BLOCK_HOURS, joinBlocks, maxBy, sum } from "../lib/blocks.js";
import { dayShort, energy, hhmm, pct, power, rupees, rupeesShort } from "../lib/format.js";

export default function Overview() {
  const { plant, version } = usePlants();
  const { user } = useAuth();
  const navigate = useNavigate();
  const band = useBand(plant.plant_type);
  const { data, error } = useApi(() => Promise.all([
    api.forecast(plant.id, 72), api.recommendations(plant.id), api.generation(plant.id, 96),
    api.plant(plant.id), api.alerts("open"), api.summary(),
  ]), [plant.id, version]);

  if (error) return <ErrorState error={error} />;
  if (!data) return <PageSkeleton />;

  const [forecast, recs, generation, detail, alerts, summary] = data;
  const blocks = joinBlocks(forecast, recs);
  const scheduled = blocks.filter((b) => b.scheduled_kw > 0);
  const breached = blocks.filter((b) => b.rec);
  const exposure = sum(breached, (b) => b.rec.exposure_inr);
  const worst = maxBy(breached, (b) => b.rec.exposure_inr);
  const peak = maxBy(blocks, (b) => b.predicted_kw);
  const assetIds = new Set(detail.assets.map((a) => a.id));
  const plantAlerts = alerts.filter((a) => assetIds.has(a.asset_id));
  const atRisk = sum(plantAlerts, (a) => a.est_revenue_loss);
  const dayAgo = Date.now() - 24 * 3600 * 1000;
  const actuals = generation.filter((g) => new Date(g.timestamp).getTime() >= dayAgo);
  const openActions = (b) => navigate(`/actions?at=${encodeURIComponent(b.target_timestamp)}`);

  return (
    <div className="page">
      <PageHeader
        eyebrow={`${greeting()}, ${user.name.split(" ")[0]}`}
        title={plant.name}
        meta={(
          <>
            <MapPin size={14} />
            {plant.location ?? `${plant.latitude.toFixed(2)}, ${plant.longitude.toFixed(2)}`}
            <span className="dot-sep" />{power(plant.capacity_kw)} {plant.plant_type}
            <span className="dot-sep" />{plant.owner_type}
          </>
        )}
        aside={summary.plants > 1 && (
          <div className="portfolio">
            <span>Portfolio</span>
            <strong className="num">{summary.plants}</strong> plants
            <span className="dot-sep" /><strong className="num">{rupeesShort(summary.total_exposure_inr)}</strong> exposure
            <span className="dot-sep" /><strong className="num">{summary.open_alerts}</strong> open alerts
          </div>
        )}
      />

      <div className="kpi-grid">
        <Kpi tone={exposure ? "danger" : "ok"} label="Deviation exposure · 72h" value={exposure}
          format={rupeesShort} delay={0.05}
          sub={scheduled.length
            ? `${breached.length} of ${scheduled.length} scheduled blocks outside ±${band ?? "…"}%`
            : "No declared schedule on file"} />
        <Kpi tone="warn" label="Worst block" value={worst?.rec.exposure_inr ?? 0} format={rupees} delay={0.1}
          sub={worst
            ? `${dayShort(worst.t)} ${hhmm(worst.t)} · ${pct(worst.rec.deviation_pct)} ${worst.rec.window_type}`
            : "Nothing breaches the band"} />
        <Kpi tone="signal" label="Forecast energy · 72h" value={sum(blocks, (b) => b.predicted_kw * BLOCK_HOURS)}
          format={energy} delay={0.15}
          sub={peak ? `Peak ${power(peak.predicted_kw, plant.capacity_kw)} · ${dayShort(peak.t)} ${hhmm(peak.t)}` : ""} />
        <Kpi tone={atRisk ? "danger" : "ok"} label="Revenue at risk · assets" value={atRisk} format={rupees}
          delay={0.2}
          sub={plantAlerts.length
            ? `${plantAlerts.length} open asset alert${plantAlerts.length > 1 ? "s" : ""}`
            : "Every inverter tracking forecast"} />
      </div>

      <Panel title="72-hour outlook" meta="Last 24 hours of actual output, then the live forecast against your declared schedule"
        actions={<ChartLegend band={band} />} delay={0.15}>
        <ForecastChart blocks={blocks} actuals={actuals} band={band} capacityKw={plant.capacity_kw} height={360} />
      </Panel>

      <Panel title="Settlement runway" meta="Every 15-minute block for the next 72 hours, coloured by rupee exposure"
        delay={0.2}>
        <Runway blocks={blocks} capacityKw={plant.capacity_kw} onSelect={openActions} />
      </Panel>

      <div className="split">
        <Panel title="Act first" meta="Highest-exposure blocks" delay={0.25}
          actions={breached.length > 0 && <Link to="/actions" className="link">All {breached.length} →</Link>}>
          {breached.length
            ? <ActionList blocks={breached} limit={5} onSelect={openActions} />
            : <EmptyState title="Nothing to act on">No block in the next 72 hours breaches the tolerance band.</EmptyState>}
        </Panel>
        <Panel title="Asset pulse" meta={`${detail.assets.length} inverters`} delay={0.3}
          actions={<Link to="/assets" className="link">Asset health →</Link>}>
          <InverterGrid assets={detail.assets} openAlerts={plantAlerts} compact />
        </Panel>
      </div>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Working late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
