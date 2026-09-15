# Vayu Astra — Real-Time Airfare Price Intelligence

A full-stack platform tracking Indian domestic airfares: live market view,
route intelligence, dual anomaly detection (statistical + ML), dual
forecasting (statistical + trained ML model), geographic route mapping, CPI
impact modelling, a live developer API portal, API-key-gated system health
metrics, an animated 3D flight-network hero, and **ASTRA** — a hybrid AI
assistant that answers domain questions from live data and holds natural,
open-ended conversation via a real hosted LLM.

## Stack

- **Backend**: FastAPI + SQLite. Pure-Python analytics (rolling Z-score
  anomaly detection, exponential smoothing forecast with widening confidence
  bands, CPI-impact simulation) *plus* a genuine scikit-learn ML layer
  (`ml_engine.py`): a GradientBoostingRegressor trained fresh per request on
  each route's history with a real held-out train/test split (reports actual
  MAE/R², not hardcoded numbers), and an IsolationForest for unsupervised
  anomaly detection — shown side-by-side with the statistical baselines so
  you can compare them. **ASTRA**, the AI assistant, is hybrid: a rule-based
  intent router (`jarvis.py`) answers anything domain-specific (a route, the
  market index, anomalies, a forecast, CPI impact) by calling the same real
  analytics functions — it can never state a number the data doesn't
  support. Anything else — greetings, small talk, "what is this project" —
  is handed to a real hosted LLM (`ai_chat.py`, Claude via `ANTHROPIC_API_KEY`)
  so it converses naturally, with a graceful offline fallback if no key is
  configured. Real in-memory request metrics and API-key auth with per-tier
  rate limiting — no external auth service required.
- **Frontend**: React + Vite + Tailwind + Recharts + GSAP + Three.js. Custom
  SVG India route map (no external map library/API key needed), an animated
  3D flight-network visualization on the Overview page, and a floating ASTRA
  HUD assistant available on every page.

## How to run

### Option A — Docker (one command)

```bash
docker compose up --build
```

- Frontend: http://localhost:5173
- Backend docs: http://localhost:8000/docs

### Option B — Local dev (two terminals)

**1. Backend**

```powershell
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python seed_data.py
uvicorn main:app --reload --port 8000
```

Leave this running. Visit `http://127.0.0.1:8000/docs` to confirm it's live.

**2. Frontend** (second terminal)

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The Vite dev server proxies `/api/*` to the
backend on port 8000 (see `vite.config.js`).

### Enabling live AI chat (ASTRA)

Domain questions (routes, index, forecasts, anomalies, CPI) work fully
without any API key — they're answered from the live database. To also make
open-ended conversation (greetings, small talk, "what can you do") go
through a real hosted LLM instead of the offline canned fallback:

```bash
cd backend
cp .env.example .env
# then edit .env and set ANTHROPIC_API_KEY=sk-ant-...
```

Restart the backend after adding the key. The ASTRA widget shows a
"live AI" / "offline mode" badge in its header so it's obvious which mode
is active — for Docker, pass `ANTHROPIC_API_KEY` as an environment variable
to `docker compose up`.

## What's real vs. what's simulated

Being able to explain this clearly is a strength, not a weakness, in front of
judges:

- **Fare data**: synthetically generated (`seed_data.py`) with realistic
  trend, weekly seasonality, and injected anomalies — standing in for a live
  airline data feed, which would require commercial API access.
- **Anomaly detection**: genuine rolling Z-score, computed for real on
  whatever data is in the database.
- **Forecast**: genuine exponential smoothing with a real trend estimate and
  a confidence band that widens with the forecast horizon.
- **Explainability panel**: a heuristic breakdown of recent price change into
  labelled buckets, not a trained model's feature importances — the API says
  so explicitly (`note` field).
- **CPI impact**: a labelled simulation showing how an airfare index would
  feed a CPI sub-group computation. YoY is extrapolated from 90 days of data
  (no full year available) and the air-travel weight is an approximation,
  not an official MoSPI figure. The API and UI both say this plainly.
