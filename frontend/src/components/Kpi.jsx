import { motion } from "framer-motion";
import { rise } from "../lib/motion.js";
import CountUp from "./CountUp.jsx";

// tone: signal | ok | warn | danger — sets the accent rail and glow.
export default function Kpi({ label, value, format, sub, tone = "signal", delay = 0 }) {
  return (
    <motion.div className={`kpi kpi-${tone}`} {...rise(delay)}>
      <span className="kpi-label">{label}</span>
      <span className="kpi-value"><CountUp value={value} format={format} /></span>
      {sub && <span className="kpi-sub">{sub}</span>}
      <span className="kpi-glow" aria-hidden="true" />
    </motion.div>
  );
}
