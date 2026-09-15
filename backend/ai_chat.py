"""
ai_chat.py — Vayu Astra's general-conversation layer.

Design: a hybrid assistant, not a pure LLM wrapper.

  1. Anything that maps to a known domain intent (route status, forecast,
     anomalies, market index, CPI impact, route list) is answered by
     jarvis.py's rule-based router, which pulls real numbers straight out
     of the database. That path NEVER touches an LLM, so it can't
     hallucinate a fare or a trend.

  2. Anything else — "hi", "good morning", "what are you", "what can this
     project do", "thanks", "tell me a joke", general chit-chat — is
     handed to a real hosted LLM (Anthropic's Claude, via ANTHROPIC_API_KEY)
     so it responds the way a normal AI assistant does: naturally, to
     whatever is actually said, not from a fixed script.

  3. If no API key is configured, we fall back to a friendly canned
     reply instead of failing, so the assistant still feels alive in a
     no-key demo environment.

This keeps the "sounds like Claude/ChatGPT" requirement for open-ended
conversation while keeping every *factual number* the assistant states
grounded in the live database.
"""
import json
import os
import urllib.request
import urllib.error

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "").strip()
ANTHROPIC_MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-5-20250929")
ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"

SYSTEM_PROMPT = """You are the onboard AI assistant for Vayu Astra, a real-time \
national airfare price intelligence platform (built for Smart India Hackathon, \
problem statement SIH26056 — a Real-Time Airfare Price Index for the CPI \
Transport Sub-group). Vayu Astra tracks live domestic airfares across Indian \
routes, computes a market index, detects anomalies, forecasts prices, and \
estimates the impact of airfares on the CPI transport sub-group.

You are having a normal, natural conversation — greetings, small talk, \
questions about who you are or what the platform does, anything at all. \
Reply the way any capable AI assistant would: warm, direct, concise (usually \
1-4 sentences unless more is genuinely needed), and never robotic or \
scripted.

If the person asks something that needs a *live number* — a specific route's \
fare, the market index value, an anomaly, a forecast, or CPI impact — tell \
them briefly that you can pull that up and to ask you directly (e.g. \
"try asking me 'forecast Delhi to Mumbai'"), since those answers come from a \
separate live-data lookup, not from you. Never invent a fare, percentage, or \
statistic yourself.
"""

FALLBACK_GREETING = (
    "Hey! I'm the Vayu Astra assistant. I can chat normally, or pull live "
    "numbers — try \u201cmarket index\u201d, \u201cforecast Delhi to Mumbai\u201d, "
    "or \u201cany anomalies right now?\u201d"
)

FALLBACK_GENERIC = (
    "I hear you! I'm running in offline mode right now (no AI key configured "
    "on the backend), so free-form chat is limited — but I can still answer "
    "anything about live routes, the market index, forecasts, anomalies, or "
    "CPI impact. What would you like to check?"
)


def is_configured():
    return bool(ANTHROPIC_API_KEY)


def _fallback_reply(query):
    q = (query or "").lower().strip()
    if any(k in q for k in ["hi", "hello", "hey", "good morning", "good afternoon",
                             "good evening", "greetings", "namaste"]):
        return FALLBACK_GREETING
    if any(k in q for k in ["thank", "thanks"]):
        return "Anytime! Let me know if you want another number pulled."
    if any(k in q for k in ["who are you", "what are you", "what is vayu astra", "what can you do"]):
        return (
            "I'm the Vayu Astra assistant — I sit on top of a live airfare "
            "intelligence engine tracking Indian domestic routes in real time. "
            "Ask me about the market index, a specific route, anomalies, a "
            "forecast, or CPI impact."
        )
    return FALLBACK_GENERIC


def chat(query, history=None):
    """Free-form conversational reply. `history` is an optional list of
    {role, text} dicts for short-term context. Returns a plain string.
    Never raises — falls back to a canned reply on any error."""
    if not is_configured():
        return _fallback_reply(query)

    messages = []
    for turn in (history or [])[-6:]:
        role = "user" if turn.get("role") == "user" else "assistant"
        text = (turn.get("text") or "").strip()
        if text:
            messages.append({"role": role, "content": text})
    messages.append({"role": "user", "content": query})

    payload = json.dumps({
        "model": ANTHROPIC_MODEL,
        "max_tokens": 400,
        "system": SYSTEM_PROMPT,
        "messages": messages,
    }).encode("utf-8")

    req = urllib.request.Request(
        ANTHROPIC_URL,
        data=payload,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        blocks = data.get("content", [])
        text = "".join(b.get("text", "") for b in blocks if b.get("type") == "text").strip()
        return text or _fallback_reply(query)
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, ValueError, KeyError):
        return _fallback_reply(query)
