// A three-day figure means nothing on its own. The ideation's point is that
// operators lose lakhs in increments they never see, so every rupee total gets
// scaled to a year and to the plant's own revenue.

export const annualise = (over72h) => (over72h / 3) * 365;

export function annualRevenue(energy72hKwh, tariffPerKwh) {
  if (!energy72hKwh || !tariffPerKwh) return null;
  return (energy72hKwh / 3) * 365 * tariffPerKwh;
}

export function shareOfRevenue(charge72h, energy72hKwh, tariffPerKwh) {
  const revenue = annualRevenue(energy72hKwh, tariffPerKwh);
  if (!revenue) return null;
  return (annualise(charge72h) / revenue) * 100;
}
