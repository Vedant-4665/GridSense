import { motion } from "framer-motion";
import { rise } from "../lib/motion.js";

export default function PageHeader({ eyebrow, title, meta, aside }) {
  return (
    <motion.header className="page-head" {...rise()}>
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="page-title">{title}</h1>
        {meta && <div className="page-meta">{meta}</div>}
      </div>
      {aside}
    </motion.header>
  );
}
