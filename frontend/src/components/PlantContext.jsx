import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../api/client.js";

const PlantContext = createContext(null);
const STORAGE_KEY = "gridsense.plant";

function storedPlantId() {
  try {
    return Number(localStorage.getItem(STORAGE_KEY)) || null;
  } catch {
    return null;
  }
}

// The plants this user can see, and which one every page is looking at.
export function PlantProvider({ children }) {
  const [plants, setPlants] = useState(null);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(storedPlantId);
  // Bumped after anything that changes plant data (a forecast run, an alert
  // update), so every page refetches.
  const [version, setVersion] = useState(0);

  const refresh = useCallback(
    () => api.plants().then((ps) => { setPlants(ps); setError(null); }).catch(setError),
    [],
  );
  useEffect(() => { refresh(); }, [refresh]);

  const select = useCallback((id) => {
    setSelectedId(id);
    try {
      localStorage.setItem(STORAGE_KEY, String(id));
    } catch {
      // Storage unavailable (private mode); selection just won't persist.
    }
  }, []);

  const bump = useCallback(() => setVersion((v) => v + 1), []);
  const plant = plants?.find((p) => p.id === selectedId) ?? plants?.[0] ?? null;

  const value = useMemo(
    () => ({ plants, plant, error, select, refresh, version, bump }),
    [plants, plant, error, select, refresh, version, bump],
  );
  return <PlantContext.Provider value={value}>{children}</PlantContext.Provider>;
}

export const usePlants = () => useContext(PlantContext);
