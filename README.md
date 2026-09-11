# GridSense

**Forecasting revenue, not just megawatts.**

HackOut'26 — Renewable Energy Intelligence.
Problem statement: AI-Powered Renewable Generation Forecasting Platform.

A forecasting platform for solar and wind generators that converts a 24–72 hour
output forecast into a costed operating decision: which settlement blocks will
breach the deviation tolerance band, what that exposure is in rupees, and which
action to take first.

---

## Run it

Two terminals. Backend first.

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
python seed.py --train          # builds the database from scratch, trains the model
python app.py                   # serves on http://localhost:5000
```

Check it: `curl localhost:5000/api/health`

### Frontend

```bash
cd frontend
npm install
npm run dev                     # serves on http://localhost:5173
```

Vite proxies `/api/*` to port 5000, so no CORS configuration is needed in development.

---

## Accounts

Everything under `/api` except `/api/health` and `/api/auth/*` needs a login.
The session is an HttpOnly cookie; see `docs/api-contract.md`.

- **Roles.** Plant owners and utilities see and act on their own plants. Grid
  operators and energy traders see every plant, read-only.
- **Demo.** `seed.py` creates one demo account per role, reachable only through
  the login page's demo buttons (`POST /api/auth/demo`). Set `DEMO_LOGIN=0` to
  turn them off.
- **Secret key.** Put `SECRET_KEY=...` in `backend/.env` for anything beyond
  local development. Without it, a random key is generated into
  `backend/.secret_key` (gitignored).

---

## If the database breaks

```bash
cd backend && python seed.py
```

Rebuilds everything from scratch. Do this rather than debugging database state
under time pressure. It also deletes every registered account.

---

## Layout

```
backend/
  app.py            Flask entry point, blueprint registration
  config.py         every tunable number, including regulatory parameters
  models.py         SQLAlchemy models — 7 tables
  seed.py           one-command database rebuild
  routes/           auth (accounts + access rules), plants, forecast, alerts, dashboard
  services/
    ingest.py       CSV loading + Open-Meteo client
    forecaster.py   train, evaluate, predict
    costing.py      deviation exposure arithmetic
    deviation.py    forecast-gap diagnostic
    pipeline.py     forecast run: weather -> blocks -> forecasts + costed actions
  ml/features.py    feature engineering

frontend/
  src/api/client.js single place the API base URL lives
  src/pages/        Overview, Forecast, Actions, AssetHealth
  src/components/   shared hook + currency formatting

docs/api-contract.md   agreed request/response shapes — read this first
data/raw/              source CSVs (gitignored)
```

---

## Working agreement

- `main` stays demo-ready at all times. Feature work happens on branches:
  `feat/forecast-model`, `feat/dashboard-ui`.
- The API contract in `docs/api-contract.md` changes **there first**, then in code.
- Commit every working state. Being able to reset to a working commit from forty
  minutes ago is worth more than clean history.
- Anything incomplete at hour 20 moves to the roadmap slide rather than shipping
  half-built.

## Division of work

| | Member A | Member B |
|---|---|---|
| Owns | data pipeline, model, costing and diagnostic logic | API scaffolding, frontend, demo |
| Directories | `backend/services`, `backend/ml`, `seed.py` | `frontend/`, `backend/routes` |

## Regulatory parameters

Tolerance bands and deviation slabs live in `backend/config.py` and are
configurable per state commission. Defaults follow the CERC DSM (Third
Amendment) Regulations 2026, in force 31 August 2026: ±5% for solar, ±10% for
wind, measured against scheduled generation.

Penalty figures are decision-support estimates computed from published slab
structures, not settlement statements.
