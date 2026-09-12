import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { useState } from "react";

// Detail that a newcomer should not have to meet on arrival.
export default function Collapsible({ label, children, open: initiallyOpen = false }) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <div className="disclose">
      <button type="button" className="disclose-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <ChevronRight size={16} className={open ? "is-open" : ""} />
        {label}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div key="body" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} style={{ overflow: "hidden" }}>
            <div className="disclose-body">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
