import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { GLOSSARY } from "../lib/glossary.js";

// A word with a dotted underline: tap it and the definition appears in place.
export default function Term({ id, children }) {
  const entry = GLOSSARY[id];
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!entry) return children;

  return (
    <span className="term-wrap" ref={ref}>
      <button type="button" className="term" onClick={() => setOpen((o) => !o)}
        aria-expanded={open} aria-label={`What is a ${entry.term}?`}>
        {children ?? entry.term}
      </button>
      <AnimatePresence>
        {open && (
          <motion.span className="term-pop" role="tooltip"
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}>
            <strong>{entry.term}</strong>
            {entry.body}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
