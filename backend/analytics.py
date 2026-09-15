"""
Core analytics: fare index, anomaly detection, forecasting.
Pure functions operating on lists of (date, fare) so they're testable in isolation.
"""
import math
import statistics
from datetime import datetime, timedelta


def daily_average(observations):
    """observations: list of dicts with 'observed_at' (ISO str) and 'fare'.
    Returns sorted list of (date_str, avg_fare) collapsed to one point per day.
    """
    buckets = {}
    for obs in observations:
        day = obs["observed_at"][:10]
        buckets.setdefault(day, []).append(obs["fare"])
    result = [(day, round(statistics.mean(fares), 2)) for day, fares in buckets.items()]
    result.sort(key=lambda x: x[0])
    return result


def compute_index(daily_series, base_value=100.0):
    """Rebases a fare series to an index where the first point = base_value."""
    if not daily_series:
        return []
    base_fare = daily_series[0][1]
    if base_fare == 0:
        return [(d, base_value) for d, _ in daily_series]
    return [(d, round((fare / base_fare) * base_value, 2)) for d, fare in daily_series]


def pct_change(current, previous):
    if previous in (0, None) or current is None:
        return 0.0
    return round(((current - previous) / previous) * 100, 2)


def rolling_zscore_anomalies(daily_series, window=7, threshold=2.0):
    """Detect anomalies using a rolling Z-score.
    daily_series: list of (date, fare) tuples, sorted ascending.
    Returns list of dicts describing detected anomalies.
    """
    anomalies = []
    fares = [f for _, f in daily_series]
    for i in range(window, len(fares)):
        window_slice = fares[i - window:i]
        mean = statistics.mean(window_slice)
        stdev = statistics.pstdev(window_slice)
        if stdev == 0:
            continue
        z = (fares[i] - mean) / stdev
        if abs(z) >= threshold:
            date, fare = daily_series[i]
            anomalies.append(
                {
                    "date": date,
                    "fare": fare,
                    "expected": round(mean, 2),
                    "z_score": round(z, 2),
                    "deviation_pct": pct_change(fare, mean),
                    "severity": "critical" if abs(z) >= 3 else "warning",
                }
            )
    return anomalies


def exponential_smoothing_forecast(daily_series, horizon_days=30, alpha=0.3):
    """Simple exponential smoothing with a linear trend correction and a
    widening confidence interval based on historical residual volatility.
    """
    fares = [f for _, f in daily_series]
    if len(fares) < 2:
        return {"forecast": [], "current": fares[-1] if fares else None}

    # Fit smoothed level
    level = fares[0]
    smoothed = [level]
    for f in fares[1:]:
        level = alpha * f + (1 - alpha) * level
        smoothed.append(level)

    # Estimate trend as average of recent day-over-day smoothed deltas
    recent_deltas = [smoothed[i] - smoothed[i - 1] for i in range(max(1, len(smoothed) - 14), len(smoothed))]
    trend = statistics.mean(recent_deltas) if recent_deltas else 0.0

    # Residual volatility for confidence interval sizing
    residuals = [fares[i] - smoothed[i] for i in range(len(fares))]
    resid_std = statistics.pstdev(residuals) if len(residuals) > 1 else fares[-1] * 0.05

    last_date = datetime.fromisoformat(daily_series[-1][0])
    last_level = smoothed[-1]

    forecast_points = []
    for h in range(1, horizon_days + 1):
        projected = last_level + trend * h
        # confidence band widens with sqrt(horizon) — standard for random-walk-style uncertainty
        band = resid_std * math.sqrt(h) * 1.2
        date = (last_date + timedelta(days=h)).strftime("%Y-%m-%d")
        forecast_points.append(
            {
                "date": date,
                "expected": round(max(0, projected), 2),
                "lower": round(max(0, projected - band), 2),
                "upper": round(projected + band, 2),
            }
        )

    return {
        "current": round(fares[-1], 2),
        "forecast": forecast_points,
        "trend_per_day": round(trend, 2),
    }


