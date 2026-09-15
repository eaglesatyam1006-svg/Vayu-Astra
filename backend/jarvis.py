"""
jarvis.py — Vayu Astra's data-grounded intent router.

Honesty note (same spirit as README's "what's real vs simulated"): this is a
rule-based natural-language *intent router*, not a hosted large language
model — there's no external LLM API call happening here. What it says is
never invented: every reply is composed from numbers pulled live from
analytics.py / ml_engine.py against the actual database.

Anything this module doesn't recognize as a domain intent (falls through to
"fallback"/"help") is handed off by main.py to ai_chat.py, which routes to a
real hosted LLM for natural open-ended conversation. This file stays
deliberately deterministic so every fare, index, or forecast number it
states is always traceable back to the database.

Intents covered: market index, route lookup, anomalies, forecast, CPI
impact, system status, and a fallback that hands off to the AI chat layer.
"""
import re
import statistics

from analytics import (
    daily_average,
    compute_index,
    rolling_zscore_anomalies,
    exponential_smoothing_forecast,
    volatility,
    pct_change,
    cpi_impact,
)

CITY_ALIASES = {
    "delhi": "DEL", "new delhi": "DEL", "del": "DEL",
    "mumbai": "BOM", "bombay": "BOM", "bom": "BOM",
    "bengaluru": "BLR", "bangalore": "BLR", "blr": "BLR",
    "hyderabad": "HYD", "hyd": "HYD",
    "kolkata": "CCU", "calcutta": "CCU", "ccu": "CCU",
    "chennai": "MAA", "madras": "MAA", "maa": "MAA",
    "goa": "GOI", "goi": "GOI",
    "pune": "PNQ", "pnq": "PNQ",
    "ahmedabad": "AMD", "amd": "AMD",
}


def _find_city_codes(text):
    text_low = text.lower()
    found = []
    for alias, code in sorted(CITY_ALIASES.items(), key=lambda x: -len(x[0])):
        if re.search(rf"\b{re.escape(alias)}\b", text_low) and code not in found:
            found.append(code)
    return found


def _greet_or_help():
    return (
        "Systems nominal. I can brief you on the market index, a specific route, "
        "detected anomalies, a fare forecast, CPI impact, or platform health. "
        "Try: \u201cforecast Delhi to Mumbai\u201d or \u201cany anomalies on Bengaluru Hyderabad\u201d."
    )


