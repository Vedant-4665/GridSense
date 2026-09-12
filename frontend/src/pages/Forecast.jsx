import { motion } from "framer-motion";
import { useState } from "react";
import { api } from "../api/client.js";
import ForecastChart, { ChartLegend } from "../components/ForecastChart.jsx";
import PageHeader from "../components/PageHeader.jsx";
import Panel from "../components/Panel.jsx";
import { usePlants } from "../components/PlantContext.jsx";
import Segmented from "../components/Segmented.jsx";
import { ErrorState, PageSkeleton } from "../components/States.jsx";
import { useApi } from "../components/useApi.js";
import Collapsible from "../components/Collapsible.jsx";
import { useViewMode } from "../lib/viewMode.jsx";
import WhatIf from "../components/WhatIf.jsx";
import { BLOCK_HOURS, joinBlocks, maxBy, sum } from "../lib/blocks.js";
import { dayShort, energy, hhmm, pct, power } from "../lib/format.js";
import { rise } from "../lib/motion.js";

const HORIZONS = [["24", "24h"], ["48", "48h"], ["72", "72h"]];

export default function Forecast() {
  const { plant, version } = usePlants();
  const { expert, say } = useViewMode();
  const band = plant.band_pct;
  const [horizon, setHorizon] = useState("48");
  const { data, error } = useApi(() => Promise.all([
    api.forecast(plant.id, Number(horizon)), api.recommendations(plant.id), api.generation(plant.id, 48),
  ]), [plant.id, horizon, version]);

  if (error) return <ErrorState error={error} />;
  if (!data) return <PageSkeleton />;

  const [forecast, recs, generation] = data;
  const blocks = joinBlocks(forecast, recs);
  const withSchedule = blocks.filter((b) => b.scheduled_kw != null);
  const forecastKwh = sum(blocks, (b) => b.predicted_kw * BLOCK_HOURS);
  const scheduledKwh = sum(withSchedule, (b) => b.scheduled_kw * BLOCK_HOURS);
  const gapKwh = sum(withSchedule, (b) => (b.predicted_kw - b.scheduled_kw) * BLOCK_HOURS);
  const peak = maxBy(blocks, (b) => b.predicted_kw);
  const worst = maxBy(blocks.filter((b) => b.rec), (b) => b.rec.exposure_inr);

  const stats = [
    ["Electricity forecast", energy(forecastKwh), `next ${horizon} hours`],
    ["Promised to the grid", withSchedule.length ? energy(scheduledKwh) : "Not filed yet",
      withSchedule.length ? `${withSchedule.length} blocks scheduled` : "no schedule on file"],
    ["Short by", withSchedule.length ? energy(gapKwh) : "—",
      scheduledKwh ? `${pct((gapKwh / scheduledKwh) * 100)} of schedule` : ""],
    ["Busiest moment", peak ? power(peak.predicted_kw, plant.capacity_kw) : "—",
      peak ? `${dayShort(peak.t)} ${hhmm(peak.t)}` : ""],
  ];

  return (
    <div className="page">
      <PageHeader eyebrow="Forecast" title="What you will generate"
        meta="Predicted from the weather forecast at your plant's coordinates, in the same 15-minute blocks the grid settles on."
        aside={<Segmented id="horizon" options={HORIZONS} value={horizon} onChange={setHorizon} />} />

      <Panel title={`Next ${horizon} hours`} meta={`${blocks.length} settlement blocks`}
        actions={<ChartLegend band={band} />} delay={0.05}>
        <ForecastChart blocks={blocks} actuals={generation} band={band} capacityKw={plant.capacity_kw} height={420} />
      </Panel>

      <div className="stat-strip">
        {stats.map(([label, value, sub], i) => (
          <motion.div className="stat" key={label} {...rise(0.1 + i * 0.05)}>
            <span>{label}</span>
            <strong className="num">{value}</strong>
            <small>{sub}</small>
          </motion.div>
        ))}
      </div>

      <Panel title="Try your own numbers" delay={0.2}
        meta="Drag the sliders to see how a deviation is charged. The server does the sums, so this is the same arithmetic used everywhere else.">
        <Collapsible label={say("Try it with your own numbers", "Open the costing sandbox")} open={expert}>
        <WhatIf key={plant.id} initial={{
          bandPct: band,
          plantType: plant.plant_type,
          scheduled: worst ? Math.round(worst.scheduled_kw * BLOCK_HOURS) : undefined,
          forecast: worst ? Math.round(worst.predicted_kw * BLOCK_HOURS) : undefined,
        }} />
        </Collapsible>
      </Panel>
    </div>
  );
}
