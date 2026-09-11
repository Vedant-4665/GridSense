import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { useEffect, useState } from "react";

// Login-page illustration: the sun crosses the sky and the 15-minute blocks
// beneath it light up, a few of them red where the forecast misses the band.
// Decorative only; none of these numbers are live data.

const W = 560;
const BASE = 250;
const CX = 280;
const RX = 230;
const RY = 190;
const PEAK = 140;
const N = 46;
const BAR_W = (2 * RX) / N - 3;

const BARS = Array.from({ length: N }, (_, i) => {
  const f = (i + 0.5) / N;
  const clear = Math.sin(Math.PI * f) ** 1.3;
  const cloud = 1 - 0.34 * Math.max(0, Math.sin(i * 1.9) * Math.sin(i * 0.41 + 1));
  return { x: CX - RX + f * 2 * RX, h: clear * cloud * PEAK, clearH: clear * PEAK, breach: clear > 0.35 && cloud < 0.86 };
});

const BAND = (() => {
  const top = BARS.map((b) => `${b.x},${BASE - b.clearH * 0.97 * 1.05}`);
  const bottom = BARS.map((b) => `${b.x},${BASE - b.clearH * 0.97 * 0.95}`).reverse();
  return `M${top.join(" L")} L${bottom.join(" L")} Z`;
})();
const FORECAST = `M${BARS.map((b) => `${b.x},${BASE - b.h}`).join(" L")}`;

const READOUTS = [
  "06:45 · forecast 4.1 MW · within band",
  "10:30 · forecast 31.8 MW · 14% under · ₹225",
  "12:15 · forecast 47.9 MW · within band",
  "14:45 · cloud bank · 26% under · ₹1,310",
  "17:30 · forecast 9.6 MW · within band",
];

export default function SunArc() {
  const reduce = useReducedMotion();
  const progress = useMotionValue(0.62);

  useEffect(() => {
    if (reduce) return undefined;
    progress.set(0);
    const controls = animate(progress, 1, { duration: 14, ease: "linear", repeat: Infinity, repeatDelay: 0.8 });
    return () => controls.stop();
  }, [reduce, progress]);

  const sx = useTransform(progress, (v) => CX - RX * Math.cos(Math.PI * v));
  const sy = useTransform(progress, (v) => BASE - RY * Math.sin(Math.PI * v));
  const lit = useTransform(sx, (x) => Math.max(0, x - (CX - RX) + BAR_W));

  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (reduce) return undefined;
    const id = setInterval(() => setTick((t) => (t + 1) % READOUTS.length), 2800);
    return () => clearInterval(id);
  }, [reduce]);

  return (
    <div className="sunarc">
      <svg viewBox={`0 0 ${W} 290`} role="img"
        aria-label="Illustration: the sun crosses the sky while 15-minute generation blocks light up beneath it">
        <defs>
          <radialGradient id="sun-glow">
            <stop offset="0" stopColor="#ffd28a" stopOpacity="0.95" />
            <stop offset="0.35" stopColor="#ffb547" stopOpacity="0.45" />
            <stop offset="1" stopColor="#ffb547" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="bar-ok" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#36f1c2" stopOpacity="0.95" />
            <stop offset="1" stopColor="#36f1c2" stopOpacity="0.12" />
          </linearGradient>
          <linearGradient id="bar-hot" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ff5c63" stopOpacity="0.95" />
            <stop offset="1" stopColor="#ff5c63" stopOpacity="0.15" />
          </linearGradient>
          <clipPath id="sun-lit">
            <motion.rect x={CX - RX - BAR_W} y="0" height="290" width={lit} />
          </clipPath>
        </defs>

        <path d={`M${CX - RX} ${BASE} A ${RX} ${RY} 0 0 1 ${CX + RX} ${BASE}`}
          fill="none" stroke="rgba(255,181,71,0.3)" strokeDasharray="2 6" />
        <path d={BAND} fill="rgba(255,181,71,0.09)" stroke="rgba(255,181,71,0.35)" strokeWidth="0.8" />

        <g opacity="0.16">
          {BARS.map((b, i) => (
            <rect key={i} x={b.x - BAR_W / 2} y={BASE - b.h} width={BAR_W} height={b.h} rx="1.5" fill="#6b7f7a" />
          ))}
        </g>
        <g clipPath="url(#sun-lit)">
          {BARS.map((b, i) => (
            <rect key={i} x={b.x - BAR_W / 2} y={BASE - b.h} width={BAR_W} height={b.h} rx="1.5"
              fill={b.breach ? "url(#bar-hot)" : "url(#bar-ok)"} />
          ))}
          <path d={FORECAST} fill="none" stroke="#36f1c2" strokeWidth="1.8" className="sunarc-forecast" />
        </g>

        <line x1={CX - RX - 12} x2={CX + RX + 12} y1={BASE} y2={BASE} stroke="rgba(228,240,236,0.25)" />
        {[["06:00", CX - RX], ["12:00", CX], ["18:00", CX + RX]].map(([label, x]) => (
          <text key={label} x={x} y={BASE + 20} textAnchor="middle" className="sunarc-label">{label}</text>
        ))}

        <motion.line x1={sx} x2={sx} y1={sy} y2={BASE} stroke="rgba(255,210,138,0.22)" strokeDasharray="2 4" />
        <motion.circle cx={sx} cy={sy} r="36" fill="url(#sun-glow)" />
        <motion.circle cx={sx} cy={sy} r="7" fill="#ffe2b0" />
      </svg>

      <div className="sunarc-readout">
        <span className="live-dot" />
        <AnimatePresence mode="wait">
          <motion.span key={tick} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}>
            {READOUTS[tick]}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}
