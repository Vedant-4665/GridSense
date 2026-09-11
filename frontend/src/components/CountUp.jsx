import { animate, useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";

// A number that rolls to its new value instead of snapping.
export default function CountUp({ value, format = (v) => Math.round(v).toString(), duration = 1.2 }) {
  const ref = useRef(null);
  const from = useRef(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (value == null || !node) return undefined;
    const start = from.current;
    from.current = value;
    if (reduce) {
      node.textContent = format(value);
      return undefined;
    }
    const controls = animate(start, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => { node.textContent = format(v); },
    });
    return () => controls.stop();
  }, [value]);

  return <span ref={ref} className="num">{value == null ? "—" : format(0)}</span>;
}
