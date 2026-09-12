import { motion } from "framer-motion";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext.jsx";
import { BrandMark } from "./components/Brand.jsx";
import { PlantProvider } from "./components/PlantContext.jsx";
import Shell from "./components/Shell.jsx";
import { ToastProvider } from "./components/Toast.jsx";
import Actions from "./pages/Actions.jsx";
import AddPlant from "./pages/AddPlant.jsx";
import AssetHealth from "./pages/AssetHealth.jsx";
import AuthPage from "./pages/AuthPage.jsx";
import Forecast from "./pages/Forecast.jsx";
import Insights from "./pages/Insights.jsx";
import Overview from "./pages/Overview.jsx";

export default function App() {
  const { user } = useAuth();
  if (user === undefined) return <BootScreen />;

  const app = (
    <PlantProvider>
      <ToastProvider>
        <Shell />
      </ToastProvider>
    </PlantProvider>
  );

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/overview" replace /> : <AuthPage mode="login" />} />
      <Route path="/register" element={user ? <Navigate to="/overview" replace /> : <AuthPage mode="register" />} />
      <Route element={user ? app : <Navigate to="/login" replace />}>
        <Route path="/overview" element={<Overview />} />
        <Route path="/forecast" element={<Forecast />} />
        <Route path="/actions" element={<Actions />} />
        <Route path="/assets" element={<AssetHealth />} />
        <Route path="/insights" element={<Insights />} />
        <Route path="/plants/new" element={<AddPlant />} />
      </Route>
      <Route path="*" element={<Navigate to={user ? "/overview" : "/login"} replace />} />
    </Routes>
  );
}

// Shown for the moment it takes /api/auth/me to answer.
function BootScreen() {
  return (
    <div className="boot">
      <div className="backdrop" aria-hidden="true" />
      <motion.div animate={{ opacity: [0.35, 1, 0.35] }} transition={{ repeat: Infinity, duration: 1.6 }}>
        <BrandMark size={48} />
      </motion.div>
    </div>
  );
}
