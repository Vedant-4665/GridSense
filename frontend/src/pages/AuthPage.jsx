import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight, Building, Eye, EyeOff, LoaderCircle, Lock, Mail, ShieldCheck, Sparkles, TriangleAlert, User,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import { ROLES } from "../auth/roles.js";
import Brand from "../components/Brand.jsx";
import Field from "../components/Field.jsx";
import SunArc from "../components/SunArc.jsx";
import { EASE, rise } from "../lib/motion.js";

export default function AuthPage({ mode }) {
  return (
    <div className="auth">
      <div className="backdrop" aria-hidden="true" />

      <section className="auth-hero">
        <Brand />
        <div className="auth-hero-copy">
          <motion.p className="eyebrow" {...rise(0.05)}>HackOut'26 · Renewable energy intelligence</motion.p>
          <motion.h1 {...rise(0.12)}>Forecasting revenue,<br /><em>not just megawatts.</em></motion.h1>
          <motion.p className="auth-lede" {...rise(0.2)}>
            72-hour solar forecasts, priced block by block against CERC deviation bands,
            with the action to take first.
          </motion.p>
        </div>
        <motion.div className="auth-visual" {...rise(0.3)}><SunArc /></motion.div>
        <motion.dl className="auth-stats" {...rise(0.4)}>
          <div><dt>Settlement</dt><dd>15-minute blocks</dd></div>
          <div><dt>Horizon</dt><dd>72 hours ahead</dd></div>
          <div><dt>Regulation</dt><dd>CERC DSM 2026</dd></div>
        </motion.dl>
      </section>

      <section className="auth-panel">
        <motion.div className="auth-card" initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}>
          <AuthTabs mode={mode} />
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={mode} initial={{ opacity: 0, x: mode === "login" ? -14 : 14 }}
              animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: mode === "login" ? 14 : -14 }}
              transition={{ duration: 0.2 }}>
              {mode === "login" ? <LoginForm /> : <RegisterForm />}
            </motion.div>
          </AnimatePresence>
          <DemoAccess />
          <p className="auth-fine">
            <ShieldCheck size={14} aria-hidden="true" />
            Passwords are hashed with scrypt. Your session lives in an HttpOnly cookie.
          </p>
        </motion.div>
      </section>
    </div>
  );
}

function AuthTabs({ mode }) {
  const tabs = [["login", "/login", "Log in"], ["register", "/register", "Create account"]];
  return (
    <nav className="auth-tabs" aria-label="Account">
      {tabs.map(([m, to, label]) => (
        <Link key={m} to={to} replace className={mode === m ? "is-active" : ""} aria-current={mode === m ? "page" : undefined}>
          {mode === m && <motion.span layoutId="auth-tab" className="auth-tab-pill" />}
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}

function LoginForm() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);   // the route guard takes it from here
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <div>
        <h2 className="form-title">Welcome back</h2>
        <p className="form-sub">Log in to your control room.</p>
      </div>
      <Field icon={Mail} label="Email" type="email" autoComplete="email" required
        value={email} onChange={setEmail} placeholder="you@company.com" />
      <PasswordField value={password} onChange={setPassword} autoComplete="current-password" />
      <FormError message={error} />
      <SubmitButton busy={busy}>Log in</SubmitButton>
    </form>
  );
}

function RegisterForm() {
  const { register } = useAuth();
  const [form, setForm] = useState({ role: "utility", name: "", organisation: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await register(form);   // owners with no plants land on the add-plant prompt
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <div>
        <h2 className="form-title">Create your account</h2>
        <p className="form-sub">Who is this control room for?</p>
      </div>
      <div className="role-grid" role="radiogroup" aria-label="Account type">
        {Object.entries(ROLES).map(([key, role]) => (
          <button key={key} type="button" role="radio" aria-checked={form.role === key}
            className={`role-card ${form.role === key ? "is-active" : ""}`} onClick={() => set("role")(key)}>
            {form.role === key && <motion.span layoutId="role-ring" className="role-ring" />}
            <role.icon size={18} />
            <strong>{role.label}</strong>
            <small>{role.blurb}</small>
          </button>
        ))}
      </div>
      <div className="form-row">
        <Field icon={User} label="Full name" autoComplete="name" required value={form.name} onChange={set("name")} />
        <Field icon={Building} label="Organisation" autoComplete="organization" placeholder="Optional"
          value={form.organisation} onChange={set("organisation")} />
      </div>
      <Field icon={Mail} label="Work email" type="email" autoComplete="email" required
        value={form.email} onChange={set("email")} placeholder="you@company.com" />
      <PasswordField value={form.password} onChange={set("password")} autoComplete="new-password" meter />
      <FormError message={error} />
      <SubmitButton busy={busy}>Create account</SubmitButton>
    </form>
  );
}

function PasswordField({ value, onChange, autoComplete, meter = false }) {
  const [show, setShow] = useState(false);
  const score = strength(value);
  return (
    <div>
      <Field icon={Lock} label="Password" type={show ? "text" : "password"} autoComplete={autoComplete}
        required minLength={meter ? 8 : undefined} value={value} onChange={onChange}>
        <button type="button" className="field-eye" onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}>
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </Field>
      {meter && (
        <div className="meter" data-score={score} aria-live="polite">
          <i /><i /><i /><i />
          <small>{["8+ characters", "Weak", "Fair", "Good", "Strong"][score]}</small>
        </div>
      )}
    </div>
  );
}

// 0 below the minimum length, then one point each for length and character variety.
function strength(password) {
  if (password.length < 8) return 0;
  let score = 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 1;
  return Math.min(score, 4);
}

function FormError({ message }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.p className="form-error" role="alert" initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0, x: [0, -6, 6, -3, 3, 0] }} exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}>
          <TriangleAlert size={15} /> {message}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

function SubmitButton({ busy, children }) {
  return (
    <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={busy}>
      {busy && <LoaderCircle size={16} className="spin" />}
      {children}
      {!busy && <ArrowRight size={16} />}
    </button>
  );
}

function DemoAccess() {
  const { demo } = useAuth();
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  async function enter(role) {
    setBusy(role);
    setError(null);
    try {
      await demo(role);
    } catch (err) {
      setError(err.message);
      setBusy(null);
    }
  }

  return (
    <div className="demo">
      <div className="demo-head"><Sparkles size={14} /><span>Explore with a demo account</span></div>
      <div className="demo-grid">
        {Object.entries(ROLES).map(([key, role]) => (
          <button key={key} type="button" className="demo-btn" onClick={() => enter(key)} disabled={busy != null}>
            {busy === key ? <LoaderCircle size={14} className="spin" /> : <role.icon size={14} />}
            <span>{role.label}</span>
          </button>
        ))}
      </div>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
