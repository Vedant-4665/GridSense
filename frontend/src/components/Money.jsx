// Rupee figures appear on every page. Format them in exactly one place.
export function rupees(value) {
  if (value == null) return "—";
  return "₹" + Number(value).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

export default function Money({ value }) {
  return <span className="money">{rupees(value)}</span>;
}