def answer_query(query, conn, fetch_route_observations, list_routes):
    """Returns {reply, intent, data}. `data` carries structured numbers the
    frontend can render as a mini HUD card next to the chat bubble.
    """
    q = (query or "").strip()
    if not q:
        return {"reply": _greet_or_help(), "intent": "help", "data": None}
    q_low = q.lower()

    route_list = list_routes(conn)
    codes = _find_city_codes(q)

    # --- Intent: route-specific (forecast / anomalies / general) ---
    if len(codes) >= 2:
        origin, destination = codes[0], codes[1]
        pair_exists = any(
            (r["origin"] == origin and r["destination"] == destination)
            or (r["origin"] == destination and r["destination"] == origin)
            for r in route_list
        )
        if not pair_exists:
            return {
                "reply": f"I don't have a tracked route between {origin} and {destination} in the current data set. "
                         f"Ask me about one of the tracked routes, or say \u201cshow routes\u201d.",
                "intent": "route_not_found",
                "data": None,
            }
        # normalize direction to whichever exists in the DB
        if not any(r["origin"] == origin and r["destination"] == destination for r in route_list):
            origin, destination = destination, origin

        obs = fetch_route_observations(conn, origin, destination)
        daily = daily_average(obs)
        current = daily[-1][1] if daily else None
        previous = daily[-2][1] if len(daily) > 1 else current
        change = pct_change(current, previous)
        vol = volatility(daily)

        if "forecast" in q_low or "predict" in q_low or "next" in q_low or "will" in q_low:
            fc = exponential_smoothing_forecast(daily, horizon_days=14)
            end = fc["forecast"][-1] if fc["forecast"] else None
            direction = "rising" if fc["trend_per_day"] > 0 else ("falling" if fc["trend_per_day"] < 0 else "flat")
            reply = (
                f"{origin}-{destination}: current fare is \u20b9{current:,.0f}, trending {direction} "
                f"at roughly \u20b9{abs(fc['trend_per_day']):.0f}/day. In 14 days I project \u20b9{end['expected']:,.0f} "
                f"(range \u20b9{end['lower']:,.0f}\u2013\u20b9{end['upper']:,.0f})." if end else
                f"Not enough history on {origin}-{destination} yet to forecast confidently."
            )
            return {"reply": reply, "intent": "forecast", "data": {"route": f"{origin}-{destination}", "forecast": fc}}

        if "anomal" in q_low or "spike" in q_low or "unusual" in q_low or "weird" in q_low:
            anomalies = rolling_zscore_anomalies(daily, threshold=2.0)
            recent = anomalies[-3:]
            if not recent:
                reply = f"No statistically significant anomalies detected on {origin}-{destination} in the tracked window \u2014 fares are behaving normally."
            else:
                latest = recent[-1]
                reply = (
                    f"{len(recent)} anomaly event(s) flagged on {origin}-{destination}. Most recent: "
                    f"{latest['date']}, fare \u20b9{latest['fare']:,.0f} vs an expected \u20b9{latest['expected']:,.0f} "
                    f"(z={latest['z_score']}, {latest['severity']})."
                )
            return {"reply": reply, "intent": "anomalies", "data": {"route": f"{origin}-{destination}", "anomalies": recent}}

        # general route status
        reply = (
            f"{origin}-{destination}: \u20b9{current:,.0f} currently, "
            f"{'up' if change >= 0 else 'down'} {abs(change):.2f}% vs the prior reading. "
            f"30-day volatility is {vol}%."
        )
        return {
            "reply": reply,
            "intent": "route_status",
            "data": {"route": f"{origin}-{destination}", "current": current, "change_pct": change, "volatility": vol},
        }

    # --- Intent: market index ---
    if any(k in q_low for k in ["index", "market", "overall", "average fare"]):
        all_daily = []
        for r in route_list:
            obs = fetch_route_observations(conn, r["origin"], r["destination"])
            idx = compute_index(daily_average(obs))
            if idx:
                all_daily.append(dict(idx))
        if not all_daily:
            return {"reply": "No index data available yet.", "intent": "index", "data": None}
        all_dates = sorted(set().union(*[set(d.keys()) for d in all_daily]))
        series = [(d, statistics.mean(vals)) for d in all_dates if (vals := [dd[d] for dd in all_daily if d in dd])]
        current = series[-1][1]
        week_ago = series[-8][1] if len(series) > 8 else series[0][1]
        wow = pct_change(current, week_ago)
        reply = (
            f"The Vayu Astra market index is at {current:.2f} (base 100), "
            f"{'up' if wow >= 0 else 'down'} {abs(wow):.2f}% week-over-week across {len(route_list)} tracked routes."
        )
        return {"reply": reply, "intent": "index", "data": {"current_index": round(current, 2), "wow_change_pct": wow}}

    # --- Intent: CPI ---
    if "cpi" in q_low or "inflation" in q_low:
        all_daily = []
        for r in route_list:
            obs = fetch_route_observations(conn, r["origin"], r["destination"])
            idx = compute_index(daily_average(obs))
            if idx:
                all_daily.append(dict(idx))
        if not all_daily:
            return {"reply": "Not enough data yet to simulate CPI impact.", "intent": "cpi", "data": None}
        all_dates = sorted(set().union(*[set(d.keys()) for d in all_daily]))
        series = [(d, round(statistics.mean(vals), 2)) for d in all_dates if (vals := [dd[d] for dd in all_daily if d in dd])]
        result = cpi_impact(series)
        reply = (
            f"Simulated transport sub-group pressure from airfares: {result['estimated_transport_subgroup_pressure_pp']} "
            f"percentage points, on a month-over-month airfare move of {result['mom_change_pct']}%. "
            f"This is a labelled simulation, not an official MoSPI figure."
        )
        return {"reply": reply, "intent": "cpi", "data": result}

    # --- Intent: anomalies, market-wide ---
    if "anomal" in q_low or "spike" in q_low:
        total = 0
        worst = None
        for r in route_list:
            obs = fetch_route_observations(conn, r["origin"], r["destination"])
            daily = daily_average(obs)
            route_anomalies = rolling_zscore_anomalies(daily, threshold=2.0)
            total += len(route_anomalies)
            for a in route_anomalies[-2:]:
                if worst is None or abs(a["z_score"]) > abs(worst["z_score"]):
                    worst = {**a, "route": f"{r['origin']}-{r['destination']}"}
        if total == 0:
            reply = "No anomalies detected across any tracked route right now."
        else:
            reply = (
                f"{total} anomaly event(s) detected across {len(route_list)} routes. "
                f"Most severe: {worst['route']} on {worst['date']} (z={worst['z_score']}, {worst['severity']})."
            )
        return {"reply": reply, "intent": "anomalies_market", "data": {"total": total, "worst": worst}}

    # --- Intent: routes list ---
    if "route" in q_low and ("list" in q_low or "show" in q_low or "which" in q_low or "what" in q_low):
        names = [f"{r['origin']}-{r['destination']}" for r in route_list]
        reply = f"Tracking {len(names)} routes: {', '.join(names)}."
        return {"reply": reply, "intent": "routes_list", "data": {"routes": names}}

    # --- Intent: greetings/help ---
    if any(k in q_low for k in ["hello", "hi", "hey", "help", "what can you do"]):
        return {"reply": _greet_or_help(), "intent": "help", "data": None}

    # --- Fallback ---
    return {
        "reply": "I didn't catch a route, the market index, anomalies, forecast, or CPI in that \u2014 "
                 "could you rephrase? For example: \u201cforecast Delhi Bengaluru\u201d or \u201cmarket index\u201d.",
        "intent": "fallback",
        "data": None,
    }