def volatility(daily_series, window=30):
    """Coefficient of variation over the trailing window, as a percentage."""
    fares = [f for _, f in daily_series[-window:]]
    if len(fares) < 2:
        return 0.0
    mean = statistics.mean(fares)
    stdev = statistics.pstdev(fares)
    if mean == 0:
        return 0.0
    return round((stdev / mean) * 100, 2)


CITY_COORDS = {
    "DEL": {"city": "Delhi", "lat": 28.5562, "lon": 77.1000},
    "BOM": {"city": "Mumbai", "lat": 19.0896, "lon": 72.8656},
    "BLR": {"city": "Bengaluru", "lat": 13.1989, "lon": 77.7068},
    "HYD": {"city": "Hyderabad", "lat": 17.2403, "lon": 78.4294},
    "CCU": {"city": "Kolkata", "lat": 22.6547, "lon": 88.4467},
    "MAA": {"city": "Chennai", "lat": 12.9941, "lon": 80.1709},
    "GOI": {"city": "Goa", "lat": 15.3800, "lon": 73.8310},
    "PNQ": {"city": "Pune", "lat": 18.5822, "lon": 73.9197},
    "AMD": {"city": "Ahmedabad", "lat": 23.0772, "lon": 72.6347},
}

# Commonly cited approximation of air travel's weight within India's CPI
# "Transport and Communication" sub-group. Not an official MoSPI figure —
# used here only to illustrate how an index feeds a CPI-style computation.
AIR_TRAVEL_CPI_WEIGHT_PCT = 0.7


def cpi_impact(index_series):
    """index_series: list of (date, index_value) tuples, sorted ascending.
    Returns a CPI-style impact summary. Explicitly a simulation — see 'note'
    in the API response, since real YoY needs a full year of data and the
    official sub-group weight isn't public in a form we can cite here.
    """
    if not index_series:
        return None
    current = index_series[-1][1]
    week_ago = index_series[-8][1] if len(index_series) > 7 else index_series[0][1]
    month_ago = index_series[-31][1] if len(index_series) > 30 else index_series[0][1]

    first = index_series[0][1]
    n = max(1, len(index_series) - 1)
    daily_growth = (current / first) ** (1 / n) - 1 if first else 0.0
    simulated_yoy = round(((1 + daily_growth) ** 365 - 1) * 100, 2)

    mom = pct_change(current, month_ago)
    pressure_pp = round((mom / 100) * (AIR_TRAVEL_CPI_WEIGHT_PCT / 100) * 100, 4)

    return {
        "airfare_vayu-astra_index": current,
        "wow_change_pct": pct_change(current, week_ago),
        "mom_change_pct": mom,
        "simulated_yoy_change_pct": simulated_yoy,
        "assumed_air_travel_cpi_weight_pct": AIR_TRAVEL_CPI_WEIGHT_PCT,
        "estimated_transport_subgroup_pressure_pp": pressure_pp,
    }


def forecast_drivers(daily_series):
    """Lightweight explainability: decompose recent change into rough named factors.
    This is a heuristic breakdown, not a trained feature-importance model — labelled
    as such in the UI.
    """
    if len(daily_series) < 14:
        return []
    fares = [f for _, f in daily_series]
    recent = statistics.mean(fares[-7:])
    prior = statistics.mean(fares[-14:-7])
    total_change = recent - prior
    if total_change == 0:
        return []

    # Heuristic split of the change into named buckets (weights sum to 1)
    weights = {
        "Recent demand trend": 0.35,
        "Weekly seasonal pattern": 0.25,
        "Route volatility": 0.20,
        "Short-term fare momentum": 0.20,
    }
    drivers = []
    for label, w in weights.items():
        drivers.append(
            {
                "label": label,
                "contribution_pct": round(pct_change(recent, prior) * w, 2),
            }
        )
    drivers.sort(key=lambda d: abs(d["contribution_pct"]), reverse=True)
    return drivers
