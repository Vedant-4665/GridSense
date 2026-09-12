import { motion } from "framer-motion";
import { Check, LoaderCircle, RotateCcw } from "lucide-react";
import { useState } from "react";
import { api } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";
import PageHeader from "../components/PageHeader.jsx";
import Panel from "../components/Panel.jsx";
import { usePlants } from "../components/PlantContext.jsx";
import { ErrorState, PageSkeleton } from "../components/States.jsx";
import Term from "../components/Term.jsx";
import { useToast } from "../components/Toast.jsx";
import { useApi } from "../components/useApi.js";
import { power } from "../lib/format.js";
import { rise } from "../lib/motion.js";
import { useViewMode } from "../lib/viewMode.jsx";

const FEATURE_NAMES = {
  irradiation: "Sunlight hitting the panels",
  ambient_temp: "Air temperature",
  module_temp: "Panel temperature",
  cloud_cover: "Cloud cover",
  wind_speed: "Wind speed",
  hour_sin: "Time of day",
  hour_cos: "Time of day",
  doy_sin: "Time of year",
  doy_cos: "Time of year",
};

export default function Insights() {
  const { plant, version, refresh } = usePlants();
  const { say } = useViewMode();
  const { data, error } = useApi(() => Promise.all([api.modelCard(), api.settings()]), [version]);

  if (error) return <ErrorState error={error} />;
  if (!data) return <PageSkeleton />;
  const [card, settings] = data;

  // The headline error is a share of capacity, so plants of any size compare.
  const missOnThisPlant = (card.mae_pct_of_capacity / 100) * plant.capacity_kw;
  const baselineOnThisPlant = (card.baseline_mae_pct_of_capacity / 100) * plant.capacity_kw;

  return (
    <div className="page">
      <PageHeader eyebrow={say("Accuracy", "Model insights")}
        title={say("Can you trust these numbers?", "Forecast accuracy and assumptions")}
        meta={say(
          "Every rupee on the other screens comes from one forecast and one set of rules. Here is how well the forecast does, and exactly which rules were applied.",
          "Held-out scores against a naive persistence baseline, feature importances, and the regulatory parameters used by the costing layer.",
        )} />

      <div className="split">
        <Panel title={say("How far off are we, typically?", "Held-out accuracy")} delay={0.05}>
          <div className="accuracy">
            <div className="accuracy-row">
              <span>GridSense</span>
              <div className="accuracy-bar">
                <motion.i className="is-us" initial={{ width: 0 }}
                  animate={{ width: `${(card.mae_pct_of_capacity / card.baseline_mae_pct_of_capacity) * 100}%` }}
                  transition={{ duration: 0.8, delay: 0.2 }} />
              </div>
              <strong className="num">{power(missOnThisPlant, plant.capacity_kw)}</strong>
            </div>
            <div className="accuracy-row">
              <span><Term id="baseline">Guessing</Term></span>
              <div className="accuracy-bar"><motion.i className="is-baseline" initial={{ width: 0 }}
                animate={{ width: "100%" }} transition={{ duration: 0.8, delay: 0.3 }} /></div>
              <strong className="num">{power(baselineOnThisPlant, plant.capacity_kw)}</strong>
            </div>
          </div>
          <p className="accuracy-line">
            On a typical <Term id="block">15-minute block</Term> at {plant.name}, our forecast misses by about{" "}
            <strong>{power(missOnThisPlant, plant.capacity_kw)}</strong>. Assuming today repeats tomorrow — the
            simplest forecast anyone could make — misses by <strong>{power(baselineOnThisPlant, plant.capacity_kw)}</strong>.
            That makes us <strong>{card.improvement_pct}% closer</strong>.
          </p>
          <dl className="facts">
            <div><dt>{say("Measured on", "Held-out blocks")}</dt><dd className="num">{card.test_blocks}</dd></div>
            <div><dt>{say("Learned from", "Training blocks")}</dt><dd className="num">{card.training_blocks}</dd></div>
            <div><dt>{say("Method", "Algorithm")}</dt><dd>{card.algorithm}</dd></div>
            <div><dt>Last trained</dt><dd>{new Date(card.trained_at).toLocaleString("en-IN")}</dd></div>
          </dl>
        </Panel>

        <Panel title={say("What the forecast pays attention to", "Feature importance")} delay={0.1}
          meta={say(
            "The model is deliberately inspectable: you can see what drives a prediction, which matters when you have to justify a revised schedule.",
            "Gain-based importances from the trained booster.",
          )}>
          <ul className="features">
            {card.features.filter((f) => f.importance > 0.0005).map((f, i) => (
              <motion.li key={f.feature} {...rise(0.05 * i)}>
                <span>{say(FEATURE_NAMES[f.feature] ?? f.feature, f.feature)}</span>
                <div className="feature-bar">
                  <motion.i initial={{ width: 0 }} animate={{ width: `${f.importance * 100}%` }}
                    transition={{ duration: 0.7, delay: 0.1 + i * 0.05 }} />
                </div>
                <strong className="num">{Math.round(f.importance * 100)}%</strong>
              </motion.li>
            ))}
          </ul>
        </Panel>
      </div>

      <Assumptions plant={plant} settings={settings} onSaved={refresh} />
    </div>
  );
}

