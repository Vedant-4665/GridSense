import { Check, Circle, TriangleAlert } from "lucide-react";

/** What is filled in, what is left, and whether the forecast can run yet. */
export default function ReadyList({ items, warnings = [] }) {
  const outstanding = items.filter((item) => !item.done && !item.optional);

  return (
    <div className="ready">
      <ul className="ready-list">
        {items.map((item) => (
          <li key={item.id} className={item.done ? "is-done" : item.optional ? "is-optional" : "is-todo"}>
            {item.done ? <Check size={15} aria-hidden="true" /> : <Circle size={15} aria-hidden="true" />}
            <span>{item.label}</span>
            {!item.done && item.optional && <small>optional</small>}
          </li>
        ))}
      </ul>

      <p className={`ready-verdict ${outstanding.length ? "is-todo" : "is-done"}`} role="status">
        {outstanding.length
          ? `${outstanding.length} thing${outstanding.length > 1 ? "s" : ""} still needed: ${outstanding.map((i) => i.label.toLowerCase()).join(", ")}.`
          : "Everything needed is here. The forecast can run."}
      </p>

      {warnings.map((warning) => (
        <p key={warning.id} className="ready-warning">
          <TriangleAlert size={15} aria-hidden="true" />{warning.text}
        </p>
      ))}
    </div>
  );
}
