import { Database, CheckCircle2 } from "lucide-react";
import { api } from "../api";
import { useApi } from "../useApi";
import PageHeader from "../components/PageHeader";
import { LoadingState, ErrorState } from "../components/States";

export default function DataQuality() {
  const { data: sources, loading: l1, error: e1 } = useApi(() => api.sources(), [], { pollMs: 15000 });
  const { data: health, loading: l2, error: e2 } = useApi(() => api.health(), [], { pollMs: 10000 });

  const loading = l1 || l2;
  const error = e1 || e2;

  if (loading) return <LoadingState label="Checking data sources..." />;
  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <PageHeader title="Data Sources & System Health" subtitle="Ingestion pipeline status and record integrity" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="panel shadow-panel p-4">
          <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">Records Ingested</div>
          <div className="text-lg font-semibold tabular-nums">
            {health.records_in_db.toLocaleString("en-IN")}
          </div>
        </div>
        <div className="panel shadow-panel p-4">
          <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">API Status</div>
          <div className="text-lg font-semibold text-good">Healthy</div>
        </div>
        <div className="panel shadow-panel p-4">
          <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">Uptime</div>
          <div className="text-lg font-semibold tabular-nums">{Math.round(health.uptime_seconds)}s</div>
        </div>
        <div className="panel shadow-panel p-4">
          <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">Active Sources</div>
          <div className="text-lg font-semibold tabular-nums">{sources.sources.length}</div>
        </div>
      </div>

      <div className="panel hud-corners shadow-panel overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2">
          <Database size={15} className="text-accent-400" />
          <h2 className="font-medium text-sm text-slate-300">Ingestion Sources</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5 text-left text-xs uppercase tracking-wider text-slate-500">
              <th className="px-5 py-3 font-medium">Source</th>
              <th className="px-5 py-3 font-medium">Records</th>
              <th className="px-5 py-3 font-medium">Last Update</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {sources.sources.map((s) => (
              <tr key={s.name} className="border-b border-white/5 last:border-0">
                <td className="px-5 py-3.5 font-medium text-slate-200">{s.name}</td>
                <td className="px-5 py-3.5 tabular-nums text-slate-400">
                  {s.records.toLocaleString("en-IN")}
                </td>
                <td className="px-5 py-3.5 text-xs text-slate-500">{s.last_update}</td>
                <td className="px-5 py-3.5">
                  <span className="inline-flex items-center gap-1.5 text-xs text-good">
                    <CheckCircle2 size={13} />
                    {s.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
