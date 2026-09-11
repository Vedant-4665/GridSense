# API contract

Agreed at hour 0. Member B builds the frontend against these shapes using mock
JSON; Member A makes the backend match them. Neither waits on the other.

If a shape needs to change, change it **here first**, then tell the other person.

Base URL in development: `http://localhost:5000`

---

## Authentication

Every endpoint in this document needs a logged-in session, except
`GET /api/health` and the auth endpoints marked **public**. Without one:
`401 { "error": "Login required" }`.

The session is an HttpOnly cookie set by register, login or demo. The frontend
reaches the API through the Vite proxy (same origin), so `fetch` sends it
without any extra options.

**What each role sees.** `plant_owner` and `utility` see only the plants they
own, and are the only roles that can add plants, run forecasts and update
alerts (`403` otherwise). `grid_operator` and `trader` see every plant,
read-only. Plants, forecasts, recommendations, alerts and the dashboard summary
are all filtered this way. A plant the user can't see answers `404`, the same
as one that doesn't exist.

User shape, returned by every auth endpoint except logout:
```json
{ "id": 5, "email": "asha@example.com", "name": "Asha Mehta",
  "organisation": "Sabar Solar", "role": "utility" }
```

### POST /api/auth/register — public
```json
{ "email": "asha@example.com", "password": "at-least-8-chars", "name": "Asha Mehta",
  "organisation": "Sabar Solar", "role": "utility" }
```
`organisation` is optional. `role` is one of `plant_owner`, `utility`,
`grid_operator`, `trader`. Returns `201` with the user, already logged in.
`400` on a validation failure, `409` if the email is taken.

### POST /api/auth/login — public
`{ "email": "...", "password": "..." }` → the user.
`401 { "error": "Incorrect email or password" }` for either mistake.

### POST /api/auth/logout — public
→ `{ "status": "logged_out" }`. Ends the session on every device.

### GET /api/auth/me
→ the user, or `401`. The frontend calls this on load to choose between the
login screen and the app.

### POST /api/auth/demo — public, development only
`{ "role": "utility" }` → logs in as that role's seeded demo account, for the
login page's demo buttons. `404` when the server runs with `DEMO_LOGIN=0`.

---

## GET /api/health
```json
{ "status": "ok", "service": "gridsense" }
```

## GET /api/dashboard/summary
Single call for every KPI on the overview page.
```json
{
  "plants": 2,
  "flagged_windows": 18,
  "total_exposure_inr": 306.17,
  "open_alerts": 1,
  "revenue_at_risk_inr": 14460.0
}
```

## GET /api/plants
```json
[{ "id": 1, "name": "Ahmedabad Solar Park", "location": "Gujarat, India",
   "latitude": 23.0225, "longitude": 72.5714, "capacity_kw": 50000,
   "plant_type": "solar", "owner_type": "utility", "tariff_rate": 8.0 }]
```

## POST /api/plants
Adds a plant owned by the current user. Owner roles only (`403` otherwise).
```json
{ "name": "Kutch Solar 2", "location": "Gujarat, India", "latitude": 23.73,
  "longitude": 69.86, "capacity_kw": 25000, "plant_type": "solar" }
```
`location`, `plant_type` (`solar`), `owner_type` (`utility`) and `tariff_rate`
are optional, defaults in brackets. Returns `201` with the plant, shaped as in
`GET /api/plants`. A new plant has no history or schedule: its forecast runs,
but its blocks come back unscheduled and uncosted.

## GET /api/plants/:id
As above, plus `"assets": [...]`.

## GET /api/plants/:id/generation?limit=500
Ascending by time.
```json
[{ "timestamp": "2026-09-11T10:15:00", "ac_power": 38200.4, "dc_power": 38964.4 }]
```

## GET /api/plants/:id/forecast?horizon=24|48|72
```json
{
  "plant_id": 1,
  "horizon_hours": 24,
  "blocks": [{
    "target_timestamp": "2026-09-12T14:00:00",
    "predicted_kw": 34400.0,
    "scheduled_kw": 40000.0,
    "confidence_low": 31648.0,
    "confidence_high": 37152.0,
    "horizon_hours": 14
  }]
}
```

## GET /api/plants/:id/recommendations
Ordered by `exposure_inr` descending — financial impact, not severity label.
```json
[{
  "id": 1, "plant_id": 1,
  "window_start": "2026-09-12T14:00:00", "window_end": "2026-09-12T14:15:00",
  "window_type": "under", "action_type": "dispatch_storage", "severity": "medium",
  "deviation_pct": 14.0, "expected_delta_kwh": 900.0, "exposure_inr": 225.0,
  "message": "Under-generation of 14.0% projected against a 5.0% band..."
}]
```

## POST /api/costing/preview
Exposes the costing arithmetic directly, so the calculation can be re-run live
with any numbers a judge suggests.

Request:
```json
{ "scheduled_kwh": 10000, "forecast_kwh": 8600, "plant_type": "solar" }
```
Response:
```json
{
  "breached": true, "deviation_pct": 14.0, "band_pct": 5.0, "direction": "under",
  "chargeable_units": 900.0, "rate_per_unit": 0.25, "exposure_inr": 225.0,
  "action_type": "dispatch_storage", "message": "..."
}
```

## GET /api/alerts?status=open
Ordered by `est_revenue_loss` descending.
```json
[{
  "id": 1, "asset_id": 3, "detected_at": "2026-09-11T19:02:02",
  "window_start": "2026-09-07T19:00:00", "window_end": "2026-09-11T19:00:00",
  "deviation_pct": 12.4, "suspected_cause": "soiling", "severity": "medium",
  "est_loss_kwh": 4820.0, "est_revenue_loss": 14460.0, "status": "open"
}]
```

## PATCH /api/alerts/:id
Request: `{ "status": "ack" }` — one of `open`, `ack`, `resolved`.
Returns the updated alert. `403` unless the current user owns the alert's plant.

## POST /api/forecast/run
Regenerates one plant's next 72 hours of forecast blocks from live Open-Meteo
weather using the saved model (`python seed.py --train`; this call does not
retrain), replaces its future forecasts and recommendations, and re-costs every
block.

Request:
```json
{ "plant_id": 1 }
```
Response:
```json
{
  "plant_id": 1, "window_start": "2026-09-12T01:00:00",
  "blocks_written": 288, "breached_blocks": 61, "unscheduled_blocks": 4,
  "total_exposure_inr": 1843.27
}
```
`scheduled_kw` carries over from the blocks being replaced. Blocks with no
schedule on file are forecast but not costed, and counted in `unscheduled_blocks`.

Errors: `400` no `plant_id`, `404` unknown plant, `403` not the plant's owner,
`422` wind plant (the model is solar-only), `503` model not trained, `502`
weather API unreachable.

---

## Error shape
Every failure returns a JSON body with an `error` key and an appropriate status.
```json
{ "error": "Plant not found" }
```
