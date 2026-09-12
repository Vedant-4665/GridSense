// The mark: a day's generation curve with the sun at its peak, over a settlement baseline.
export function BrandMark({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id="gs-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0f7a58" />
          <stop offset="1" stopColor="#e9a13b" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="9" fill="rgba(15,122,88,0.06)" stroke="url(#gs-mark)" strokeWidth="1.4" />
      <path d="M6 20 C10 20 11 9 16 9 S22 20 26 20" fill="none" stroke="url(#gs-mark)" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="16" cy="9" r="2.5" fill="#e9a13b" />
      <path d="M6 24.5 H26" stroke="#c3cec8" strokeWidth="1.2" strokeDasharray="1.5 2.5" />
    </svg>
  );
}

export default function Brand() {
  return (
    <div className="brand">
      <BrandMark />
      <span className="brand-word">Grid<span>Sense</span></span>
    </div>
  );
}
