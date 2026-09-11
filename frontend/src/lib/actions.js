import { ArrowDownToLine, BatteryCharging, CalendarClock, Power } from "lucide-react";

// Display names for Recommendation.action_type.
export const ACTIONS = {
  dispatch_storage: { label: "Dispatch storage", icon: BatteryCharging },
  curtail: { label: "Curtail output", icon: ArrowDownToLine },
  activate_backup: { label: "Activate backup", icon: Power },
  revise_schedule: { label: "Revise schedule", icon: CalendarClock },
};

export const actionFor = (type) => ACTIONS[type] ?? ACTIONS.revise_schedule;
