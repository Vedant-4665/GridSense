# API contract

Agreed at hour 0. Member B builds the frontend against these shapes using mock
JSON; Member A makes the backend match them. Neither waits on the other.

If a shape needs to change, change it **here first**, then tell the other person.

Base URL in development: `http://localhost:5000`

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
Returns the updated alert.

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

Errors: `400` no `plant_id`, `404` unknown plant, `503` model not trained,
`502` weather API unreachable.

---

## Error shape
Every failure returns a JSON body with an `error` key and an appropriate status.
```json
{ "error": "Plant not found" }
```
