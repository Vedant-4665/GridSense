import { motion } from "framer-motion";
import { ArrowRight, Check, LoaderCircle, RotateCcw, TriangleAlert } from "lucide-react";

// One name for each thing that can be true while a plant is being created.
export const STAGE = {
  DRAFT: "draft",
  CREATING: "creating",
  FORECASTING: "forecasting",
  READY: "ready",
  FORECAST_FAILED: "forecast_failed",
  CREATE_FAILED: "create_failed",
};

const DONE_AFTER_CREATE = [STAGE.FORECASTING, STAGE.READY, STAGE.FORECAST_FAILED];

/**
 * What is happening after the button is pressed. Each step reflects a call the
 * app is actually waiting on — there is no timed animation pretending to be
 * progress.
 */
export default function SubmitProgress({ stage, plant, forecast, error, forecastError, onRetryForecast, onOpen }) {
  if (stage === STAGE.DRAFT) return null;

  const created = DONE_AFTER_CREATE.includes(stage);
  const skipped = plant && plant.plant_type !== "solar";

  return (
    <motion.div className="progress" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} role="status" aria-live="polite">
      <Step
        state={stage === STAGE.CREATE_FAILED ? "failed" : created ? "done" : "running"}
        title={created ? `${plant?.name} registered` : "Registering the plant"}
        detail={stage === STAGE.CREATE_FAILED ? error?.message : created ? `Plant #${plant.id}` : "Saving its details"}
      />

      {skipped ? (
        <Step state="skipped" title="Forecast skipped"
          detail="Forecasting is solar-only so far, so this wind plant has no 72-hour forecast yet." />
      ) : (
        <Step
          state={stage === STAGE.FORECASTING ? "running"
            : stage === STAGE.READY ? "done"
              : stage === STAGE.FORECAST_FAILED ? "failed" : "waiting"}
          title={stage === STAGE.READY ? "72-hour forecast ready" : "Reading weather and forecasting 72 hours"}
          detail={stage === STAGE.READY
            ? `${forecast?.blocks_written} quarter-hour blocks written from live weather`
            : stage === STAGE.FORECAST_FAILED ? forecastError?.message
              : stage === STAGE.FORECASTING ? "This takes a couple of seconds" : "Runs as soon as the plant exists"}
        />
      )}

      {stage === STAGE.FORECAST_FAILED && (
        <div className="progress-actions">
          <button type="button" className="btn" onClick={onRetryForecast}>
            <RotateCcw size={15} /> Try the forecast again
          </button>
          <button type="button" className="btn btn-ghost" onClick={onOpen}>
            Open it anyway <ArrowRight size={15} />
          </button>
        </div>
      )}

      {(stage === STAGE.READY || (skipped && created)) && (
        <div className="progress-actions">
          <button type="button" className="btn btn-primary" onClick={onOpen}>
            Open the control room <ArrowRight size={15} />
          </button>
        </div>
      )}
    </motion.div>
  );
}

function Step({ state, title, detail }) {
  const icon = {
    done: <Check size={15} />,
    running: <LoaderCircle size={15} className="spin" />,
    failed: <TriangleAlert size={15} />,
    waiting: <span className="step-dot" />,
    skipped: <span className="step-dot" />,
  }[state];

  return (
    <div className={`step is-${state}`}>
      <span className="step-icon">{icon}</span>
      <span className="step-text">
        <strong>{title}</strong>
        {detail && <small>{detail}</small>}
      </span>
    </div>
  );
}
