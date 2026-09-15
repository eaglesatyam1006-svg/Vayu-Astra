import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { Sparkles, Send, X, Radio } from "lucide-react";
import { api } from "../api";

const SUGGESTIONS = [
  "Hey, what can you do?",
  "Market index",
  "Forecast Delhi to Mumbai",
  "Any anomalies right now?",
];

const WELCOME = {
  role: "assistant",
  text:
    "Hey! I'm ASTRA, the Vayu Astra assistant. Ask me anything — greet me, ask what I do, " +
    "or ask for the market index, a route, anomalies, a forecast, or CPI impact.",
  data: null,
  done: true,
};

/** Reveals `text` character-by-character into the given message index, so
 * replies feel like they're being generated live rather than dumped in. */
function useStreamReveal(setMessages) {
  const timerRef = useRef(null);
  return (index, fullText) => {
    let i = 0;
    clearInterval(timerRef.current);
    const step = Math.max(1, Math.round(fullText.length / 60));
    timerRef.current = setInterval(() => {
      i += step;
      setMessages((msgs) => {
        const next = [...msgs];
        if (!next[index]) return msgs;
        next[index] = { ...next[index], text: fullText.slice(0, i), done: i >= fullText.length };
        return next;
      });
      if (i >= fullText.length) clearInterval(timerRef.current);
    }, 12);
  };
}

export default function JarvisAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([WELCOME]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [aiStatus, setAiStatus] = useState(null); // { ai_configured, model }
  const panelRef = useRef(null);
  const scrollRef = useRef(null);
  const reveal = useStreamReveal(setMessages);

  useEffect(() => {
    api.assistantStatus().then(setAiStatus).catch(() => setAiStatus(null));
  }, []);

  useEffect(() => {
    if (open && panelRef.current) {
      gsap.fromTo(
        panelRef.current,
        { opacity: 0, y: 16, scale: 0.97 },
        { opacity: 1, y: 0, scale: 1, duration: 0.28, ease: "power2.out" }
      );
    }
  }, [open]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, busy]);

  async function send(text) {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    const history = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, text: m.text }));
    setMessages((m) => [...m, { role: "user", text: q, done: true }]);
    setInput("");
    setBusy(true);
    try {
      const res = await api.assistantQuery(q, history);
      setMessages((m) => {
        const idx = m.length;
        const next = [
          ...m,
          { role: "assistant", text: "", fullText: res.reply, data: res.data, intent: res.intent, mode: res.mode, done: false },
        ];
        setTimeout(() => reveal(idx, res.reply), 0);
        return next;
      });
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: "I can't reach the analysis core right now — confirm the backend on port 8000 is running.",
          error: true,
          done: true,
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  const live = aiStatus?.ai_configured;

  return (
    <>
      {/* Floating launcher — arc-reactor style */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Open ASTRA assistant"
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-base-900 border border-accent-400/50 shadow-reactor flex items-center justify-center group"
      >
        <span className="absolute inset-0 rounded-full reactor-ring animate-reactor-spin opacity-70" />
        <span className="absolute inset-[3px] rounded-full bg-base-900" />
        <Sparkles size={20} className="text-accent-400 relative group-hover:scale-110 transition-transform" />
      </button>

      {open && (
        <div
          ref={panelRef}
          className="fixed bottom-24 right-6 z-40 w-[380px] max-w-[calc(100vw-2rem)] h-[540px] max-h-[calc(100vh-8rem)] panel hud-corners shadow-panel flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-base-800/60">
            <div className="flex items-center gap-2.5">
              <div className="relative w-7 h-7 rounded-full bg-accent-500/15 border border-accent-400/40 flex items-center justify-center">
                <Radio size={13} className="text-accent-400" />
              </div>
              <div>
                <div className="text-sm font-semibold holo-text leading-none">ASTRA</div>
                <div className="text-[10px] text-slate-500 mt-0.5 font-mono uppercase tracking-wider flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${live ? "bg-good pulse-dot" : "bg-slate-600"}`} />
                  {aiStatus === null ? "connecting…" : live ? "live AI · grounded data" : "offline mode · grounded data"}
                </div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-slate-300">
              <X size={16} />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.map((m, i) => (
              <MessageBubble key={i} msg={m} />
            ))}
            {busy && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono pl-1">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-400 animate-pulse" />
                <span className="w-1.5 h-1.5 rounded-full bg-accent-400 animate-pulse [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-accent-400 animate-pulse [animation-delay:300ms]" />
                thinking
              </div>
            )}
          </div>

          {/* Suggestions */}
          {messages.length <= 1 && (
            <div className="px-4 pb-2 flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-[11px] px-2.5 py-1 rounded-full border border-accent-500/25 text-accent-400 bg-accent-500/5 hover:bg-accent-500/15 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex items-center gap-2 px-3 py-3 border-t border-white/5 bg-base-800/40"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Say hi, or ask about a route, forecast, anomalies…"
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-accent-400/50"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="w-9 h-9 shrink-0 rounded-lg bg-accent-500/15 border border-accent-500/30 text-accent-400 flex items-center justify-center hover:bg-accent-500/25 disabled:opacity-40 transition-colors"
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}

function MessageBubble({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
          isUser
            ? "bg-accent-500/15 border border-accent-500/25 text-slate-100"
            : msg.error
            ? "bg-bad/10 border border-bad/25 text-slate-300"
            : "bg-white/5 border border-white/10 text-slate-300"
        }`}
      >
        {msg.text}
        {!isUser && !msg.done && (
          <span className="inline-block w-[6px] h-[13px] bg-accent-400/70 ml-0.5 align-middle animate-pulse" />
        )}
        {msg.done && msg.data && <DataChip intent={msg.intent} data={msg.data} />}
      </div>
    </div>
  );
}

function DataChip({ intent, data }) {
  if (!data) return null;
  const rows = [];
  if (intent === "route_status") {
    rows.push(["Fare", `₹${data.current?.toLocaleString("en-IN")}`]);
    rows.push(["Change", `${data.change_pct >= 0 ? "+" : ""}${data.change_pct}%`]);
    rows.push(["Volatility", `${data.volatility}%`]);
  } else if (intent === "index") {
    rows.push(["Index", data.current_index]);
    rows.push(["WoW", `${data.wow_change_pct >= 0 ? "+" : ""}${data.wow_change_pct}%`]);
  } else if (intent === "forecast" && data.forecast?.forecast?.length) {
    const last = data.forecast.forecast[data.forecast.forecast.length - 1];
    rows.push(["14d projection", `₹${last.expected?.toLocaleString("en-IN")}`]);
    rows.push(["Range", `₹${last.lower?.toLocaleString("en-IN")}–₹${last.upper?.toLocaleString("en-IN")}`]);
  } else if (intent === "cpi") {
    rows.push(["MoM", `${data.mom_change_pct}%`]);
    rows.push(["Pressure", `${data.estimated_transport_subgroup_pressure_pp}pp`]);
  }
  if (!rows.length) return null;
  return (
    <div className="mt-2 pt-2 border-t border-white/10 grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[11px]">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-2">
          <span className="text-slate-500">{k}</span>
          <span className="text-accent-400">{v}</span>
        </div>
      ))}
    </div>
  );
}
