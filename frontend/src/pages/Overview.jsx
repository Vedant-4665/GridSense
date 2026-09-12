import { motion } from "framer-motion";
import { ArrowRight, CalendarCheck, MapPin, PiggyBank, RefreshCw, Sun } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";
import ActionList from "../components/ActionList.jsx";
import CountUp from "../components/CountUp.jsx";
import ForecastChart, { ChartLegend } from "../components/ForecastChart.jsx";
import InverterGrid from "../components/InverterGrid.jsx";
import Kpi from "../components/Kpi.jsx";
import PageHeader from "../components/PageHeader.jsx";
import Panel from "../components/Panel.jsx";
import { usePlants } from "../components/PlantContext.jsx";
import { EmptyState, ErrorState, PageSkeleton } from "../components/States.jsx";
import { useToast } from "../components/Toast.jsx";
import { useApi } from "../components/useApi.js";
import { BLOCK_HOURS, joinBlocks, maxBy, sum } from "../lib/blocks.js";
import { dayShort, energy, hhmm, pct, power, rupees, rupeesShort } from "../lib/format.js";
import Term from "../components/Term.jsx";
import { annualise, shareOfRevenue } from "../lib/scale.js";
import { rise } from "../lib/motion.js";

export default function Overview() {
  const { plant, version } = usePlants();
  const { isOwner } = useAuth();
  const navigate = useNavigate();
  const band = plant.band_pct;
  const { data, error } = useApi(() => Promise.all([
    api.forecast(plant.id, 72), api.recommendations(plant.id), api.generation(plant.id, 96),
    api.plant(plant.id), api.alerts("open"), api.summary(),
  ]), [plant.id, version]);

  if (error) return <ErrorState error={error} />;
  if (!data) return <PageSkeleton />;

  const [forecast, recs, generation, detail, alerts, summary] = data;
  const blocks = joinBlocks(forecast, recs);
  const scheduled = blocks.filter((b) => b.scheduled_kw != null);
  const breached = blocks.filter((b) => b.rec);
  const exposure = sum(breached, (b) => b.rec.exposure_inr);
  const worst = maxBy(breached, (b) => b.rec.exposure_inr);
  const peak = maxBy(blocks, (b) => b.predicted_kw);
  const assetIds = new Set(detail.assets.map((a) => a.id));
  const plantAlerts = alerts.filter((a) => assetIds.has(a.asset_id));
  const atRisk = sum(plantAlerts, (a) => a.est_revenue_loss);
  const dayAgo = Date.now() - 24 * 3600 * 1000;
  const actuals = generation.filter((g) => new Date(g.timestamp).getTime() >= dayAgo);
  const energyKwh = sum(blocks, (b) => b.predicted_kw * BLOCK_HOURS);

  if (plant.owner_type === "distributed") {
    return <RooftopOverview plant={plant} blocks={blocks} actuals={actuals} band={band}
      alerts={plantAlerts} energyKwh={energyKwh} assets={detail.assets} isOwner={isOwner} />;
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Overview"
        title={plant.name}
        meta={(
          <>
            <MapPin size={15} />
            {plant.location ?? `${plant.latitude.toFixed(2)}, ${plant.longitude.toFixed(2)}`}
            <span className="dot-sep" />{power(plant.capacity_kw)} {plant.plant_type}
            <span className="dot-sep" />
            {plant.owner_type === "utility" ? "Grid-connected" : "Rooftop"}
          </>
        )}
        aside={summary.plants > 1 && (
          <div className="portfolio">
            <span>All your plants</span>
            <strong className="num">{summary.plants}</strong> plants
            <span className="dot-sep" />
            <strong className="num">{rupeesShort(summary.total_exposure_inr)}</strong> at risk
          </div>
        )}
      />

      <Headline blocks={blocks} scheduled={scheduled} breached={breached} exposure={exposure}
        band={band} isOwner={isOwner} energyKwh={energyKwh} />

      <div className="kpi-grid">
        <Kpi tone={worst ? "danger" : "ok"} label="Costliest 15 minutes" delay={0.05}
          value={worst?.rec.exposure_inr ?? 0} format={rupees}
          sub={worst
            ? `${dayShort(worst.t)} at ${hhmm(worst.t)} · ${pct(worst.rec.deviation_pct)} below your schedule`
            : "No block breaches the band"} />
        <Kpi tone="ok" label="Electricity you'll generate" delay={0.1}
          value={energyKwh} format={energy}
          sub={peak ? `Busiest at ${hhmm(peak.t)} ${dayShort(peak.t)}, ${power(peak.predicted_kw, plant.capacity_kw)}` : "Next 72 hours"} />
        <Kpi tone={atRisk ? "danger" : "ok"} label="Equipment losing money" delay={0.15}
          value={atRisk} format={rupees}
          sub={plantAlerts.length
            ? `${plantAlerts.length} inverter${plantAlerts.length > 1 ? "s" : ""} under-performing`
            : "All inverters match their forecast"} />
      </div>

      <Panel title="The next 72 hours" delay={0.15}
        meta="Your last day of actual output, then what we expect you to generate against the schedule you filed."
        actions={<ChartLegend band={band} />}>
        <ForecastChart blocks={blocks} actuals={actuals} band={band} capacityKw={plant.capacity_kw} height={340} />
      </Panel>

      <div className="split">
        <Panel title="Fix these first" meta="The 15-minute blocks that cost the most" delay={0.2}
          actions={breached.length > 0 && <Link to="/actions" className="link">See all {breached.length} →</Link>}>
          {breached.length ? (
            <ActionList blocks={breached} limit={5}
              onSelect={(b) => navigate(`/actions?at=${encodeURIComponent(b.target_timestamp)}`)} />
          ) : (
            <EmptyState title="Nothing needs action">
              Every block in the next 72 hours stays inside the tolerance band.
            </EmptyState>
          )}
        </Panel>
        <Panel title="Your inverters" meta={`${detail.assets.length} units`} delay={0.25}
          actions={<Link to="/assets" className="link">Health check →</Link>}>
          <InverterGrid assets={detail.assets} openAlerts={plantAlerts} compact />
        </Panel>
      </div>
    </div>
  );
}

