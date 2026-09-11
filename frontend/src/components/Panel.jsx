import { motion } from "framer-motion";
import { rise } from "../lib/motion.js";

// The instrument panel every section sits in: corner ticks, mono title, optional actions.
export default function Panel({ title, meta, actions, children, className = "", delay = 0 }) {
  return (
    <motion.section className={`panel ${className}`} {...rise(delay)}>
      {(title || actions) && (
        <header className="panel-head">
          <div>
            {title && <h2 className="panel-title">{title}</h2>}
            {meta && <p className="panel-meta">{meta}</p>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </motion.section>
  );
}