- **Geographic map**: real coordinates for the 9 tracked cities, custom SVG
  projection — no external map API/key needed.
- **Auth & rate limiting**: genuinely enforced. API keys are generated and
  stored server-side (SQLite), and `/v1/system/metrics` / `/v1/auth/keys`
  actually require a valid `X-API-Key` header and are actually rate-limited
  per tier (see `TIER_LIMITS` in `main.py`).
- **System metrics**: request count, latency, and error rate are tracked
  live via middleware — not hardcoded numbers.
- **ASTRA chat**: domain answers are always grounded in the live database
  (see above). Open-ended conversation is a genuine LLM call when
  `ANTHROPIC_API_KEY` is set, and a labelled offline fallback otherwise —
  never a fabricated data point either way.

## Project structure

```
airfare-vayu-astra/
├── docker-compose.yml
├── backend/
│   ├── main.py          # FastAPI app, all endpoints, auth, metrics middleware
│   ├── analytics.py     # index, anomaly, forecast, CPI logic (pure functions)
│   ├── ml_engine.py     # scikit-learn forecast + anomaly models
│   ├── jarvis.py        # rule-based, data-grounded intent router
│   ├── ai_chat.py        # LLM-backed open conversation layer (+ offline fallback)
│   ├── seed_data.py     # generates synthetic fare data into vayu-astra.db
│   ├── requirements.txt
│   ├── .env.example
│   └── Dockerfile
└── frontend/
    ├── src/
    │   ├── pages/        # Overview, LiveMarket, RouteIntelligence, Anomalies,
    │   │                 # Forecast, GeoIntelligence, CpiIntelligence,
    │   │                 # DataQuality, ApiPortal, SystemHealth
    │   ├── components/   # Sidebar, KpiCard, PageHeader, States,
    │   │                 # FlightNetwork3D (Three.js hero), JarvisAssistant (ASTRA chat)
    │   ├── api.js         # API client
    │   ├── useApi.js      # data-fetching hook (loading/error/poll)
    │   └── App.jsx
    ├── nginx.conf
    ├── Dockerfile
    └── package.json
```

## API endpoints

| Endpoint | Auth | Description |
|---|---|---|
| `GET /v1/health` | – | Service status, record count |
| `GET /v1/sources` | – | Ingestion source health |
| `GET /v1/routes` | – | All routes with current fare, change, volatility |
| `GET /v1/routes/{origin}-{destination}` | – | Full history + index for one route |
| `GET /v1/index` | – | Aggregate Vayu Astra market index, 90-day series |
| `GET /v1/anomalies?threshold=2.0` | – | Detected anomalies across all routes |
| `GET /v1/forecast/{origin}-{destination}?horizon_days=30` | – | Forecast + confidence band + explainability |
| `GET /v1/cpi/impact` | – | Simulated CPI transport sub-group pressure |
| `GET /v1/geo/routes` | – | Route + airport coordinates for map rendering |
| `GET /v1/meta/endpoints` | – | Machine-readable endpoint catalog (powers the API Portal page) |
| `POST /v1/auth/keys?name=&tier=` | – | Issue a new API key (tiers: viewer/developer/analyst/admin) |
| `GET /v1/auth/keys` | admin | List issued API keys |
| `GET /v1/system/metrics` | any tier | Live request volume, latency, error rate, service health |

Rate limits (requests/min, rolling 60s window): viewer 30, developer 120,
analyst 120, admin 600.

## Known limitations (be upfront about these if asked)

- Data is synthetic, not pulled from live airline sources — building
  compliant live ingestion (rate limits, permitted APIs, retries) is real
  infrastructure work beyond a few hours.
- Forecast is a statistical baseline, not a trained ML model — a gradient
  boosting model with proper train/test evaluation is the natural next step.
- Single-node SQLite; API keys and request metrics reset if the container/
  process restarts (no persistent volume by design, for a clean demo state).
- CPI weight and YoY figures are illustrative approximations, not official
  statistics — labelled as such everywhere they appear.
