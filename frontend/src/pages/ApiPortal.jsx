import { useEffect, useState } from "react";
import { Terminal, Key, Copy, Check, Play, Lock } from "lucide-react";
import { api } from "../api";
import { useApi } from "../useApi";
import PageHeader from "../components/PageHeader";
import { LoadingState, ErrorState } from "../components/States";

const TIERS = ["viewer", "developer", "analyst", "admin"];
const STORAGE_KEY = "vayu-astra_demo_api_key";

const METHOD_COLORS = {
  GET: "text-accent-400 bg-accent-500/10 border-accent-500/30",
  POST: "text-good bg-good/10 border-good/30",
};

export default function ApiPortal() {
  const { data, loading, error } = useApi(() => api.endpoints(), []);
  const [apiKey, setApiKey] = useState(null);
  const [keyName, setKeyName] = useState("");
  const [tier, setTier] = useState("developer");
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [active, setActive] = useState(null);
  const [trying, setTrying] = useState(false);
  const [result, setResult] = useState(null);

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

  async function generateKey() {
    if (!keyName.trim()) return;
    setGenerating(true);
    try {
      const created = await api.createApiKey(keyName.trim(), tier);
      setApiKey(created);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(created));
    } catch (err) {
      setResult({ status: "error", body: { detail: err.message } });
    } finally {
      setGenerating(false);
    }
  }

  function copyKey() {
    if (!apiKey) return;
    navigator.clipboard.writeText(apiKey.key);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function tryEndpoint(ep) {
    setActive(ep);
    setResult(null);
    if (ep.path.includes("{")) {
      setResult({ status: "info", body: { note: "This endpoint needs a path parameter — try it from /docs instead." } });
      return;
    }
    if (ep.path === "/v1/assistant/query") {
      setTrying(true);
      try {
        const res = await fetch(`/api${ep.path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: "market index" }),
        });
        const body = await res.json();
        setResult({ status: res.status, body });
      } catch (err) {
        setResult({ status: "error", body: { detail: err.message } });
      } finally {
        setTrying(false);
      }
      return;
    }
    if (ep.method !== "GET") {
      setResult({ status: "info", body: { note: "Use the key generator panel to POST /v1/auth/keys." } });
      return;
    }
    setTrying(true);
    try {
      const headers = {};
      if (ep.auth && apiKey) headers["X-API-Key"] = apiKey.key;
      const res = await fetch(`/api${ep.path}`, { headers });
      const body = await res.json();
      setResult({ status: res.status, body });
    } catch (err) {
      setResult({ status: "error", body: { detail: err.message } });
    } finally {
      setTrying(false);
    }
  }

  if (loading) return <LoadingState label="Loading API catalog..." />;
  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <PageHeader title="Vayu Astra Developer Portal" subtitle="Live REST API — try requests directly from the browser" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 panel hud-corners shadow-panel p-6">
          <div className="flex items-center gap-2 mb-4">
            <Terminal size={16} className="text-accent-400" />
            <h2 className="font-medium text-sm text-slate-300">Endpoints</h2>
            <span className="text-xs text-slate-500 ml-auto">Base: /api</span>
          </div>
          <div className="space-y-1.5">
            {data.endpoints.map((ep) => (
              <button
                key={`${ep.method}-${ep.path}`}
                onClick={() => tryEndpoint(ep)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left border transition-colors ${
                  active?.path === ep.path && active?.method === ep.method
                    ? "border-accent-500/30 bg-accent-500/5"
                    : "border-transparent hover:bg-white/5"
                }`}
              >
                <span
                  className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded border ${METHOD_COLORS[ep.method]}`}
                >
                  {ep.method}
                </span>
                <span className="font-mono text-xs text-slate-300 flex-1">{ep.path}</span>
                {ep.auth && <Lock size={12} className="text-warn shrink-0" />}
                <Play size={13} className="text-slate-600 shrink-0" />
              </button>
            ))}
          </div>

          {active && (
            <div className="mt-5 pt-5 border-t border-white/5">
              <div className="text-xs text-slate-500 mb-2">
                {active.method} {active.path} — {active.description}
              </div>
              {trying && <p className="text-xs text-slate-500">Running request...</p>}
              {result && (
                <pre className="bg-base-950 border border-white/5 rounded-lg p-4 text-[11px] font-mono text-slate-300 overflow-auto max-h-80">
                  {JSON.stringify(result.body, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="panel shadow-panel p-6">
            <div className="flex items-center gap-2 mb-4">
              <Key size={16} className="text-accent-400" />
              <h2 className="font-medium text-sm text-slate-300">Generate API Key</h2>
            </div>

            {!apiKey ? (
              <div className="space-y-3">
                <input
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  placeholder="Key name (e.g. demo, judge-review)"
                  className="w-full bg-base-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-accent-500/50"
                />
                <select
                  value={tier}
                  onChange={(e) => setTier(e.target.value)}
                  className="w-full bg-base-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-accent-500/50"
                >
                  {TIERS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <button
                  onClick={generateKey}
                  disabled={generating || !keyName.trim()}
                  className="w-full px-4 py-2 rounded-lg bg-accent-500/15 text-accent-400 text-sm font-medium border border-accent-500/30 hover:bg-accent-500/25 transition-colors disabled:opacity-40"
                >
                  {generating ? "Generating..." : "Generate Key"}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-xs text-slate-500">
                  {apiKey.name} · {apiKey.tier} tier · {apiKey.rate_limit_per_min} req/min
                </div>
                <div className="flex items-center gap-2 bg-base-950 border border-white/10 rounded-lg px-3 py-2">
                  <span className="font-mono text-xs text-slate-300 truncate flex-1">{apiKey.key}</span>
                  <button onClick={copyKey} className="shrink-0 text-slate-500 hover:text-accent-400">
                    {copied ? <Check size={14} className="text-good" /> : <Copy size={14} />}
                  </button>
                </div>
                <button
                  onClick={() => {
                    setApiKey(null);
                    localStorage.removeItem(STORAGE_KEY);
                  }}
                  className="text-xs text-slate-500 hover:text-slate-300"
                >
                  Generate a different key
                </button>
              </div>
            )}
          </div>

          <div className="panel shadow-panel p-6">
            <h2 className="font-medium text-sm text-slate-300 mb-3">Auth</h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Endpoints marked <Lock size={10} className="inline text-warn" /> require an{" "}
              <code className="text-slate-400">X-API-Key</code> header. Rate limits are enforced per tier and
              reset on a rolling 60-second window.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
