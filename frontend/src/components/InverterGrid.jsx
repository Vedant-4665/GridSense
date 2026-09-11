import { motion } from "framer-motion";
import { Cpu } from "lucide-react";
import { pct, power } from "../lib/format.js";

// One tile per inverter. A tile with an open deviation alert pulses.
export default function InverterGrid({ assets, openAlerts, compact = false }) {
  if (!assets.length) return <p className="muted">No inverters registered for this plant.</p>;
  const alertByAsset = new Map(openAlerts.map((a) => [a.asset_id, a]));

  return (
    <div className={`inverters ${compact ? "is-compact" : ""}`}>
      {assets.map((asset, i) => {
        const alert = alertByAsset.get(asset.id);
        // An asset flagged in the past but with no open alert stays on watch.
        const status = alert ? "alert" : asset.status === "alert" ? "watch" : asset.status;
        return (
          <motion.div key={asset.id} className={`inverter st-${status}`}
            initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.035 }}>
            <Cpu size={compact ? 14 : 18} />
            <strong>{asset.asset_name ?? asset.source_key}</strong>
            {!compact && <small>{power(asset.capacity_kw)}</small>}
            <span className="inverter-state">
              {alert ? `${pct(alert.deviation_pct)} below` : status === "healthy" ? "On forecast" : status}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}
