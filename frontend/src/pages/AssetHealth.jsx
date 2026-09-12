import { motion } from "framer-motion";
import { Activity, Check, CheckCheck, Droplets, LoaderCircle, Stethoscope, ShieldCheck, Undo2 } from "lucide-react";
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
  const [scanning, setScanning] = useState(false);
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

  async function runCheck() {
    setScanning(true);
    try {
      const r = await api.runDiagnostic(plant.id);
      toast({
        tone: r.alerts ? "warn" : "ok",
        title: r.alerts
          ? `${r.alerts} inverter${r.alerts > 1 ? "s" : ""} under-performing`
          : "Every inverter checks out",
        body: `Compared ${r.assets_checked} inverters against what the weather says they should have produced.`,
      });
      bump();
    } catch (e) {
      toast({ tone: "danger", title: "Health check failed", body: e.message });
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="page">
      <PageHeader eyebrow="Equipment"
        title={open.length
          ? <><CountUp value={sum(open, (a) => a.est_revenue_loss)} format={rupees} />{" "}<span className="title-dim">lost to under-performing equipment</span></>
          : "Every inverter is producing what it should"}
        meta="On bright days an inverter should produce a known amount. When one keeps falling short and the weather cannot explain it, the panels are probably dirty or ageing. No extra sensors required."
        aside={isOwner && (
          <button type="button" className="btn" onClick={runCheck} disabled={scanning}>
            {scanning ? <LoaderCircle size={16} className="spin" /> : <Stethoscope size={16} />}
            {scanning ? "Checking…" : "Run health check"}
          </button>
        )} />

      <Panel title="Your inverters" delay={0.05}
        meta={`${detail.assets.length} units · ${power(sum(detail.assets, (a) => a.capacity_kw))} installed`}>
        <InverterGrid assets={detail.assets} openAlerts={open} />
      </Panel>

      <Panel title="What needs attention" meta="Ranked by the money each problem is costing you" delay={0.1}>
        {alerts.length ? (
          <div className="alerts">
            {alerts.map((alert) => (
              <AlertCard key={alert.id} alert={alert} asset={assets.get(alert.asset_id)}
                canAct={isOwner} busy={busy === alert.id} onStatus={setStatus} />
            ))}
          </div>
        ) : (
          <EmptyState icon={ShieldCheck} title="Nothing to report">
            No inverter has fallen behind its expected output for long enough to worry about.
          </EmptyState>
        )}
      </Panel>

      <Panel title="How we spot it" delay={0.15}>
        <ol className="how">
          <li><strong>Only bright hours</strong>We compare on sunny periods, when weather cannot be the excuse.</li>
          <li><strong>A real shortfall</strong>Output sits clearly below what the weather says it should be.</li>
          <li><strong>Hours, not minutes</strong>It must persist for about two hours, so a passing cloud never trips it.</li>
          <li><strong>Priced</strong>Lost electricity is converted to rupees, so the dirtiest panel gets cleaned first.</li>
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
          Producing {pct(alert.deviation_pct)} less than it should{alert.window_start && <> since {dayShort(alert.window_start)}</>}.
          Most likely {alert.suspected_cause === "soiling" ? "dirty panels" : "ageing panels"}.
        </p>
        <dl>
          <div><dt>Electricity lost</dt><dd className="num">{energy(alert.est_loss_kwh)}</dd></div>
          <div><dt>Money lost</dt><dd className="num">{rupees(alert.est_revenue_loss)}</dd></div>
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
