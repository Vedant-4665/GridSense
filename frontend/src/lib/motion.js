// One easing curve for the whole app: fast out, long settle.
export const EASE = [0.16, 1, 0.3, 1];

// Spread onto a motion element to fade it up into place.
export const rise = (delay = 0) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: EASE },
});