// Section 4 of the ideation promises a judge can re-run the numbers with their
// own tariff and band. This is where they do it.
function Assumptions({ plant, settings, onSaved }) {
  const { isOwner } = useAuth();
  const { say } = useViewMode();
  const toast = useToast();
  const [tariff, setTariff] = useState(String(plant.tariff_rate ?? ""));
  const [band, setBand] = useState(String(plant.band_pct ?? ""));
  const [saving, setSaving] = useState(false);

  const dirty = Number(tariff) !== plant.tariff_rate || Number(band) !== plant.band_pct;

  async function save(changes) {
    setSaving(true);
    try {
      const updated = await api.updatePlant(plant.id, changes);
      toast({
        title: "Assumptions updated",
        body: `Everything is re-priced at ₹${updated.tariff_rate}/unit and a ±${updated.band_pct}% band.`,
      });
      setTariff(String(updated.tariff_rate));
      setBand(String(updated.band_pct));
      await onSaved();
    } catch (e) {
      toast({ tone: "danger", title: "Couldn't save", body: e.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel title={say("The rules we applied", "Regulatory assumptions")} delay={0.15}
      meta={say(
        "These are not our numbers to choose. Change them to your own and every figure in the app is recalculated instantly.",
        `${settings.regulation}. Slabs and band are configurable per state commission.`,
      )}>
      <div className="assumptions">
        <div className="assumption">
          <label htmlFor="tariff">{say("What your electricity sells for", "Tariff")}</label>
          <div className="assumption-input">
            <span>₹</span>
            <input id="tariff" type="number" step="0.1" min="0.1" value={tariff} disabled={!isOwner}
              onChange={(e) => setTariff(e.target.value)} />
            <span>/ unit</span>
          </div>
          <small>{say("Used to price the electricity a faulty inverter loses.", "Rs/kWh, used by the deviation diagnostic.")}</small>
        </div>

        <div className="assumption">
          <label htmlFor="band">{say("How far you may miss", "Tolerance band")}</label>
          <div className="assumption-input">
            <span>±</span>
            <input id="band" type="number" step="0.5" min="0" max="100" value={band} disabled={!isOwner}
              onChange={(e) => setBand(e.target.value)} />
            <span>%</span>
          </div>
          <small>
            {plant.band_is_custom
              ? say("Your own figure, not the regulator's.", "Overrides the CERC default.")
              : say(`The regulator's figure for ${plant.plant_type}.`, `CERC default for ${plant.plant_type}.`)}
          </small>
        </div>

        {isOwner && (
          <div className="assumption-actions">
            <button type="button" className="btn btn-primary" disabled={saving || !dirty}
              onClick={() => save({ tariff_rate: Number(tariff), band_pct: Number(band) })}>
              {saving ? <LoaderCircle size={16} className="spin" /> : <Check size={16} />} Apply and re-price
            </button>
            {plant.band_is_custom && (
              <button type="button" className="btn btn-ghost" disabled={saving}
                onClick={() => save({ band_pct: null })}>
                <RotateCcw size={14} /> Back to the regulator's {settings.tolerance_band_pct[plant.plant_type]}%
              </button>
            )}
          </div>
        )}
      </div>

      <table className="slabs">
        <caption>{say("What being outside the band costs, per unit", "Deviation slab structure")}</caption>
        <thead>
          <tr><th>{say("How far outside", "Absolute error")}</th><th><Term id="slab">Rate</Term></th></tr>
        </thead>
        <tbody>
          {settings.deviation_slabs.map((slab, i) => (
            <tr key={slab.up_to_pct}>
              <td>{i === 0 ? `Inside ±${slab.up_to_pct}%` : `up to ${slab.up_to_pct}%`}</td>
              <td className="num">{slab.rate_per_kwh === 0 ? "free" : `₹${slab.rate_per_kwh.toFixed(2)}`}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="note">
        Surplus you did not promise earns nothing once grid frequency reaches{" "}
        {settings.over_injection_freq_hz} Hz — that is <Term id="overInjection">over-injection</Term>.
        Figures are decision-support estimates from the published slab structure, not settlement statements.
      </p>
    </Panel>
  );
}
