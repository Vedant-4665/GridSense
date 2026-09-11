// Every number on screen is formatted here, so units and rounding stay consistent.
const LOCALE = "en-IN";

export function rupees(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return "₹" + Number(value).toLocaleString(LOCALE, { maximumFractionDigits: 0 });
}

// Paise matter at block level, where exposures are often a few hundred rupees.
export function rupeesExact(value) {
  if (value == null) return "—";
  return "₹" + Number(value).toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Indian short scale: lakh (1e5) and crore (1e7).
export function rupeesShort(value) {
  if (value == null) return "—";
  const abs = Math.abs(value);
  if (abs >= 1e7) return `₹${(value / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `₹${(value / 1e5).toFixed(2)} L`;
  return rupees(value);
}

// Megawatts for utility-scale plants, kilowatts for rooftops.
export function power(kw, capacityKw = kw) {
  if (kw == null) return "—";
  return capacityKw >= 1000 ? `${(kw / 1000).toFixed(1)} MW` : `${Number(kw).toFixed(2)} kW`;
}

export function energy(kwh) {
  if (kwh == null) return "—";
  const opts = { maximumFractionDigits: 1 };
  if (Math.abs(kwh) >= 1000) return `${(kwh / 1000).toLocaleString(LOCALE, opts)} MWh`;
  return `${Number(kwh).toLocaleString(LOCALE, opts)} kWh`;
}

export const pct = (v, digits = 1) => (v == null ? "—" : `${Number(v).toFixed(digits)}%`);

export const hhmm = (t) =>
  new Date(t).toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit", hour12: false });
export const dayShort = (t) =>
  new Date(t).toLocaleDateString(LOCALE, { weekday: "short", day: "numeric" });
export const dayLong = (t) =>
  new Date(t).toLocaleDateString(LOCALE, { weekday: "long", day: "numeric", month: "short" });
