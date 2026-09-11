import { TriangleAlert } from "lucide-react";

export function Skeleton({ h = 120 }) {
  return <div className="skeleton" style={{ height: h }} />;
}

export function PageSkeleton() {
  return (
    <div className="page" aria-busy="true" aria-label="Loading">
      <Skeleton h={64} />
      <div className="kpi-grid">{[0, 1, 2, 3].map((i) => <Skeleton key={i} h={118} />)}</div>
      <Skeleton h={400} />
      <Skeleton h={160} />
    </div>
  );
}

export function ErrorState({ error }) {
  return (
    <div className="state state-error" role="alert">
      <span className="state-icon"><TriangleAlert size={24} /></span>
      <h3>Couldn't load this view</h3>
      <p>{error?.message ?? "Something went wrong."} Is the API running?</p>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="state">
      {Icon && <span className="state-icon"><Icon size={24} /></span>}
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}
