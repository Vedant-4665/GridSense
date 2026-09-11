import { motion } from "framer-motion";

// Segmented control with a sliding pill. `id` must be unique on the page (it names the shared layout).
export default function Segmented({ id, options, value, onChange }) {
  return (
    <div className="segmented" role="tablist">
      {options.map(([v, label]) => (
        <button key={v} type="button" role="tab" aria-selected={v === value}
          className={v === value ? "is-active" : ""} onClick={() => onChange(v)}>
          {v === value && (
            <motion.span layoutId={`seg-${id}`} className="segmented-pill"
              transition={{ type: "spring", stiffness: 500, damping: 40 }} />
          )}
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
