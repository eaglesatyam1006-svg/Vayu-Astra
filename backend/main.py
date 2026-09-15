"""
Vayu Astra - Real-Time Airfare Price Intelligence
FastAPI backend.

Run:
    pip install -r requirements.txt
    python seed_data.py
    uvicorn main:app --reload --port 8000
"""
import sqlite3
import statistics
import time
import uuid
import threading
from collections import deque, defaultdict
from contextlib import contextmanager
from datetime import datetime
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Query, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from analytics import (
    daily_average,
    compute_index,
    rolling_zscore_anomalies,
    exponential_smoothing_forecast,
    volatility,
    forecast_drivers,
    pct_change,
    cpi_impact,
    CITY_COORDS,
)
from ml_engine import ml_forecast, ml_anomalies
import jarvis
import ai_chat

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

DB_PATH = "vayu-astra.db"

# ---------------------------------------------------------------------------
# In-memory request metrics (real, tracked live via middleware below — not
# simulated numbers). Reset on server restart, which is fine for a demo.
# ---------------------------------------------------------------------------
REQUEST_LOG = deque(maxlen=2000)  # (timestamp, latency_ms, status_code)
_metrics_lock = threading.Lock()

# ---------------------------------------------------------------------------
# API key auth: real key issuance + per-tier in-memory rate limiting.
# Existing public endpoints (routes, forecast, etc.) stay open so the main
# dashboard keeps working with zero setup; auth guards the new admin-facing
# endpoints (/v1/auth/keys listing, /v1/system/metrics) to demonstrate a
# working auth layer without breaking the rest of the app.
# ---------------------------------------------------------------------------
TIER_LIMITS = {"viewer": 30, "developer": 120, "analyst": 120, "admin": 600}  # req/min
RATE_WINDOWS = defaultdict(deque)  # api key -> deque of recent request timestamps

