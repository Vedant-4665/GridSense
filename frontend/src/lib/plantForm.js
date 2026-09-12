/**
 * Everything the add-plant screen knows about what a valid plant is.
 *
 * The limits here mirror backend/routes/plants.py exactly — the server is the
 * authority and re-checks all of it. What is *only* here is advice: warnings
 * that never block, marked below where the threshold is our judgement rather
 * than a rule from the regulation or the database.
 */

export const LIMITS = {
  nameChars: 120,          // Plant.name column
  locationChars: 120,      // Plant.location column
  latitude: [-90, 90],
  longitude: [-180, 180],
  capacityKw: [0, 10_000_000],   // exclusive at both ends, as the API enforces
  coordDecimals: 6,
};

// Judgement calls, not business rules. Warnings only.
export const ROOFTOP_TYPICAL_MAX_KW = 150;
export const UTILITY_TYPICAL_MIN_KW = 100;
export const SITE_DRIFT_KM = 50;

export const PRESETS = [
  { name: "Ahmedabad", location: "Gujarat, India", lat: 23.0225, lon: 72.5714 },
  { name: "Bhadla", location: "Rajasthan, India", lat: 27.536, lon: 71.915 },
  { name: "Bhuj", location: "Kutch, Gujarat", lat: 23.242, lon: 69.667 },
  { name: "Pavagada", location: "Karnataka, India", lat: 14.1, lon: 77.28 },
  { name: "Kamuthi", location: "Tamil Nadu, India", lat: 9.347, lon: 78.389 },
];

export const EMPTY_FORM = {
  name: "", location: "", latitude: "", longitude: "",
  capacity_kw: "", plant_type: "solar", owner_type: "utility", preset: null,
};

/** A real number, or null for blanks, text, NaN and Infinity. */
export function parseNumber(raw) {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const text = String(raw ?? "").trim();
  if (!text) return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

const hasContent = (text) => /[\p{L}\p{N}]/u.test(text);

export function fieldErrors(form) {
  const errors = {};
  const name = form.name.trim();
  if (!name) errors.name = "Give the plant a name.";
  else if (name.length > LIMITS.nameChars) errors.name = `Keep it to ${LIMITS.nameChars} characters or fewer.`;
  else if (!hasContent(name)) errors.name = "Use at least one letter or number.";

  if (form.location.trim().length > LIMITS.locationChars) {
    errors.location = `Keep it to ${LIMITS.locationChars} characters or fewer.`;
  }

  for (const [key, label] of [["latitude", "Latitude"], ["longitude", "Longitude"]]) {
    const value = parseNumber(form[key]);
    const [min, max] = LIMITS[key];
    if (form[key].trim() === "") errors[key] = `${label} is needed to fetch weather for the site.`;
    else if (value === null) errors[key] = `${label} must be a number.`;
    else if (value < min || value > max) errors[key] = `${label} must be between ${min} and ${max}.`;
  }

  const capacity = parseNumber(form.capacity_kw);
  const [minKw, maxKw] = LIMITS.capacityKw;
  if (form.capacity_kw.trim() === "") errors.capacity_kw = "Capacity is needed to size the forecast.";
  else if (capacity === null) errors.capacity_kw = "Capacity must be a number.";
  else if (capacity <= minKw) errors.capacity_kw = "Capacity must be more than 0 kW.";
  else if (capacity >= maxKw) errors.capacity_kw = `Capacity must be under ${maxKw.toLocaleString("en-IN")} kW.`;

  return errors;
}

/**
 * Things worth saying out loud that are not mistakes. Each one names why it
 * appears, so the operator can decide rather than obey.
 */
export function warnings(form, { existingPlants = [] } = {}) {
  const out = [];
  const capacity = parseNumber(form.capacity_kw);
  const latitude = parseNumber(form.latitude);
  const longitude = parseNumber(form.longitude);
  const name = form.name.trim().toLowerCase();

  if (name && existingPlants.some((p) => p.name.trim().toLowerCase() === name)) {
    out.push({ id: "duplicate-name", text: "You already have a plant with this name. Both will appear in the plant list." });
  }
  if (capacity !== null && form.owner_type === "distributed" && capacity > ROOFTOP_TYPICAL_MAX_KW) {
    out.push({
      id: "rooftop-capacity",
      text: `${capacity.toLocaleString("en-IN")} kW is large for a rooftop. Check the connection type, or switch to utility-scale.`,
    });
  }
  if (capacity !== null && form.owner_type === "utility" && capacity > 0 && capacity < UTILITY_TYPICAL_MIN_KW) {
    out.push({ id: "utility-capacity", text: `${capacity} kW is small for a grid-connected plant. Rooftop may be the better fit.` });
  }
  if (form.preset && latitude !== null && longitude !== null) {
    const preset = PRESETS.find((p) => p.name === form.preset);
    const drift = preset && distanceKm({ lat: latitude, lon: longitude }, { lat: preset.lat, lon: preset.lon });
    if (drift && drift > SITE_DRIFT_KM) {
      out.push({
        id: "site-drift",
        text: `These coordinates are about ${Math.round(drift)} km from ${preset.name}. Keep them if the site really is there.`,
      });
    }
  }
  if (form.plant_type === "wind") {
    out.push({ id: "wind", text: "Wind plants can be registered, but forecasting is solar-only so far. No forecast will run." });
  }
  return out;
}

/** Distance over the ground between two coordinates, in kilometres. */
export function distanceKm(a, b) {
  const R = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** What still needs doing, in the order the form asks for it. */
export function checklist(form) {
  const errors = fieldErrors(form);
  return [
    { id: "name", label: "Plant name", done: !errors.name },
    { id: "location", label: "Location", done: Boolean(form.location.trim()), optional: true },
    { id: "coordinates", label: "Coordinates", done: !errors.latitude && !errors.longitude },
    { id: "capacity", label: "Capacity", done: !errors.capacity_kw },
    { id: "technology", label: "Technology", done: true },
    { id: "connection", label: "Connection", done: true },
  ];
}

/** Exactly what POST /api/plants expects. Units are kW in and kW out. */
export function toPayload(form) {
  const round = (value) => Number(value.toFixed(LIMITS.coordDecimals));
  return {
    name: form.name.trim(),
    location: form.location.trim() || null,
    latitude: round(parseNumber(form.latitude)),
    longitude: round(parseNumber(form.longitude)),
    capacity_kw: parseNumber(form.capacity_kw),
    plant_type: form.plant_type,
    owner_type: form.owner_type,
  };
}
