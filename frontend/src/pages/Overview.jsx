import { useEffect, useRef } from "react";
import gsap from "gsap";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { TrendingUp, DollarSign, Map as MapIcon, Activity, AlertTriangle, Wifi } from "lucide-react";
import { api } from "../api";
import { useApi } from "../useApi";
import KpiCard from "../components/KpiCard";
import PageHeader from "../components/PageHeader";
import { LoadingState, ErrorState } from "../components/States";
import FlightNetwork3D from "../components/FlightNetwork3D";

export default function Overview() {
  const { data: index, loading: l1, error: e1 } = useApi(() => api.index(), [], { pollMs: 15000 });
  const { data: routesData, loading: l2, error: e2 } = useApi(() => api.routes(), []);
  const { data: anomaliesData, loading: l3, error: e3 } = useApi(() => api.anomalies(), []);
  const { data: health, loading: l4, error: e4 } = useApi(() => api.health(), [], { pollMs: 10000 });

  const panelRef = useRef(null);

  const loading = l1 || l2 || l3 || l4;
  const error = e1 || e2 || e3 || e4;

  useEffect(() => {
    if (!loading && !error && panelRef.current) {
      gsap.fromTo(
        panelRef.current.children,
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 0.5, stagger: 0.06, ease: "power2.out" }
      );
    }
  }, [loading, error]);

  if (loading) return <LoadingState label="Loading market intelligence..." />;
  if (error) return <ErrorState message={error} />;

  const avgFare =
    routesData.routes.reduce((sum, r) => sum + r.current_fare, 0) / (routesData.routes.length || 1);
  const avgChange =
    routesData.routes.reduce((sum, r) => sum + r.change_pct, 0) / (routesData.routes.length || 1);
  const avgVolatility =
    routesData.routes.reduce((sum, r) => sum + r.volatility, 0) / (routesData.routes.length || 1);

  const topAnomalies = anomaliesData.anomalies.slice(0, 5);
  const topRoutes = [...routesData.routes].sort((a, b) => b.change_pct - a.change_pct).slice(0, 5);

  return (
    <div>
      <PageHeader title="Vayu Astra Overview" subtitle="Real-time Indian domestic airfare price intelligence" />

      <div ref={panelRef} className="space-y-6">
        {/* 3D live flight-network hero */}
        <div className="panel hud-corners shadow-panel relative overflow-hidden h-[280px] md:h-[340px]">
          <FlightNetwork3D className="absolute inset-0" />
          <div className="scanline-overlay" />
          <div className="absolute top-5 left-6 pointer-events-none">
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-accent-400/80 mb-1">
              Live network · {routesData.count} routes tracked
            </div>
            <div className="text-2xl md:text-3xl font-semibold text-gradient">National Airfare Grid</div>
          </div>
          <div className="absolute bottom-4 right-6 text-[10px] font-mono text-slate-500 pointer-events-none">
            move to explore
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <KpiCard
            label="Vayu Astra Index"
            value={index.current_index}
            format={(v) => v.toFixed(2)}
            changePct={index.change_1d_pct}
            icon={TrendingUp}
          />
          <KpiCard
            label="Avg Fare"
            value={avgFare}
            format={(v) => `₹${Math.round(v).toLocaleString("en-IN")}`}
            changePct={avgChange}
            icon={DollarSign}
            accent="good"
          />
          <KpiCard
            label="Routes Tracked"
            value={routesData.count}
            format={(v) => Math.round(v).toString()}
            icon={MapIcon}
          />
          <KpiCard
            label="Volatility"
            value={avgVolatility}
            format={(v) => `${v.toFixed(2)}%`}
            icon={Activity}
            accent="warn"
          />
          <KpiCard
            label="Anomalies"
            value={anomaliesData.count}
            format={(v) => Math.round(v).toString()}
            suffix={`${anomaliesData.critical_count} critical`}
            icon={AlertTriangle}
            accent="bad"
          />
          <KpiCard
            label="Data Freshness"
            value={health.records_in_db}
            format={(v) => Math.round(v).toLocaleString("en-IN")}
            suffix="records"
            icon={Wifi}
            accent="good"
          />
        </div>

        {/* Main trend chart */}
        <div className="panel hud-corners shadow-panel p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-medium text-sm text-slate-300">Vayu Astra Trend — 90 Day Index</h2>
            <span className="text-xs text-slate-500">Base 100 = start of period</span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={index.series}>
              <defs>
                <linearGradient id="indexGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a2235" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="#475569"
                fontSize={11}
                tickFormatter={(d) => d.slice(5)}
                minTickGap={40}
              />
              <YAxis stroke="#475569" fontSize={11} domain={["auto", "auto"]} />
              <Tooltip
                contentStyle={{
                  background: "#111726",
                  border: "1px solid #243049",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: "#94a3b8" }}
              />
              <Line type="monotone" dataKey="index" stroke="#38bdf8" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Two-column: top movers + anomaly radar */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="panel shadow-panel p-6 glass-hover">
            <h2 className="font-medium text-sm text-slate-300 mb-4">Route Intelligence — Top Movers</h2>
            <div className="space-y-3">
              {topRoutes.map((r) => (
                <div key={`${r.origin}-${r.destination}`} className="flex items-center justify-between text-sm">
                  <span className="text-slate-300">
                    {r.origin} → {r.destination}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="tabular-nums text-slate-400">
                      ₹{r.current_fare.toLocaleString("en-IN")}
                    </span>
                    <span className={`tabular-nums font-medium ${r.change_pct >= 0 ? "text-good" : "text-bad"}`}>
                      {r.change_pct >= 0 ? "▲" : "▼"} {Math.abs(r.change_pct).toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel shadow-panel p-6 glass-hover">
            <h2 className="font-medium text-sm text-slate-300 mb-4">Anomaly Radar</h2>
            <div className="space-y-3">
              {topAnomalies.length === 0 && (
                <p className="text-sm text-slate-500">No anomalies detected in current window.</p>
              )}
              {topAnomalies.map((a, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        a.severity === "critical" ? "bg-bad" : "bg-warn"
                      }`}
                    />
                    <span className="text-slate-300">{a.route}</span>
                  </div>
                  <span className={`tabular-nums font-medium ${a.deviation_pct >= 0 ? "text-bad" : "text-warn"}`}>
                    {a.deviation_pct >= 0 ? "+" : ""}
                    {a.deviation_pct.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
