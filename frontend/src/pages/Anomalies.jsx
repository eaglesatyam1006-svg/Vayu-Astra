import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { AlertTriangle } from "lucide-react";
import { api } from "../api";
import { useApi } from "../useApi";
import PageHeader from "../components/PageHeader";
import { LoadingState, ErrorState } from "../components/States";

export default function Anomalies() {
  const [threshold, setThreshold] = useState(2.0);
  const [method, setMethod] = useState("stat"); // "stat" | "ml"
  const { data, loading, error } = useApi(() => api.anomalies(threshold), [threshold]);
  const { data: mlData, loading: mlLoading, error: mlError } = useApi(() => api.anomaliesMl(0.07), []);
  const listRef = useRef(null);

  const active = method === "stat" ? data : mlData;
  const activeLoading = method === "stat" ? loading : mlLoading;
  const activeError = method === "stat" ? error : mlError;

  useEffect(() => {
    if (!activeLoading && !activeError && listRef.current) {
      gsap.fromTo(
        listRef.current.children,
        { opacity: 0, scale: 0.98 },
        { opacity: 1, scale: 1, duration: 0.4, stagger: 0.04, ease: "power2.out" }
      );
    }
  }, [activeLoading, activeError, threshold, method]);

  return (
    <div>
      <PageHeader
        title="Anomaly Detection"
        subtitle={
          method === "stat"
            ? "Statistical outliers flagged via rolling Z-score analysis"
            : "Unsupervised ML anomaly detection via IsolationForest (scikit-learn)"
        }
      />

      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-white/5 border border-white/10">
          <button
            onClick={() => setMethod("stat")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              method === "stat" ? "bg-accent-500/20 text-accent-400" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            Statistical (Z-score)
          </button>
          <button
            onClick={() => setMethod("ml")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              method === "ml" ? "bg-gold-400/15 gold-text" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            ML (IsolationForest)
          </button>
        </div>

        {method === "stat" && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">Sensitivity (Z-score threshold)</span>
            {[1.5, 2.0, 2.5, 3.0].map((t) => (
              <button
                key={t}
                onClick={() => setThreshold(t)}
                className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                  threshold === t
                    ? "bg-accent-500/15 text-accent-400 border-accent-500/30"
                    : "text-slate-400 border-white/10 hover:bg-white/5"
                }`}
              >
                {t.toFixed(1)}σ
              </button>
            ))}
          </div>
        )}
      </div>

      {activeLoading && <LoadingState label={method === "stat" ? "Scanning for anomalies..." : "Training IsolationForest on live data..."} />}
      {activeError && <ErrorState message={activeError} />}

      {active && !activeLoading && !activeError && (
        <>
          <div className="flex gap-4 mb-6">
            <div className="panel shadow-panel px-5 py-4">
              <div className="text-xs text-slate-500 uppercase tracking-wider">Total Flagged</div>
              <div className="text-xl font-semibold mt-1">{active.count}</div>
            </div>
            {method === "stat" ? (
              <div className="panel shadow-panel px-5 py-4">
                <div className="text-xs text-slate-500 uppercase tracking-wider">Critical</div>
                <div className="text-xl font-semibold mt-1 text-bad">{active.critical_count}</div>
              </div>
            ) : (
              <div className="panel hud-corners shadow-panel px-5 py-4">
                <div className="text-xs text-slate-500 uppercase tracking-wider">Model</div>
                <div className="text-sm font-semibold mt-1 gold-text">{active.model}</div>
              </div>
            )}
          </div>

          {method === "ml" && active.note && (
            <p className="text-[11px] text-slate-600 mb-4 -mt-2">{active.note}</p>
          )}

          <div ref={listRef} className="space-y-3">
            {active.anomalies.length === 0 && (
              <div className="panel shadow-panel p-8 text-center text-slate-500 text-sm">
                {method === "stat"
                  ? "No anomalies at this sensitivity level. Try lowering the threshold."
                  : "No anomalies flagged by the ML model at this contamination setting."}
              </div>
            )}
            {method === "stat"
              ? active.anomalies.map((a, i) => (
                  <div key={i} className="panel shadow-panel p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          a.severity === "critical" ? "bg-bad/10 text-bad" : "bg-warn/10 text-warn"
                        }`}
                      >
                        <AlertTriangle size={15} />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-200">
                          {a.origin_city} → {a.destination_city}
                          <span className="text-slate-500 font-normal ml-2">({a.route})</span>
                        </div>
                        <div className="text-xs text-slate-500">{a.date}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`text-sm font-semibold tabular-nums ${
                          a.deviation_pct >= 0 ? "text-bad" : "text-warn"
                        }`}
                      >
                        {a.deviation_pct >= 0 ? "+" : ""}
                        {a.deviation_pct.toFixed(1)}%
                      </div>
                      <div className="text-xs text-slate-500 tabular-nums">
                        ₹{a.fare.toLocaleString("en-IN")} vs ₹{a.expected.toLocaleString("en-IN")} expected
                      </div>
                    </div>
                  </div>
                ))
              : active.anomalies.map((a, i) => (
                  <div key={i} className="panel hud-corners shadow-panel p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gold-400/10 text-gold-400">
                        <AlertTriangle size={15} />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-200">
                          {a.origin_city} → {a.destination_city}
                          <span className="text-slate-500 font-normal ml-2">({a.route})</span>
                        </div>
                        <div className="text-xs text-slate-500">{a.date}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold tabular-nums gold-text">
                        score {a.anomaly_score.toFixed(2)}
                      </div>
                      <div className="text-xs text-slate-500 tabular-nums">
                        ₹{a.fare.toLocaleString("en-IN")} · Δ{a.day_over_day_change >= 0 ? "+" : ""}
                        {a.day_over_day_change.toLocaleString("en-IN")}
                      </div>
                    </div>
                  </div>
                ))}
          </div>
        </>
      )}
    </div>
  );
}
