import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { Server, Database, Cpu, Activity, Zap, ShieldAlert, Sparkles } from "lucide-react";
import { api } from "../api";
import { useApi } from "../useApi";
import KpiCard from "../components/KpiCard";
import PageHeader from "../components/PageHeader";
import { LoadingState, ErrorState } from "../components/States";

const STORAGE_KEY = "vayu-astra_demo_api_key";

const SERVICE_ICONS = { api: Server, database: Database, analytics_engine: Cpu, ml_engine: Sparkles };

export default function SystemHealth() {
  const { data: health, loading: l1, error: e1 } = useApi(() => api.health(), [], { pollMs: 10000 });
  const { data: sources, loading: l2, error: e2 } = useApi(() => api.sources(), [], { pollMs: 15000 });
  const [apiKey, setApiKey] = useState(null);
  const [creatingKey, setCreatingKey] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setApiKey(JSON.parse(stored));
      } catch (_) {
        /* ignore corrupt storage */
      }
    }
  }, []);

  const {
    data: metrics,
    loading: l3,
    error: e3,
  } = useApi(() => (apiKey ? api.systemMetrics(apiKey.key) : Promise.resolve(null)), [apiKey?.key], {
    pollMs: apiKey ? 5000 : 0,
  });

  async function enableLiveMetrics() {
    setCreatingKey(true);
    try {
      const created = await api.createApiKey("System Health Dashboard", "admin");
      localStorage.setItem(STORAGE_KEY, JSON.stringify(created));
      setApiKey(created);
    } finally {
      setCreatingKey(false);
    }
  }

  const loading = l1 || l2;
  const error = e1 || e2;

  useEffect(() => {
    if (!loading && !error && panelRef.current) {
      gsap.fromTo(
        panelRef.current.children,
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 0.5, stagger: 0.06, ease: "power2.out" }
      );
    }
  }, [loading, error]);

  if (loading) return <LoadingState label="Loading system health..." />;
  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <PageHeader title="System Health" subtitle="Live platform status, request volume, and service checks" />

      <div ref={panelRef} className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="DB Records" value={health.records_in_db} format={(v) => Math.round(v).toLocaleString("en-IN")} icon={Database} accent="good" />
          <KpiCard label="Uptime" value={health.uptime_seconds} format={(v) => `${Math.round(v)}s`} icon={Zap} />
          <KpiCard label="Sources Tracked" value={sources.sources.length} format={(v) => Math.round(v).toString()} icon={Server} />
          <KpiCard
            label="Requests (60s)"
            value={metrics ? metrics.requests_last_min : 0}
            format={(v) => Math.round(v).toString()}
            icon={Activity}
            accent={apiKey ? "accent" : "warn"}
          />
        </div>

        <div className="panel shadow-panel p-6">
          <h2 className="font-medium text-sm text-slate-300 mb-4">Source Health</h2>
          <div className="space-y-2">
            {sources.sources.map((s) => (
              <div key={s.name} className="flex items-center justify-between text-sm py-2 border-b border-white/5 last:border-0">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-good pulse-dot" />
                  <span className="text-slate-300">{s.name}</span>
                </div>
                <div className="flex items-center gap-6 text-xs text-slate-500">
                  <span>{s.records.toLocaleString("en-IN")} records</span>
                  <span className="text-good">{s.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel hud-corners shadow-panel p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-medium text-sm text-slate-300">Live Request Metrics</h2>
            {apiKey && <span className="text-xs text-slate-500">Authenticated as {apiKey.name} ({apiKey.tier})</span>}
          </div>

          {!apiKey && (
            <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
              <ShieldAlert size={24} className="text-warn" />
              <p className="text-sm text-slate-500 max-w-sm">
                This panel is protected by API key auth — a real demonstration of the platform's auth layer,
                not a mock. Generate a demo key to see live requests/latency/error-rate.
              </p>
              <button
                onClick={enableLiveMetrics}
                disabled={creatingKey}
                className="px-4 py-2 rounded-lg bg-accent-500/15 text-accent-400 text-sm font-medium border border-accent-500/30 hover:bg-accent-500/25 transition-colors disabled:opacity-40"
              >
                {creatingKey ? "Generating key..." : "Generate demo key & unlock"}
              </button>
            </div>
          )}

          {apiKey && l3 && <p className="text-sm text-slate-500 py-6">Loading live metrics...</p>}
          {apiKey && e3 && <p className="text-sm text-bad py-6">Couldn't load metrics: {e3}</p>}

          {apiKey && metrics && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  ["Requests (total)", metrics.requests_total],
                  ["Avg Latency", `${metrics.avg_latency_ms} ms`],
                  ["Error Rate", `${metrics.error_rate_pct}%`],
                  ["Uptime", `${Math.round(metrics.uptime_seconds)}s`],
                ].map(([label, value]) => (
                  <div key={label} className="bg-base-950/60 border border-white/5 rounded-lg p-3">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">{label}</div>
                    <div className="text-sm font-semibold tabular-nums text-slate-200">{value}</div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(metrics.services).map(([key, status]) => {
                  const Icon = SERVICE_ICONS[key] || Server;
                  const healthy = status === "Healthy";
                  return (
                    <div key={key} className="flex items-center gap-2 bg-base-950/60 border border-white/5 rounded-lg p-3">
                      <Icon size={14} className={healthy ? "text-good" : "text-bad"} />
                      <div>
                        <div className="text-xs text-slate-300 capitalize">{key.replace(/_/g, " ")}</div>
                        <div className={`text-[10px] ${healthy ? "text-good" : "text-bad"}`}>{status}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
