import { motion } from "framer-motion";
import {
  ArrowRight, Building2, Cpu, Gauge, LineChart, LoaderCircle, RadioTower, Sun, TrendingUp, Zap,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import Brand from "../components/Brand.jsx";
import SunArc from "../components/SunArc.jsx";
import { EASE, rise } from "../lib/motion.js";

// What changed in the regulation, and why this exists. Dates and figures are
// from the CERC DSM (Third Amendment) Regulations 2026.
const RULE_CHANGES = [
  { before: "±10%", after: "±5%", label: "Solar tolerance band", note: "Wind moved from ±15% to ±10%." },
  { before: "available capacity", after: "your own schedule", label: "Measured against", note: "Your forecast is now load-bearing on revenue." },
  { before: "paid", after: "unpaid", label: "Surplus at 50.05 Hz", note: "Over-generating at the wrong moment earns nothing." },
];

const STEPS = [
  { icon: Sun, title: "Read the weather", body: "Live forecast weather at your plant's coordinates, every 15 minutes for the next 72 hours." },
  { icon: LineChart, title: "Predict the output", body: "Gradient-boosted trees over irradiance, temperature and cloud — explainable, and scored against a naive baseline." },
  { icon: Gauge, title: "Compare with your promise", body: "Every block is checked against the schedule you filed and the tolerance band that applies to it." },
  { icon: Zap, title: "Price it, and rank it", body: "Each breach becomes rupees using the published slab structure, ordered by what it costs you." },
];

const FEATURES = [
  { title: "72-hour forecast, 15-minute blocks", body: "The settlement period, not an hourly average that hides intra-hour breaches." },
  { title: "Costed, not just flagged", body: "Every flagged block carries a rupee figure and the action that avoids it: curtail, dispatch storage, revise the schedule." },
  { title: "Equipment that quietly under-performs", body: "A sustained clear-sky shortfall with no weather explanation means dirty or ageing panels. No extra sensors." },
  { title: "Your numbers, not ours", body: "Tariff and tolerance band are yours to set. Change them and every figure recalculates in front of you." },
  { title: "Accuracy you can check", body: "The forecast is scored against the simplest possible forecast, and the app shows the gap." },
  { title: "Rooftops too", body: "The same engine, told as savings and the best hours to run appliances." },
];

const AUDIENCES = [
  { icon: Building2, label: "Utilities", body: "Portfolios inside the tightened regime" },
  { icon: Sun, label: "Plant owners", body: "One site, and the charges it attracts" },
  { icon: RadioTower, label: "Grid operators", body: "What the network is about to do" },
  { icon: TrendingUp, label: "Energy traders", body: "Forecasts to position against" },
];

export default function Home() {
  const { demo } = useAuth();
  const navigate = useNavigate();
  const [entering, setEntering] = useState(false);
  const [error, setError] = useState(null);

  async function openDemo() {
    setEntering(true);
    setError(null);
    try {
      await demo("utility");
      navigate("/overview");
    } catch (err) {
      setError(err.message);
      setEntering(false);
    }
  }

  return (
    <div className="home">
      <header className="home-nav">
        <Link to="/" aria-label="GridSense home"><Brand /></Link>
        <nav aria-label="Sections">
          <a href="#problem">Why now</a>
          <a href="#how">How it works</a>
          <a href="#who">Who it's for</a>
        </nav>
        <div className="home-nav-actions">
          <Link className="btn btn-ghost" to="/login">Sign in</Link>
          <button type="button" className="btn btn-primary" onClick={openDemo} disabled={entering}>
            {entering ? <LoaderCircle size={16} className="spin" /> : null}
            {entering ? "Opening…" : "Open the demo"}
          </button>
        </div>
      </header>

      <section className="home-hero">
        <div className="home-hero-copy">
          <motion.p className="eyebrow" {...rise(0.05)}>HackOut&rsquo;26 · Renewable energy intelligence</motion.p>
          <motion.h1 {...rise(0.1)}>Forecasting revenue,<br /><em>not just megawatts.</em></motion.h1>
          <motion.p className="home-lede" {...rise(0.18)}>
            Every forecasting tool tells an operator how many megawatts are coming. GridSense tells them how many
            rupees they are about to lose, and which single action prevents it.
          </motion.p>
          <motion.div className="home-cta" {...rise(0.26)}>
            <button type="button" className="btn btn-primary btn-lg" onClick={openDemo} disabled={entering}>
              {entering ? <LoaderCircle size={16} className="spin" /> : null}
              Open the demo <ArrowRight size={16} />
            </button>
            <Link className="btn btn-lg" to="/register">Create an account</Link>
          </motion.div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <motion.p className="home-fine" {...rise(0.32)}>
            The demo opens a real plant with live weather. Nothing to install.
          </motion.p>
        </div>
        <motion.div className="home-visual"
          initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.2 }}>
          <SunArc />
        </motion.div>
      </section>

      <section className="home-section" id="problem">
        <div className="home-head">
          <h2>The rules changed on 31 August 2026</h2>
          <p>
            India&rsquo;s deviation settlement mechanism stopped treating renewables gently. Forecast error that was
            free last month is now billable, and it is measured against the schedule you filed yourself.
          </p>
        </div>
        <div className="home-rules">
          {RULE_CHANGES.map((rule) => (
            <article key={rule.label}>
              <p className="home-rule-label">{rule.label}</p>
              <p className="home-rule-change">
                <span className="was">{rule.before}</span>
                <ArrowRight size={16} aria-hidden="true" />
                <strong>{rule.after}</strong>
              </p>
              <p className="home-rule-note">{rule.note}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="home-section home-money">
        <div className="home-head">
          <h2>₹225 is the trap</h2>
          <p>
            A 50 MW plant, tomorrow, 14:00–14:15. You promised 10 MWh; the weather says you will make 8.6. That is
            14% off against a 5% band, so 900 units are chargeable at ₹0.25.
          </p>
        </div>
        <div className="home-maths">
          <div className="home-maths-row"><span>Promised to the grid</span><strong className="num">10,000 units</strong></div>
          <div className="home-maths-row"><span>Forecast output</span><strong className="num">8,600 units</strong></div>
          <div className="home-maths-row"><span>Allowed free (±5%)</span><strong className="num">500 units</strong></div>
          <div className="home-maths-row"><span>Chargeable</span><strong className="num">900 units × ₹0.25</strong></div>
          <div className="home-maths-total"><span>This block alone</span><strong className="num">₹225</strong></div>
        </div>
        <p className="home-money-note">
          ₹225 sounds harmless, which is exactly the trap. Under the Karnataka cap of 3 paise per unit of annual
          generation, a 50 MW plant faces roughly <strong>₹25 lakh a year</strong> — lost in increments nobody sees
          individually. GridSense makes each one visible before it is incurred.
          <span> Figures are decision-support estimates from the published slab structure, not settlement statements.</span>
        </p>
      </section>

      <section className="home-section" id="how">
        <div className="home-head"><h2>How it works</h2></div>
        <ol className="home-steps">
          {STEPS.map(({ icon: Icon, title, body }, index) => (
            <li key={title}>
              <span className="home-step-icon"><Icon size={18} aria-hidden="true" /></span>
              <span className="home-step-index num">0{index + 1}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="home-section">
        <div className="home-head"><h2>What you get</h2></div>
        <div className="home-features">
          {FEATURES.map(({ title, body }) => (
            <article key={title}>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="home-section" id="who">
        <div className="home-head"><h2>Who it&rsquo;s for</h2></div>
        <div className="home-audience">
          {AUDIENCES.map(({ icon: Icon, label, body }) => (
            <article key={label}>
              <Icon size={18} aria-hidden="true" />
              <strong>{label}</strong>
              <span>{body}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="home-final">
        <h2>See it on a real plant</h2>
        <p>Live weather, a trained model, and every quarter-hour priced. Two clicks, no setup.</p>
        <button type="button" className="btn btn-primary btn-lg" onClick={openDemo} disabled={entering}>
          {entering ? <LoaderCircle size={16} className="spin" /> : null}
          Open the demo <ArrowRight size={16} />
        </button>
      </section>

      <footer className="home-foot">
        <div>
          <Brand />
          <p>Built for HackOut&rsquo;26 · Renewable Energy Intelligence</p>
        </div>
        <div className="home-foot-notes">
          <p><Cpu size={14} aria-hidden="true" /> Flask · SQLAlchemy · XGBoost · React · Open-Meteo</p>
          <p>
            GridSense improves the visibility and costing of forecast error. It does not solve India&rsquo;s
            hyperlocal weather-data gap, and grid actions are recommended, not executed.
          </p>
        </div>
      </footer>
    </div>
  );
}
