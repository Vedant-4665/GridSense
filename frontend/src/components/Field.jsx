import { useId } from "react";

// Labelled input with a leading icon. `children` render inside the box (e.g. a show-password toggle).
export default function Field({ icon: Icon, label, hint, onChange, children, ...input }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="field-box">
        {Icon && <Icon size={16} aria-hidden="true" />}
        <input id={id} {...input} onChange={(e) => onChange(e.target.value)} />
        {children}
      </div>
      {hint && <small className="field-hint">{hint}</small>}
    </div>
  );
}
