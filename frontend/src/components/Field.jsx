import { TriangleAlert } from "lucide-react";
import { useId } from "react";

// Labelled input with a leading icon. `children` render inside the box (e.g. a
// show-password toggle or a unit suffix). An `error` replaces the hint and
// marks the field for assistive technology.
export default function Field({ icon: Icon, label, hint, error, onChange, children, ...input }) {
  const id = useId();
  const noteId = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className={`field ${error ? "has-error" : ""}`}>
      <label htmlFor={id}>{label}</label>
      <div className="field-box">
        {Icon && <Icon size={16} aria-hidden="true" />}
        <input id={id} {...input} aria-invalid={error ? "true" : undefined} aria-describedby={noteId}
          onChange={(e) => onChange(e.target.value)} />
        {children}
      </div>
      {error
        ? <small className="field-error" id={noteId} role="alert"><TriangleAlert size={13} aria-hidden="true" />{error}</small>
        : hint ? <small className="field-hint" id={noteId}>{hint}</small> : null}
    </div>
  );
}
