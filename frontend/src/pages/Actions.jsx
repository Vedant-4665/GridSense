import { CalendarClock, Check, Moon } from "lucide-react";
import Collapsible from "../components/Collapsible.jsx";
import Term from "../components/Term.jsx";
import { useViewMode } from "../lib/viewMode.jsx";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client.js";
import ActionList from "../components/ActionList.jsx";
import CountUp from "../components/CountUp.jsx";
import { CostWorking, DeviationGauge } from "../components/CostWorking.jsx";
import PageHeader from "../components/PageHeader.jsx";
import Panel from "../components/Panel.jsx";
import { usePlants } from "../components/PlantContext.jsx";
import Runway from "../components/Runway.jsx";
import Segmented from "../components/Segmented.jsx";
import { EmptyState, ErrorState, PageSkeleton } from "../components/States.jsx";
import { useApi } from "../components/useApi.js";
import { actionFor } from "../lib/actions.js";
import { BLOCK_HOURS, BLOCK_MS, joinBlocks, maxBy, sum } from "../lib/blocks.js";
import { dayLong, hhmm, rupeesShort } from "../lib/format.js";

const TOP = 12;

export default function Actions() {
  const { plant, version } = usePlants();
  const { expert, say } = useViewMode();
  const band = plant.band_pct;
  const [params, setParams] = useSearchParams();
  const [direction, setDirection] = useState("all");
  const [showAll, setShowAll] = useState(false);
  const { data, error } = useApi(
    () => Promise.all([api.forecast(plant.id, 72), api.recommendations(plant.id)]),
    [plant.id, version],
  );

  if (error) return <ErrorState error={error} />;
  if (!data) return <PageSkeleton />;

  const blocks = joinBlocks(...data);
  const breached = blocks.filter((b) => b.rec);
  const under = breached.filter((b) => b.rec.window_type === "under").length;
  const worst = maxBy(breached, (b) => b.rec.exposure_inr);
  const selectedTs = params.get("at") ?? worst?.target_timestamp ?? blocks.find((b) => b.scheduled_kw > 0)?.target_timestamp;
  const selected = blocks.find((b) => b.target_timestamp === selectedTs) ?? null;
  const select = (b) => setParams({ at: b.target_timestamp }, { replace: true });
  const shown = breached.filter((b) => direction === "all" || b.rec.window_type === direction);

  return (
    <div className="page">
      <PageHeader eyebrow="Grid actions"
        title={<><CountUp value={sum(breached, (b) => b.rec.exposure_inr)} format={rupeesShort} />{" "}
          <span className="title-dim">at stake over 72 hours</span></>}
        meta={`${breached.length} blocks fall outside your ±${band ?? "…"}% tolerance band: ${under} where you generate too little, ${breached.length - under} too much. Ranked by cost, not by severity label.`} />

      <div className="split split-wide">
        <Panel title="Ranked by what they cost you" delay={0.1}
          actions={<Segmented id="direction" value={direction} onChange={setDirection}
            options={[["all", "All"], ["under", "Under"], ["over", "Over"]]} />}>
          {shown.length ? (
            <>
              <ActionList blocks={shown} limit={showAll ? undefined : TOP} selected={selectedTs} onSelect={select} />
              {shown.length > TOP && (
                <button type="button" className="btn btn-ghost btn-block list-more" onClick={() => setShowAll((s) => !s)}>
                  {showAll ? `Show top ${TOP}` : `Show all ${shown.length}`}
                </button>
              )}
            </>
          ) : (
            <EmptyState icon={Check} title="Nothing to act on">
              No block in this view breaches the tolerance band.
            </EmptyState>
          )}
        </Panel>

        <Panel title={say("Why this one costs what it costs", "Block anatomy")} className="sticky" delay={0.15}
          meta={selected ? `${dayLong(selected.t)} · ${hhmm(selected.t)}–${hhmm(selected.t + BLOCK_MS)}` : ""}>
          {selected
            ? <BlockAnatomy block={selected} plantType={plant.plant_type} bandPct={band} expert={expert} />
            : <p className="muted">Pick a row on the left.</p>}
        </Panel>
      </div>

      <Panel title={say("The whole three days at a glance", "Settlement runway")} delay={0.2}
        meta={say(
          "One square per 15 minutes. Green is fine, warmer colours cost more.",
          "288 settlement blocks, coloured by rupee exposure.",
        )}>
        <Collapsible label={say("Show all 288 blocks", "Show the runway")} open={expert}>
          <Runway blocks={blocks} capacityKw={plant.capacity_kw} selected={selectedTs} onSelect={select} />
        </Collapsible>
      </Panel>
    </div>
  );
}

// One block's costing, re-run on the server so what's shown is what's charged.
function BlockAnatomy({ block, plantType, bandPct, expert }) {
  const scheduled = block.scheduled_kw == null ? null : block.scheduled_kw * BLOCK_HOURS;
  const forecast = block.predicted_kw * BLOCK_HOURS;
  const { data: result, error } = useApi(
    () => (scheduled
      ? api.costingPreview({ scheduled_kwh: scheduled, forecast_kwh: forecast, plant_type: plantType, band_pct: bandPct })
      : Promise.resolve(null)),
    [block.target_timestamp],
  );

  if (scheduled == null) {
    return (
      <EmptyState icon={CalendarClock} title="No schedule on file">
        This block has a forecast but no declared schedule, so there is nothing to cost.
      </EmptyState>
    );
  }
  if (!scheduled) {
    return (
      <EmptyState icon={Moon} title="Nothing scheduled">
        No generation is declared for this block, so it can't breach the band.
      </EmptyState>
    );
  }

  const action = block.rec && actionFor(block.rec.action_type);
  return (
    <div className="anatomy">
      {result && (
        <p className="anatomy-plain">
          You promised <strong>{Math.round(scheduled)} units</strong> in this block and we expect{" "}
          <strong>{Math.round(forecast)}</strong>. You may be out by{" "}
          <Term id="band">±{result.band_pct}%</Term> for free; beyond that every unit is charged.
        </p>
      )}
      {result && <DeviationGauge scheduled={scheduled} forecast={forecast} bandPct={result.band_pct} />}
      {result?.over_injection_risk && (
        <p className="warn-note"><Term id="overInjection">Surplus may earn nothing</Term> if the grid is
          already at 50.05 Hz, so generating extra is not a safe answer here.</p>
      )}
      <Collapsible label="Show the working" open={expert}>
        <CostWorking result={result} />
      </Collapsible>
      {action && (
        <div className="anatomy-action">
          <span className="anatomy-icon"><action.icon size={18} /></span>
          <div>
            <strong>{action.label}</strong>
            <p>{block.rec.message}</p>
          </div>
        </div>
      )}
      {error && <p className="error">{error.message}</p>}
    </div>
  );
}
