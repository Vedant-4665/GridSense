import { useEffect, useState } from "react";
import { api } from "../api/client.js";

// The tolerance band lives in backend config, per state commission. Ask the
// costing endpoint for it rather than keeping a second copy here.
const cache = new Map();

export function useBand(plantType) {
  const [band, setBand] = useState(() => cache.get(plantType) ?? null);

  useEffect(() => {
    if (cache.has(plantType)) {
      setBand(cache.get(plantType));
      return undefined;
    }
    let alive = true;
    api.costingPreview({ scheduled_kwh: 100, forecast_kwh: 100, plant_type: plantType })
      .then((r) => {
        cache.set(plantType, r.band_pct);
        if (alive) setBand(r.band_pct);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [plantType]);

  return band;
}