// One sentence that states the situation, plus the single action that follows from it.
function Headline({ blocks, scheduled, breached, exposure, band, isOwner, energyKwh }) {
  const { plant, bump } = usePlants();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function declareSchedule() {
    setBusy(true);
    try {
      const r = await api.declareSchedule(plant.id);
      toast({ title: "Schedule filed", body: `${r.blocks_declared} blocks now have a declared schedule to measure against.` });
      bump();
    } catch (e) {
      toast({ tone: "danger", title: "Couldn't declare the schedule", body: e.message });
    } finally {
      setBusy(false);
    }
  }

  async function runForecast() {
    setBusy(true);
    try {
      const r = await api.runForecast(plant.id);
      toast({ title: "Forecast updated", body: `${r.blocks_written} blocks from the latest weather.` });
      bump();
    } catch (e) {
      toast({ tone: "danger", title: "Forecast run failed", body: e.message });
    } finally {
      setBusy(false);
    }
  }

  if (!blocks.length) {
    return (
      <motion.section className="hero" {...rise()}>
        <p>No forecast yet for this plant.</p>
        <div className="hero-figure"><strong>Let's make one</strong></div>
        <p className="note">We'll pull the next 72 hours of weather for this location and predict what you'll generate.</p>
        {isOwner && (
          <div className="hero-actions">
            <button type="button" className="btn btn-primary btn-lg" onClick={runForecast} disabled={busy}>
              <RefreshCw size={16} /> Forecast the next 72 hours
            </button>
          </div>
        )}
      </motion.section>
    );
  }

  if (!scheduled.length) {
    return (
      <motion.section className="hero" {...rise()}>
        <p>We know what you'll generate. We don't yet know what you promised the grid.</p>
        <div className="hero-figure"><strong>File a schedule</strong></div>
        <p className="note">
          Deviation charges compare your output against the schedule you file with the load dispatch centre.
          Declare this forecast as that schedule and every block becomes costed.
        </p>
        {isOwner && (
          <div className="hero-actions">
            <button type="button" className="btn btn-primary btn-lg" onClick={declareSchedule} disabled={busy}>
              <CalendarCheck size={16} /> Use this forecast as my schedule
            </button>
          </div>
        )}
      </motion.section>
    );
  }

  if (!breached.length) {
    return (
      <motion.section className="hero is-clear" {...rise()}>
        <p>Across the next 72 hours, every block sits inside your ±{band ?? "…"}% tolerance band.</p>
        <div className="hero-figure">
          <strong>₹0</strong>
          <span className="hero-sub">in deviation charges expected</span>
        </div>
        <p className="note">Re-run the forecast as the weather changes; we'll flag any block that drifts outside the band.</p>
      </motion.section>
    );
  }

  const share = shareOfRevenue(exposure, energyKwh, plant.tariff_rate);
  return (
    <motion.section className="hero is-risk" {...rise()}>
      <p>Over the next 72 hours, you generate less than you{" "}
        <Term id="schedule">promised the grid</Term> in <strong>{breached.length}</strong> of{" "}
        {scheduled.length} <Term id="block">15-minute blocks</Term>.</p>
      <div className="hero-figure">
        <strong><CountUp value={exposure} format={rupeesShort} /></strong>
        <span className="hero-sub">in <Term id="deviation">deviation charges</Term>, if nothing changes</span>
      </div>
      <p className="scale-line">
        That is around <strong>{rupeesShort(annualise(exposure))} a year</strong> at this rate
        {share ? <> — roughly <strong>{share.toFixed(1)}%</strong> of what this plant earns</> : null}.
        Nobody notices it, because it arrives a few hundred rupees at a time.
      </p>
      <div className="hero-actions">
        <Link className="btn btn-primary btn-lg" to="/actions">
          Show me what to do <ArrowRight size={16} />
        </Link>
      </div>
    </motion.section>
  );
}

