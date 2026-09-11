import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import Overview from "./pages/Overview.jsx";
import Forecast from "./pages/Forecast.jsx";
import Actions from "./pages/Actions.jsx";
import AssetHealth from "./pages/AssetHealth.jsx";

const NAV = [
  { to: "/overview", label: "Overview" },
  { to: "/forecast", label: "Forecast" },
  { to: "/actions", label: "Grid actions" },
  { to: "/assets", label: "Asset health" },
];

export default function App() {
  return (
    <div className="shell">
      <header className="topbar">
        <span className="wordmark">GridSense</span>
        <nav>
          {NAV.map(({ to, label }) => (
            <NavLink key={to} to={to} className={({ isActive }) => (isActive ? "active" : "")}>
              {label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<Navigate to="/overview" replace />} />
          <Route path="/overview" element={<Overview />} />
          <Route path="/forecast" element={<Forecast />} />
          <Route path="/actions" element={<Actions />} />
          <Route path="/assets" element={<AssetHealth />} />
        </Routes>
      </main>
    </div>
  );
}