app = FastAPI(
    title="Vayu Astra - Real-Time Airfare Price Intelligence",
    version="1.0.0",
    description="REST API for airfare index, route intelligence, anomaly detection, and forecasting.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

START_TIME = time.time()


@contextmanager
def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


@app.on_event("startup")
def init_auth_schema():
    with get_conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS api_keys (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                tier TEXT NOT NULL,
                created_at TEXT NOT NULL,
                requests_used INTEGER DEFAULT 0
            )
            """
        )
        conn.commit()


@app.middleware("http")
async def track_requests(request, call_next):
    start = time.time()
    try:
        response = await call_next(request)
    except Exception:
        with _metrics_lock:
            REQUEST_LOG.append((time.time(), (time.time() - start) * 1000, 500))
        raise
    latency_ms = (time.time() - start) * 1000
    with _metrics_lock:
        REQUEST_LOG.append((time.time(), latency_ms, response.status_code))
    return response


def check_rate_limit(key, tier):
    now = time.time()
    window = RATE_WINDOWS[key]
    while window and now - window[0] > 60:
        window.popleft()
    limit = TIER_LIMITS.get(tier, 30)
    if len(window) >= limit:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded: {limit} requests/min for tier '{tier}'.",
        )
    window.append(now)


def require_api_key(x_api_key: str = Header(None)):
    if not x_api_key:
        raise HTTPException(
            status_code=401,
            detail="Missing X-API-Key header. Issue one via POST /v1/auth/keys.",
        )
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM api_keys WHERE key=?", (x_api_key,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=403, detail="Invalid API key.")
        auth = dict(row)
        check_rate_limit(x_api_key, auth["tier"])
        conn.execute("UPDATE api_keys SET requests_used = requests_used + 1 WHERE key=?", (x_api_key,))
        conn.commit()
    return auth


def fetch_route_observations(conn, origin=None, destination=None):
    cur = conn.cursor()
    if origin and destination:
        cur.execute(
            "SELECT * FROM fare_observations WHERE origin=? AND destination=? ORDER BY observed_at",
            (origin.upper(), destination.upper()),
        )
    else:
        cur.execute("SELECT * FROM fare_observations ORDER BY observed_at")
    return [dict(row) for row in cur.fetchall()]


def list_routes(conn):
    cur = conn.cursor()
    cur.execute(
        """
        SELECT DISTINCT origin, destination, origin_city, destination_city
        FROM fare_observations ORDER BY origin, destination
        """
    )
    return [dict(row) for row in cur.fetchall()]


@app.get("/")
def root():
    return {"service": "Vayu Astra", "status": "online", "docs": "/docs"}


@app.get("/v1/health")
def health():
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) as c FROM fare_observations")
        count = cur.fetchone()["c"]
    return {
        "status": "healthy",
        "uptime_seconds": round(time.time() - START_TIME, 1),
        "records_in_db": count,
        "db": "healthy",
        "timestamp": datetime.now().isoformat(),
    }


@app.get("/v1/sources")
def sources():
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT source, COUNT(*) as c, MAX(observed_at) as last_seen FROM fare_observations GROUP BY source"
        )
        rows = [dict(r) for r in cur.fetchall()]
    return {
        "sources": [
            {"name": r["source"], "records": r["c"], "status": "Healthy", "last_update": r["last_seen"]}
            for r in rows
        ]
    }


@app.get("/v1/routes")
def routes():
    with get_conn() as conn:
        route_list = list_routes(conn)
        result = []
        for r in route_list:
            obs = fetch_route_observations(conn, r["origin"], r["destination"])
            daily = daily_average(obs)
            if not daily:
                continue
            current = daily[-1][1]
            previous = daily[-2][1] if len(daily) > 1 else current
            result.append(
                {
                    "origin": r["origin"],
                    "destination": r["destination"],
                    "origin_city": r["origin_city"],
                    "destination_city": r["destination_city"],
                    "current_fare": current,
                    "change_pct": pct_change(current, previous),
                    "volatility": volatility(daily),
                }
            )
    return {"routes": result, "count": len(result)}


@app.get("/v1/routes/{origin}-{destination}")
def route_detail(origin: str, destination: str):
    with get_conn() as conn:
        obs = fetch_route_observations(conn, origin, destination)
        if not obs:
            raise HTTPException(status_code=404, detail=f"No data for route {origin.upper()}-{destination.upper()}")
        daily = daily_average(obs)
        idx = compute_index(daily)
        fares_only = [f for _, f in daily]
        current = daily[-1][1]
        prior_30 = daily[-30:] if len(daily) >= 30 else daily
        prior_30_fares = [f for _, f in prior_30]

    return {
        "route": f"{origin.upper()}-{destination.upper()}",
        "current_fare": current,
        "avg_30d": round(statistics.mean(prior_30_fares), 2),
        "min_fare": round(min(fares_only), 2),
        "max_fare": round(max(fares_only), 2),
        "volatility_pct": volatility(daily),
        "index_current": idx[-1][1] if idx else None,
        "history": [{"date": d, "fare": f} for d, f in daily],
        "index_history": [{"date": d, "index": v} for d, v in idx],
    }


@app.get("/v1/index")
def market_index():
    """Aggregate Vayu Astra index across all routes, equal-weighted."""
    with get_conn() as conn:
        route_list = list_routes(conn)
        all_daily_indexes = []
        for r in route_list:
            obs = fetch_route_observations(conn, r["origin"], r["destination"])
            daily = daily_average(obs)
            idx = compute_index(daily)
            if idx:
                all_daily_indexes.append(dict(idx))

    if not all_daily_indexes:
        raise HTTPException(status_code=500, detail="No data available to compute index")

    # union of all dates present across routes, averaged per day
    all_dates = sorted(set().union(*[set(d.keys()) for d in all_daily_indexes]))
    series = []
    for date in all_dates:
        values = [d[date] for d in all_daily_indexes if date in d]
        if values:
            series.append({"date": date, "index": round(statistics.mean(values), 2)})

    current = series[-1]["index"] if series else 100.0
    previous = series[-2]["index"] if len(series) > 1 else current
    week_ago = series[-8]["index"] if len(series) > 8 else previous

    return {
        "current_index": current,
        "change_1d_pct": pct_change(current, previous),
        "change_7d_pct": pct_change(current, week_ago),
        "series": series,
    }


@app.get("/v1/anomalies")
def anomalies(threshold: float = Query(2.0, ge=1.0, le=5.0)):
    with get_conn() as conn:
        route_list = list_routes(conn)
        results = []
        for r in route_list:
            obs = fetch_route_observations(conn, r["origin"], r["destination"])
            daily = daily_average(obs)
            route_anomalies = rolling_zscore_anomalies(daily, threshold=threshold)
            for a in route_anomalies[-3:]:  # most recent few per route
                results.append(
                    {
                        "route": f"{r['origin']}-{r['destination']}",
                        "origin_city": r["origin_city"],
                        "destination_city": r["destination_city"],
                        **a,
                    }
                )
    results.sort(key=lambda a: a["date"], reverse=True)
    critical_count = sum(1 for a in results if a["severity"] == "critical")
    return {"anomalies": results, "count": len(results), "critical_count": critical_count}


@app.get("/v1/forecast/{origin}-{destination}")
def forecast(origin: str, destination: str, horizon_days: int = Query(30, ge=1, le=90)):
    with get_conn() as conn:
        obs = fetch_route_observations(conn, origin, destination)
        if not obs:
            raise HTTPException(status_code=404, detail=f"No data for route {origin.upper()}-{destination.upper()}")
        daily = daily_average(obs)

    result = exponential_smoothing_forecast(daily, horizon_days=horizon_days)
    drivers = forecast_drivers(daily)
    return {
        "route": f"{origin.upper()}-{destination.upper()}",
        "current": result["current"],
        "trend_per_day": result["trend_per_day"],
        "forecast": result["forecast"],
        "explainability": drivers,
        "note": "Forecast generated via exponential smoothing with a heuristic driver breakdown; not a trained ML model.",
    }


@app.get("/v1/forecast/ml/{origin}-{destination}")
def forecast_ml(origin: str, destination: str, horizon_days: int = Query(30, ge=1, le=90)):
    """Genuine trained-ML forecast (GradientBoostingRegressor, scikit-learn),
    trained fresh on this route's live data at request time. Reports real
    held-out MAE/R^2 alongside the projection — see ml_engine.py."""
    with get_conn() as conn:
        obs = fetch_route_observations(conn, origin, destination)
        if not obs:
            raise HTTPException(status_code=404, detail=f"No data for route {origin.upper()}-{destination.upper()}")
        daily = daily_average(obs)

    result = ml_forecast(daily, horizon_days=horizon_days)
    return {"route": f"{origin.upper()}-{destination.upper()}", **result}


@app.get("/v1/anomalies/ml")
def anomalies_ml(contamination: float = Query(0.07, ge=0.01, le=0.3)):
    """Genuine unsupervised-ML anomaly detection (IsolationForest), distinct
    from the rolling Z-score baseline — trained fresh across each route's
    (fare, day-over-day delta, local volatility) feature space."""
    with get_conn() as conn:
        route_list = list_routes(conn)
        results = []
        for r in route_list:
            obs = fetch_route_observations(conn, r["origin"], r["destination"])
            daily = daily_average(obs)
            route_anomalies = ml_anomalies(daily, contamination=contamination)
            for a in route_anomalies[:3]:
                results.append(
                    {
                        "route": f"{r['origin']}-{r['destination']}",
                        "origin_city": r["origin_city"],
                        "destination_city": r["destination_city"],
                        **a,
                    }
                )
    results.sort(key=lambda a: a["anomaly_score"], reverse=True)
    return {
        "anomalies": results,
        "count": len(results),
        "model": "IsolationForest (scikit-learn)",
        "note": "Unsupervised ML anomaly detection, trained fresh per request on live data. "
                "Complements /v1/anomalies (statistical Z-score baseline).",
    }


class ChatTurn(BaseModel):
    role: str
    text: str


class AssistantQuery(BaseModel):
    query: str
    history: Optional[List[ChatTurn]] = None


# Intents jarvis.py resolves with real, grounded data — anything else falls
# through to the conversational AI layer (or its offline fallback).
_DATA_INTENTS = {
    "route_status", "forecast", "anomalies", "index", "cpi",
    "anomalies_market", "routes_list", "route_not_found",
}


@app.post("/v1/assistant/query")
def assistant_query(body: AssistantQuery):
    """Vayu Astra's hybrid assistant.

    Domain questions (a route, the market index, anomalies, a forecast, CPI
    impact) are answered by jarvis.py's rule-based router — every number
    comes straight from the live database via the same analytics functions
    the rest of the API uses, so it can never state a figure the data
    doesn't support.

    Everything else (greetings, small talk, "what is this project", etc.) is
    handed to a real hosted LLM (see ai_chat.py) so the assistant converses
    naturally like any modern AI chat product, with a graceful canned
    fallback if no API key is configured on the backend."""
    with get_conn() as conn:
        result = jarvis.answer_query(body.query, conn, fetch_route_observations, list_routes)

    if result.get("intent") in _DATA_INTENTS:
        result["mode"] = "data"
        return result

    history = [t.model_dump() for t in body.history] if body.history else None
    reply = ai_chat.chat(body.query, history=history)
    return {"reply": reply, "intent": "chat", "data": None, "mode": "ai" if ai_chat.is_configured() else "offline"}


@app.get("/v1/assistant/status")
def assistant_status():
    """Lets the frontend show whether live-LLM chat is active or running in
    offline fallback mode."""
    return {"ai_configured": ai_chat.is_configured(), "model": ai_chat.ANTHROPIC_MODEL if ai_chat.is_configured() else None}


def _aggregate_index_series(conn):
    route_list = list_routes(conn)
    all_daily_indexes = []
    for r in route_list:
        obs = fetch_route_observations(conn, r["origin"], r["destination"])
        daily = daily_average(obs)
        idx = compute_index(daily)
        if idx:
            all_daily_indexes.append(dict(idx))
    if not all_daily_indexes:
        return []
    all_dates = sorted(set().union(*[set(d.keys()) for d in all_daily_indexes]))
    series = []
    for date in all_dates:
        values = [d[date] for d in all_daily_indexes if date in d]
        if values:
            series.append((date, round(statistics.mean(values), 2)))
    return series


@app.get("/v1/cpi/impact")
def cpi_impact_endpoint():
    """Simulated CPI transport sub-group pressure derived from the Vayu Astra index.
    Clearly labelled: this illustrates how an airfare index would feed a CPI
    computation, not an official statistic."""
    with get_conn() as conn:
        series = _aggregate_index_series(conn)
    if not series:
        raise HTTPException(status_code=500, detail="No data available to compute CPI impact")

    result = cpi_impact(series)
    return {
        **result,
        "series": [{"date": d, "index": v} for d, v in series],
        "note": (
            "Simulation for illustration, not an official CPI computation. YoY is "
            "extrapolated from available history (no full year of data), and the "
            "air-travel CPI weight is an approximation, not the official MoSPI figure."
        ),
    }


@app.get("/v1/geo/routes")
def geo_routes():
    """Route + airport coordinates for map rendering."""
    with get_conn() as conn:
        route_list = list_routes(conn)
        airports = {}
        routes_out = []
        for r in route_list:
            o, d = r["origin"], r["destination"]
            if o not in CITY_COORDS or d not in CITY_COORDS:
                continue
            obs = fetch_route_observations(conn, o, d)
            daily = daily_average(obs)
            if not daily:
                continue
            current = daily[-1][1]
            previous = daily[-2][1] if len(daily) > 1 else current
            for code, city in ((o, r["origin_city"]), (d, r["destination_city"])):
                if code not in airports:
                    airports[code] = {"code": code, "city": city, **CITY_COORDS[code]}
            routes_out.append(
                {
                    "origin": o,
                    "destination": d,
                    "origin_coords": CITY_COORDS[o],
                    "destination_coords": CITY_COORDS[d],
                    "current_fare": current,
                    "change_pct": pct_change(current, previous),
                    "volatility": volatility(daily),
                }
            )
    return {"airports": list(airports.values()), "routes": routes_out}


ENDPOINT_CATALOG = [
    {"method": "GET", "path": "/v1/health", "description": "Service status and record count.", "auth": False},
    {"method": "GET", "path": "/v1/sources", "description": "Ingestion source health.", "auth": False},
    {"method": "GET", "path": "/v1/routes", "description": "All tracked routes with current fare, change, volatility.", "auth": False},
    {"method": "GET", "path": "/v1/routes/{origin}-{destination}", "description": "Full history + index for one route.", "auth": False},
    {"method": "GET", "path": "/v1/index", "description": "Aggregate Vayu Astra market index, 90-day series.", "auth": False},
    {"method": "GET", "path": "/v1/anomalies", "description": "Detected fare anomalies across all routes.", "auth": False},
    {"method": "GET", "path": "/v1/forecast/{origin}-{destination}", "description": "Statistical forecast with confidence band and explainability.", "auth": False},
    {"method": "GET", "path": "/v1/forecast/ml/{origin}-{destination}", "description": "Trained ML forecast (GradientBoostingRegressor) with real held-out accuracy metrics.", "auth": False},
    {"method": "GET", "path": "/v1/anomalies/ml", "description": "Unsupervised ML anomaly detection (IsolationForest).", "auth": False},
    {"method": "POST", "path": "/v1/assistant/query", "description": "Hybrid AI assistant: live-data-grounded for domain questions, real LLM for open conversation.", "auth": False},
    {"method": "GET", "path": "/v1/assistant/status", "description": "Whether the conversational LLM is configured (vs offline fallback).", "auth": False},
    {"method": "GET", "path": "/v1/cpi/impact", "description": "Simulated CPI transport sub-group pressure from airfare trends.", "auth": False},
    {"method": "GET", "path": "/v1/geo/routes", "description": "Route + airport coordinates for map rendering.", "auth": False},
    {"method": "POST", "path": "/v1/auth/keys", "description": "Issue a new API key for a given tier.", "auth": False},
    {"method": "GET", "path": "/v1/auth/keys", "description": "List issued API keys (admin tier only).", "auth": True},
    {"method": "GET", "path": "/v1/system/metrics", "description": "Live request volume, latency, error rate, service health.", "auth": True},
]


@app.get("/v1/meta/endpoints")
def meta_endpoints():
    return {"endpoints": ENDPOINT_CATALOG, "base_url": "/api"}


@app.post("/v1/auth/keys")
def create_api_key(
    name: str = Query(..., min_length=1, max_length=64),
    tier: str = Query("developer", pattern="^(viewer|developer|analyst|admin)$"),
):
    key = f"vayu-astra_{tier[:4]}_{uuid.uuid4().hex[:20]}"
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO api_keys (key, name, tier, created_at) VALUES (?, ?, ?, ?)",
            (key, name, tier, datetime.now().isoformat()),
        )
        conn.commit()
    return {"key": key, "name": name, "tier": tier, "rate_limit_per_min": TIER_LIMITS[tier]}


@app.get("/v1/auth/keys")
def list_api_keys(auth: dict = Depends(require_api_key)):
    if auth["tier"] != "admin":
        raise HTTPException(status_code=403, detail="Admin tier required to list keys.")
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id, name, tier, created_at, requests_used FROM api_keys ORDER BY created_at DESC")
        rows = [dict(r) for r in cur.fetchall()]
    return {"keys": rows}


@app.get("/v1/system/metrics")
def system_metrics(auth: dict = Depends(require_api_key)):
    now = time.time()
    with _metrics_lock:
        log_snapshot = list(REQUEST_LOG)
    recent = [r for r in log_snapshot if now - r[0] <= 60]
    total = len(log_snapshot)
    errors = sum(1 for r in log_snapshot if r[2] >= 400)
    avg_latency = round(statistics.mean([r[1] for r in log_snapshot]), 1) if log_snapshot else 0.0

    db_ok = True
    try:
        with get_conn() as conn:
            conn.execute("SELECT 1")
    except Exception:
        db_ok = False

    analytics_ok = True
    try:
        exponential_smoothing_forecast([("2024-01-01", 100.0), ("2024-01-02", 101.0)], horizon_days=1)
    except Exception:
        analytics_ok = False

    ml_ok = True
    try:
        import sklearn  # noqa: F401
    except Exception:
        ml_ok = False

    return {
        "uptime_seconds": round(time.time() - START_TIME, 1),
        "requests_total": total,
        "requests_last_min": len(recent),
        "avg_latency_ms": avg_latency,
        "error_rate_pct": round((errors / total) * 100, 2) if total else 0.0,
        "services": {
            "api": "Healthy",
            "database": "Healthy" if db_ok else "Down",
            "analytics_engine": "Healthy" if analytics_ok else "Down",
            "ml_engine": "Healthy" if ml_ok else "Down",
        },
        "authenticated_as": {"name": auth["name"], "tier": auth["tier"]},
    }
