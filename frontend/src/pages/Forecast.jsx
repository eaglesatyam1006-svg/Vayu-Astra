import { useEffect, useState } from "react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { api } from "../api";
import { useApi } from "../useApi";
import PageHeader from "../components/PageHeader";
import { LoadingState, ErrorState } from "../components/States";

export default function Forecast() {
  const { data: routesData, loading: l1, error: e1 } = useApi(() => api.routes(), []);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (routesData && !selected) setSelected(routesData.routes[0]);
  }, [routesData, selected]);

  const {
    data: fc,
    loading: l2,
    error: e2,
  } = useApi(
    () => (selected ? api.forecast(selected.origin, selected.destination, 30) : Promise.resolve(null)),
    [selected?.origin, selected?.destination]
  );

  const { data: ml, loading: l3 } = useApi(
    () => (selected ? api.forecastMl(selected.origin, selected.destination, 30) : Promise.resolve(null)),
    [selected?.origin, selected?.destination]
  );

  if (l1) return <LoadingState label="Loading routes..." />;
  if (e1) return <ErrorState message={e1} />;

  const chartData = fc
    ? fc.forecast.map((p) => ({ date: p.date, expected: p.expected, band: [p.lower, p.upper] }))
    : [];

  return (
    <div>
      <PageHeader title="Fare Forecasting" subtitle="30-day projection via exponential smoothing with confidence bands" />

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

      {l2 && <LoadingState label="Generating forecast..." />}
      {e2 && <ErrorState message={e2} />}

      {fc && !l2 && !e2 && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="panel shadow-panel p-4">
              <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">Current</div>
              <div className="text-lg font-semibold tabular-nums">
                ₹{fc.current.toLocaleString("en-IN")}
              </div>
            </div>
            <div className="panel shadow-panel p-4">
              <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">
                Expected (Day 30)
              </div>
              <div className="text-lg font-semibold tabular-nums text-accent-400">
                ₹{fc.forecast[fc.forecast.length - 1].expected.toLocaleString("en-IN")}
              </div>
            </div>
            <div className="panel shadow-panel p-4">
              <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">Confidence Range</div>
              <div className="text-sm font-medium tabular-nums text-slate-300">
                ₹{fc.forecast[fc.forecast.length - 1].lower.toLocaleString("en-IN")} — ₹
                {fc.forecast[fc.forecast.length - 1].upper.toLocaleString("en-IN")}
              </div>
            </div>
          </div>

          <div className="panel shadow-panel p-6">
            <h2 className="font-medium text-sm text-slate-300 mb-4">
              {fc.route} — 30 Day Forecast
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2235" vertical={false} />
                <XAxis dataKey="date" stroke="#475569" fontSize={11} tickFormatter={(d) => d.slice(5)} minTickGap={40} />
                <YAxis stroke="#475569" fontSize={11} domain={["auto", "auto"]} />
                <Tooltip
                  contentStyle={{ background: "#111726", border: "1px solid #243049", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "#94a3b8" }}
                  formatter={(v, name) =>
                    name === "band"
                      ? [`₹${v[0].toLocaleString("en-IN")} — ₹${v[1].toLocaleString("en-IN")}`, "Confidence"]
                      : [`₹${v.toLocaleString("en-IN")}`, "Expected"]
                  }
                />
                <Area type="monotone" dataKey="band" stroke="none" fill="#38bdf8" fillOpacity={0.12} />
                <Line type="monotone" dataKey="expected" stroke="#38bdf8" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="panel shadow-panel p-6">
            <h2 className="font-medium text-sm text-slate-300 mb-1">Why is the model expecting this?</h2>
            <p className="text-xs text-slate-500 mb-4">{fc.note}</p>
            <div className="space-y-2">
              {fc.explainability.map((d, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-slate-300">{d.label}</span>
                  <span
                    className={`tabular-nums font-medium ${
                      d.contribution_pct >= 0 ? "text-good" : "text-bad"
                    }`}
                  >
                    {d.contribution_pct >= 0 ? "+" : ""}
                    {d.contribution_pct.toFixed(2)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="panel hud-corners shadow-panel p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-medium text-sm text-slate-300">Trained ML Model</h2>
              {ml?.available && (
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-gold-400/10 border border-gold-400/30 gold-text">
                  {ml.model}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mb-4">
              A gradient-boosted regression model trained fresh on this route's history at request time — distinct
              from the statistical baseline above. Accuracy below is measured on a held-out slice never seen during
              training.
            </p>

            {l3 && <div className="text-xs text-slate-600 font-mono py-4">Training model on live data…</div>}

            {ml && !l3 && !ml.available && (
              <div className="text-xs text-slate-500 py-2">{ml.reason}</div>
            )}

            {ml?.available && (
              <div className="space-y-4">
                <div className="grid grid-cols-4 gap-3">
                  <MlStat label="Test MAE" value={`₹${ml.metrics.test_mae.toLocaleString("en-IN")}`} />
                  <MlStat
                    label="Test R²"
                    value={ml.metrics.test_r2 != null ? ml.metrics.test_r2.toFixed(3) : "—"}
                  />
                  <MlStat label="Train size" value={ml.metrics.train_size} />
                  <MlStat label="Test size" value={ml.metrics.test_size} />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">Feature importance</div>
                  <div className="space-y-1.5">
                    {Object.entries(ml.feature_importances).map(([name, imp]) => (
                      <div key={name} className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-400 w-28 shrink-0 font-mono">{name}</span>
                        <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                          <div
                            className="h-full bg-gold-400/70 rounded-full"
                            style={{ width: `${Math.min(100, imp * 100)}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-slate-500 font-mono w-10 text-right">
                          {(imp * 100).toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-[11px] text-slate-600">{ml.note}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MlStat({ label, value }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">{label}</div>
      <div className="text-sm font-semibold tabular-nums text-slate-200">{value}</div>
    </div>
  );
}
