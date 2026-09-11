import { Building2, RadioTower, Sun, TrendingUp } from "lucide-react";

// Mirrors ROLES in backend/models.py. Owners act on their own plants; the
// other two watch every plant, read-only.
export const ROLES = {
  plant_owner: { label: "Plant owner", blurb: "Solar or wind assets you own", icon: Sun },
  utility: { label: "Utility company", blurb: "A portfolio of generating plants", icon: Building2 },
  grid_operator: { label: "Grid operator", blurb: "Every plant on the network, read-only", icon: RadioTower },
  trader: { label: "Energy trader", blurb: "Forecasts to trade against, read-only", icon: TrendingUp },
};

export const OWNER_ROLES = new Set(["plant_owner", "utility"]);
