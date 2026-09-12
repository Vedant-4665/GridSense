import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, X } from "lucide-react";
import { useState } from "react";
import { BrandMark } from "./Brand.jsx";

const KEY = "gridsense.tour.v1";

const STEPS = [
  {
    title: "You promise. The grid checks.",
    body: "Every solar and wind plant tells the grid in advance how much electricity it will produce. Miss that promise and you pay a charge for the gap. GridSense predicts the gap before it happens, and prices it.",
  },
  {
    title: "Everything happens in 15 minutes",
    body: "The grid settles your output in 15-minute blocks. Three days ahead is 288 separate promises to keep, and each one is priced on its own, so a good day can still hide expensive quarter-hours.",
  },
  {
    title: "Small numbers, large total",
    body: "One bad block might cost ₹225. That sounds harmless, which is the trap: a 50 MW plant can lose roughly ₹25 lakh a year in exactly these increments, never noticing any single one.",
  },
  {
    title: "Three things to do, daily",
    body: "1. Update the forecast from the latest weather. 2. File it as the schedule you promise the grid. 3. Fix the blocks we flag, worst first. That is the whole product.",
  },
];

export function tourSeen() {
  try { return localStorage.getItem(KEY) === "1"; } catch { return true; }
}

export default function Tour({ open, onClose }) {
  const [step, setStep] = useState(0);
  const last = step === STEPS.length - 1;

  function finish() {
    try { localStorage.setItem(KEY, "1"); } catch { /* private mode */ }
    setStep(0);
    onClose();
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="tour-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={finish}>
          <motion.div className="tour" role="dialog" aria-modal="true" aria-label="How GridSense works"
            initial={{ opacity: 0, y: 20, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }} transition={{ duration: 0.3 }}
            onClick={(e) => e.stopPropagation()}>
            <header className="tour-head">
              <BrandMark size={26} />
              <span>How GridSense works</span>
              <button type="button" className="tour-close" onClick={finish} aria-label="Close">
                <X size={16} />
              </button>
            </header>

            <AnimatePresence mode="wait">
              <motion.div key={step} className="tour-body"
                initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.2 }}>
                <h2>{STEPS[step].title}</h2>
                <p>{STEPS[step].body}</p>
              </motion.div>
            </AnimatePresence>

            <footer className="tour-foot">
              <div className="tour-dots" aria-hidden="true">
                {STEPS.map((s, i) => <i key={s.title} className={i === step ? "is-on" : ""} />)}
              </div>
              <div className="tour-buttons">
                <button type="button" className="btn btn-ghost" onClick={finish}>
                  {last ? "Close" : "Skip"}
                </button>
                {!last && (
                  <button type="button" className="btn btn-primary" onClick={() => setStep((s) => s + 1)}>
                    Next <ArrowRight size={16} />
                  </button>
                )}
                {last && (
                  <button type="button" className="btn btn-primary" onClick={finish}>
                    Show me my plant <ArrowRight size={16} />
                  </button>
                )}
              </div>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
