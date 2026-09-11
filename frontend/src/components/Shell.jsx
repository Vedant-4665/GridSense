import { AnimatePresence, motion } from "framer-motion";
import {
  Activity, ChartSpline, ChevronDown, Cpu, Eye, LayoutDashboard, LoaderCircle, LogOut, Plus,
  RefreshCw, Sun, Wind, Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { ROLES } from "../auth/roles.js";
import { hhmm, power, rupees } from "../lib/format.js";
import { EASE } from "../lib/motion.js";
import Brand from "./Brand.jsx";
import { usePlants } from "./PlantContext.jsx";
import { EmptyState, ErrorState, PageSkeleton } from "./States.jsx";
import { useToast } from "./Toast.jsx";

const NAV = [
  { to: "/overview", label: "Command", icon: LayoutDashboard },
  { to: "/forecast", label: "Forecast", icon: ChartSpline },
  { to: "/actions", label: "Grid actions", icon: Zap },
  { to: "/assets", label: "Asset health", icon: Cpu },
];

export default function Shell() {
  const { user, isOwner, logout } = useAuth();
  const { plants, plant, error } = usePlants();
  const location = useLocation();
  const role = ROLES[user.role];
  const RoleIcon = role?.icon ?? Activity;

  let content;
  if (error) content = <ErrorState error={error} />;
  else if (!plants) content = <PageSkeleton />;
  else if (!plant && location.pathname !== "/plants/new") content = <NoPlants isOwner={isOwner} />;
  else content = <Outlet />;

  return (
    <div className="shell">
      <div className="backdrop" aria-hidden="true" />

      <aside className="sidebar">
        <Brand />
        <nav className="nav" aria-label="Main">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className="nav-link">
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span layoutId="nav-active" className="nav-active"
                      transition={{ type: "spring", stiffness: 500, damping: 38 }} />
                  )}
                  <Icon size={18} strokeWidth={1.8} />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
          {isOwner && (
            <>
              <span className="nav-sep" />
              <NavLink to="/plants/new" className="nav-link">
                {({ isActive }) => (
                  <>
                    {isActive && <motion.span layoutId="nav-active" className="nav-active" />}
                    <Plus size={18} strokeWidth={1.8} />
                    <span>Add plant</span>
                  </>
                )}
              </NavLink>
            </>
          )}
        </nav>

        <div className="sidebar-foot">
          <div className="user-card">
            <span className="avatar"><RoleIcon size={16} /></span>
            <div className="user-meta">
              <strong>{user.name}</strong>
              <span>{role?.label}{user.organisation ? ` · ${user.organisation}` : ""}</span>
            </div>
          </div>
          <button type="button" className="btn btn-ghost btn-block" onClick={logout}>
            <LogOut size={16} /> Log out
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          {plant ? <PlantSwitcher /> : <span />}
          <div className="topbar-right">
            <LiveClock />
            {!isOwner && <span className="pill pill-muted"><Eye size={14} /> Read-only</span>}
            {isOwner && plant && <RunForecastButton />}
          </div>
        </header>
        <motion.main key={location.pathname + (plant?.id ?? "")} className="content"
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: EASE }}>
          {content}
        </motion.main>
      </div>
    </div>
  );
}

function NoPlants({ isOwner }) {
  const navigate = useNavigate();
  return (
    <EmptyState
      icon={Sun}
      title={isOwner ? "Add your first plant" : "No plants on the network yet"}
      action={isOwner && (
        <button type="button" className="btn btn-primary" onClick={() => navigate("/plants/new")}>
          <Plus size={16} /> Add a plant
        </button>
      )}>
      {isOwner
        ? "Tell GridSense where your plant is and how big it is. Its first 72-hour forecast runs straight away."
        : "Plants appear here as their owners register them."}
    </EmptyState>
  );
}

function PlantSwitcher() {
  const { plants, plant, select } = usePlants();
  const { isOwner } = useAuth();
  const navigate = useNavigate();
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

  const TypeIcon = plant.plant_type === "wind" ? Wind : Sun;
  return (
    <div className="switcher" ref={ref}>
      <button type="button" className="switcher-btn" onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox" aria-expanded={open}>
        <span className="switcher-icon"><TypeIcon size={16} /></span>
        <span className="switcher-text">
          <strong>{plant.name}</strong>
          <small>{plant.location ?? "—"} · {power(plant.capacity_kw)}</small>
        </span>
        <ChevronDown size={16} className={`switcher-caret ${open ? "is-open" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul className="switcher-menu" role="listbox"
            initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }} transition={{ duration: 0.16 }}>
            {plants.map((p) => (
              <li key={p.id}>
                <button type="button" role="option" aria-selected={p.id === plant.id}
                  className={p.id === plant.id ? "is-selected" : ""}
                  onClick={() => { select(p.id); setOpen(false); }}>
                  <span>{p.name}</span>
                  <small>{p.location ?? "—"} · {power(p.capacity_kw)} · {p.plant_type}</small>
                </button>
              </li>
            ))}
            {isOwner && (
              <li>
                <button type="button" className="switcher-add"
                  onClick={() => { setOpen(false); navigate("/plants/new"); }}>
                  <Plus size={14} /> Add a plant
                </button>
              </li>
            )}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

// Wall clock plus the settlement block in progress, the unit everything is priced in.
function LiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const blockStart = new Date(now);
  blockStart.setMinutes(now.getMinutes() - (now.getMinutes() % 15), 0, 0);
  const blockEnd = new Date(blockStart.getTime() + 15 * 60 * 1000);

  return (
    <div className="clock" aria-label="Current time and settlement block">
      <span className="live-dot" />
      <span className="clock-time num">{now.toLocaleTimeString("en-IN", { hour12: false })}</span>
      <span className="clock-block">Block {hhmm(blockStart)}–{hhmm(blockEnd)}</span>
    </div>
  );
}

function RunForecastButton() {
  const { plant, bump } = usePlants();
  const toast = useToast();
  const [running, setRunning] = useState(false);
  const solar = plant.plant_type === "solar";

  async function run() {
    setRunning(true);
    try {
      const r = await api.runForecast(plant.id);
      const uncosted = r.unscheduled_blocks === r.blocks_written;
      toast({
        tone: uncosted || !r.breached_blocks ? "ok" : "warn",
        title: `Forecast refreshed · ${r.blocks_written} blocks`,
        body: uncosted
          ? "No declared schedule on file yet, so nothing was costed."
          : `${r.breached_blocks} blocks outside the band · ${rupees(r.total_exposure_inr)} exposure`,
      });
      bump();
    } catch (e) {
      toast({ tone: "danger", title: "Forecast run failed", body: e.message });
    } finally {
      setRunning(false);
    }
  }

  return (
    <button type="button" className="btn btn-primary" onClick={run} disabled={running || !solar}
      title={solar ? "Pull live weather and re-forecast the next 72 hours" : "Forecasting is solar-only for now"}>
      {running ? <LoaderCircle size={16} className="spin" /> : <RefreshCw size={16} />}
      {running ? "Forecasting…" : "Run forecast"}
    </button>
  );
}
