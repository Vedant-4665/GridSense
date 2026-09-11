import { motion } from "framer-motion";
import { Activity, Check, CheckCheck, Droplets, ShieldCheck, Undo2 } from "lucide-react";
import { useState } from "react";
import { api } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";
import CountUp from "../components/CountUp.jsx";
import InverterGrid from "../components/InverterGrid.jsx";
import PageHeader from "../components/PageHeader.jsx";
import Panel from "../components/Panel.jsx";
import { usePlants } from "../components/PlantContext.jsx";
import { EmptyState, ErrorState, PageSkeleton } from "../components/States.jsx";
import { useToast } from "../components/Toast.jsx";
import { useApi } from "../components/useApi.js";
import { sum } from "../lib/blocks.js";
import { dayShort, energy, pct, power, rupees } from "../lib/format.js";

const STATUS = { open: "Open", ack: "Acknowledged", resolved: "Resolved" };
const DONE = { open: "Alert reopened", ack: "Alert acknowledged", resolved: "Alert resolved" };

export default function AssetHealth() {
  const { plant, version, bump } = usePlants();
  const { isOwner } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(null);
  const { data, error } = useApi(() => Promise.all([api.plant(plant.id), api.alerts()]), [plant.id, version]);

  if (error) return <ErrorState error={error} />;
  if (!data) return <PageSkeleton />;

  const [detail, allAlerts] = data;
  const assets = new Map(detail.assets.map((a) => [a.id, a]));
  const alerts = allAlerts.filter((a) => assets.has(a.asset_id));
  const open = alerts.filter((a) => a.status === "open");

  async function setStatus(alert, status) {
    setBusy(alert.id);
    try {
      await api.updateAlert(alert.id, status);
      toast({ tone: "ok", title: DONE[status] });
      bump();
    } catch (e) {
      toast({ tone: "danger", title: "Couldn't update the alert", body: e.message });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="page">
      <PageHeader eyebrow="Asset health"
        title={open.length
          ? <><CountUp value={sum(open, (a) => a.est_revenue_loss)} format={rupees} />{" "}<span className="title-dim">of revenue leaking</span></>
          : "Every inverter is tracking its forecast"}
        meta="Sustained gaps between forecast and actual output in clear-sky hours, the signature of soiling or degradation. No extra sensors needed." />

      <Panel title="Inverter fleet" delay={0.05}
        meta={`${detail.assets.length} inverters · ${power(sum(detail.assets, (a) => a.capacity_kw))} installed`}>
        <InverterGrid assets={detail.assets} openAlerts={open} />
      </Panel>

      <Panel title="Deviation alerts" meta="Ranked by revenue lost" delay={0.1}>
        {alerts.length ? (
          <div className="alerts">
            {alerts.map((alert) => (
              <AlertCard key={alert.id} alert={alert} asset={assets.get(alert.asset_id)}
                canAct={isOwner} busy={busy === alert.id} onStatus={setStatus} />
            ))}
          </div>
        ) : (
          <EmptyState icon={ShieldCheck} title="No alerts">
            Nothing has drifted from its forecast long enough to flag.
          </EmptyState>
        )}
      </Panel>

      <Panel title="How detection works" delay={0.15}>
        <ol className="how">
          <li><strong>Clear sky only</strong>Irradiance is high, so weather can't explain a shortfall.</li>
          <li><strong>A sustained gap</strong>Actual output sits well below the forecast, beyond normal model error.</li>
          <li><strong>Hours, not minutes</strong>The gap has to persist for about two hours, so a passing cloud never trips it.</li>
          <li><strong>Priced</strong>Lost energy is costed, so the site that leaks the most money is cleaned first.</li>
        </ol>
      </Panel>
    </div>
  );
}

function AlertCard({ alert, asset, canAct, busy, onStatus }) {
  const Cause = alert.suspected_cause === "soiling" ? Droplets : Activity;
  return (
    <motion.article layout className={`alert-card st-${alert.status}`}>
      <span className="alert-icon"><Cause size={20} /></span>
      <div className="alert-body">
        <header>
          <strong>{asset?.asset_name ?? `Asset ${alert.asset_id}`}</strong>
          <span className={`badge badge-${alert.status}`}>{STATUS[alert.status]}</span>
        </header>
        <p>
          Suspected <b>{alert.suspected_cause}</b> · output {pct(alert.deviation_pct)} below forecast
          {alert.window_start && <> since {dayShort(alert.window_start)}</>}
        </p>
        <dl>
          <div><dt>Energy lost</dt><dd className="num">{energy(alert.est_loss_kwh)}</dd></div>
          <div><dt>Revenue lost</dt><dd className="num">{rupees(alert.est_revenue_loss)}</dd></div>
          <div><dt>Severity</dt><dd>{alert.severity}</dd></div>
        </dl>
      </div>
      {canAct && (
        <div className="alert-actions">
          {alert.status === "open" && (
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => onStatus(alert, "ack")}>
              <Check size={14} /> Acknowledge
            </button>
          )}
          {alert.status !== "resolved" && (
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => onStatus(alert, "resolved")}>
              <CheckCheck size={14} /> Resolve
            </button>
          )}
          {alert.status !== "open" && (
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => onStatus(alert, "open")}>
              <Undo2 size={14} /> Reopen
            </button>
          )}
        </div>
      )}
    </motion.article>
  );
}