// Feature 8: the same engine, told as savings and habits rather than penalties.
function RooftopOverview({ plant, blocks, actuals, band, alerts, energyKwh, assets, isOwner }) {
  const worstAlert = alerts[0];
  const header = (
    <PageHeader eyebrow="Your solar system" title={plant.name}
      meta={<><MapPin size={15} />{plant.location ?? "—"}<span className="dot-sep" />{power(plant.capacity_kw)} on the roof</>} />
  );

  if (!blocks.length) {
    return (
      <div className="page">
        {header}
        <Headline blocks={blocks} scheduled={[]} breached={[]} exposure={0} band={band}
          isOwner={isOwner} energyKwh={0} />
      </div>
    );
  }

  const dailyKwh = energyKwh / 3;
  const monthlySaving = dailyKwh * 30 * (plant.tariff_rate ?? 0);
  const window = bestWindow(blocks);

  return (
    <div className="page">
      {header}

      <motion.section className={`hero ${worstAlert ? "is-risk" : "is-clear"}`} {...rise()}>
        <p>{worstAlert ? "Your system is not producing what the sunshine says it should." : "Everything looks healthy."}</p>
        <div className="hero-figure">
          <strong>{worstAlert ? `${Math.round(worstAlert.deviation_pct)}% low` : "Working normally"}</strong>
          <span className="hero-sub">
            {worstAlert
              ? `most likely ${worstAlert.suspected_cause === "soiling" ? "dirty panels — worth a clean" : "ageing panels"}`
              : "output matches the weather, day after day"}
          </span>
        </div>
      </motion.section>

      <div className="kpi-grid">
        <Kpi tone="ok" label="Electricity you'll make" value={energyKwh} format={energy} delay={0.05}
          sub={`About ${energy(dailyKwh)} a day over the next three days`} />
        <Kpi tone="ok" label="Money that saves you" value={monthlySaving} format={rupees} delay={0.1}
          sub={`Per month, at ₹${plant.tariff_rate}/unit off your bill`} />
        <Kpi tone="ok" label="Best time to run appliances" value={0} delay={0.15}
          format={() => window?.label ?? "—"}
          sub={window ? `${energy(window.kwh)} expected in that window` : "Run a forecast to find it"} />
      </div>

      <Panel title="When your panels will be busy" delay={0.2}
        meta="Washing machine, dishwasher, water heater: run them inside the green peak and you use your own electricity instead of buying it."
        actions={<ChartLegend band={band} showActual />}>
        <ForecastChart blocks={blocks} actuals={actuals} band={band} capacityKw={plant.capacity_kw} height={320} />
      </Panel>

      <div className="split">
        <Panel title="Your equipment" meta={`${assets.length} inverter${assets.length === 1 ? "" : "s"}`} delay={0.25}
          actions={<Link to="/assets" className="link">Health check →</Link>}>
          <InverterGrid assets={assets} openAlerts={alerts} />
        </Panel>
        <Panel title="What GridSense is watching for" delay={0.3}>
          <ul className="plain-list">
            <li><Sun size={16} /> Days when your output falls behind the sunshine, which usually means dust.</li>
            <li><PiggyBank size={16} /> The hours when running appliances costs you nothing extra.</li>
            <li><CalendarCheck size={16} /> Whether this month is genuinely worse, or just cloudier.</li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}

// The three-hour stretch tomorrow with the most expected output.
function bestWindow(blocks) {
  const span = 12;                       // 12 blocks = 3 hours
  if (blocks.length < span) return null;
  let best = null;
  for (let i = 0; i + span <= blocks.length; i += 1) {
    const slice = blocks.slice(i, i + span);
    const kwh = sum(slice, (b) => b.predicted_kw * BLOCK_HOURS);
    if (!best || kwh > best.kwh) best = { kwh, from: slice[0].t, to: slice[span - 1].t };
  }
  if (!best || !best.kwh) return null;
  return { ...best, label: `${hhmm(best.from)}–${hhmm(best.to + 15 * 60 * 1000)}` };
}
