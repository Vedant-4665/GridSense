import { createContext, useCallback, useContext, useMemo, useState } from "react";

// Two audiences, one app. Plain mode explains everything in ordinary words;
// expert mode restores the regulatory vocabulary and opens the detail panels.
const ViewModeContext = createContext(null);
const KEY = "gridsense.expert";

export function ViewModeProvider({ children }) {
  const [expert, setExpert] = useState(() => {
    try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
  });

  const toggle = useCallback(() => setExpert((was) => {
    const next = !was;
    try { localStorage.setItem(KEY, next ? "1" : "0"); } catch { /* private mode */ }
    return next;
  }), []);

  const value = useMemo(() => ({
    expert,
    toggle,
    // say("what anyone understands", "what the regulation calls it")
    say: (plain, technical) => (expert ? technical : plain),
  }), [expert, toggle]);

  return <ViewModeContext.Provider value={value}>{children}</ViewModeContext.Provider>;
}

export const useViewMode = () => useContext(ViewModeContext);
