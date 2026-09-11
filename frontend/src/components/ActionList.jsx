import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { actionFor } from "../lib/actions.js";
import { dayShort, hhmm, pct, rupeesExact } from "../lib/format.js";

// Breached blocks ranked by rupee exposure, the order an operator should work through them.
export default function ActionList({ blocks, limit, selected, onSelect }) {
  const rows = [...blocks].sort((a, b) => b.rec.exposure_inr - a.rec.exposure_inr).slice(0, limit ?? blocks.length);
  const max = rows[0]?.rec.exposure_inr || 1;

  return (
    <ol className="actions">
      {rows.map((b, i) => {
        const action = actionFor(b.rec.action_type);
        const Icon = action.icon;
        const Direction = b.rec.window_type === "under" ? ArrowDownRight : ArrowUpRight;
        return (
          <motion.li key={b.target_timestamp} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i, 12) * 0.03 }}>
            <button type="button" onClick={() => onSelect?.(b)}
              className={`action-row sev-${b.rec.severity} ${selected === b.target_timestamp ? "is-selected" : ""}`}>
              <span className="action-rank num">{String(i + 1).padStart(2, "0")}</span>
              <span className="action-when">
                <strong className="num">{hhmm(b.t)}</strong>
                <small>{dayShort(b.t)}</small>
              </span>
              <span className="action-what">
                <span className="action-dir"><Direction size={14} />{pct(b.rec.deviation_pct)} {b.rec.window_type}</span>
                <span className="action-type"><Icon size={13} />{action.label}</span>
              </span>
              <span className="action-bar" aria-hidden="true">
                <i style={{ width: `${(b.rec.exposure_inr / max) * 100}%` }} />
              </span>
              <span className="action-money num">{rupeesExact(b.rec.exposure_inr)}</span>
            </button>
          </motion.li>
        );
      })}
    </ol>
  );
}
