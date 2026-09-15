import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { api } from "../api";
import { useApi } from "../useApi";
import PageHeader from "../components/PageHeader";
import { LoadingState, ErrorState } from "../components/States";

export default function RouteIntelligence() {
  const { data: routesData, loading: l1, error: e1 } = useApi(() => api.routes(), []);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (routesData && !selected) {
      setSelected(routesData.routes[0]);
    }
  }, [routesData, selected]);

  const {
    data: detail,
    loading: l2,
    error: e2,
  } = useApi(
    () => (selected ? api.routeDetail(selected.origin, selected.destination) : Promise.resolve(null)),
    [selected?.origin, selected?.destination]
  );

  if (l1) return <LoadingState label="Loading routes..." />;
  if (e1) return <ErrorState message={e1} />;

  return (
    <div>
      <PageHeader title="Route Intelligence" subtitle="Deep dive into a specific route's pricing behaviour" />

      <div className="flex flex-wrap gap-2 mb-6">
        {routesData.routes.map((r) => (
          <button
            key={`${r.origin}-${r.destination}`}
            onClick={() => setSelected(r)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              selected && selected.origin === r.origin && selected.destination === r.destination
                ? "bg-accent-500/15 text-accent-400 border-accent-500/30"
                : "text-slate-400 border-white/10 hover:bg-white/5"
            }`}
          >
            {r.origin} → {r.destination}
          </button>
        ))}
      </div>

      {l2 && <LoadingState label="Loading route detail..." />}
      {e2 && <ErrorState message={e2} />}

      {detail && !l2 && !e2 && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              ["Current", `₹${detail.current_fare.toLocaleString("en-IN")}`],
              ["30-Day Avg", `₹${detail.avg_30d.toLocaleString("en-IN")}`],
              ["Minimum", `₹${detail.min_fare.toLocaleString("en-IN")}`],
              ["Maximum", `₹${detail.max_fare.toLocaleString("en-IN")}`],
              ["Volatility", `${detail.volatility_pct.toFixed(2)}%`],
            ].map(([label, value]) => (
              <div key={label} className="panel shadow-panel p-4">
                <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">{label}</div>
                <div className="text-lg font-semibold tabular-nums">{value}</div>
              </div>
            ))}
          </div>

          <div className="panel hud-corners shadow-panel p-6">
            <h2 className="font-medium text-sm text-slate-300 mb-4">
              {detail.route} — 90 Day Fare History
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={detail.history}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2235" vertical={false} />
                <XAxis dataKey="date" stroke="#475569" fontSize={11} tickFormatter={(d) => d.slice(5)} minTickGap={40} />
                <YAxis stroke="#475569" fontSize={11} domain={["auto", "auto"]} />
                <Tooltip
                  contentStyle={{ background: "#111726", border: "1px solid #243049", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "#94a3b8" }}
                  formatter={(v) => [`₹${v.toLocaleString("en-IN")}`, "Fare"]}
                />
                <Line type="monotone" dataKey="fare" stroke="#22c55e" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
