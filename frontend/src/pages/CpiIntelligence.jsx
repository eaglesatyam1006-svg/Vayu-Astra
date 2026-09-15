import { useEffect, useRef } from "react";
import gsap from "gsap";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Landmark, Info } from "lucide-react";
import { api } from "../api";
import { useApi } from "../useApi";
import KpiCard from "../components/KpiCard";
import PageHeader from "../components/PageHeader";
import { LoadingState, ErrorState } from "../components/States";

export default function CpiIntelligence() {
  const { data, loading, error } = useApi(() => api.cpiImpact(), [], { pollMs: 20000 });
  const panelRef = useRef(null);

  useEffect(() => {
    if (!loading && !error && panelRef.current) {
      gsap.fromTo(
        panelRef.current.children,
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 0.5, stagger: 0.06, ease: "power2.out" }
      );
    }
  }, [loading, error]);

  if (loading) return <LoadingState label="Loading CPI intelligence..." />;
  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <PageHeader title="Transport CPI Intelligence" subtitle="Connecting airfare trends to India's Transport & Communication CPI sub-group" />

      <div ref={panelRef} className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <KpiCard
            label="Airfare Vayu Astra Index"
            value={data.airfare_vayu-astra_index}
            format={(v) => v.toFixed(2)}
            icon={Landmark}
          />
          <KpiCard
            label="WoW Change"
            value={data.wow_change_pct}
            format={(v) => `${v.toFixed(2)}%`}
            changePct={data.wow_change_pct}
          />
          <KpiCard
            label="MoM Change"
            value={data.mom_change_pct}
            format={(v) => `${v.toFixed(2)}%`}
            changePct={data.mom_change_pct}
          />
          <KpiCard
            label="Simulated YoY"
            value={data.simulated_yoy_change_pct}
            format={(v) => `${v.toFixed(2)}%`}
            changePct={data.simulated_yoy_change_pct}
            accent="warn"
          />
          <KpiCard
            label="Sub-group Pressure"
            value={Math.abs(data.estimated_transport_subgroup_pressure_pp)}
            format={(v) => `${data.estimated_transport_subgroup_pressure_pp >= 0 ? "+" : "-"}${v.toFixed(4)} pp`}
            suffix="est."
            accent="bad"
          />
        </div>

        <div className="panel hud-corners shadow-panel p-4 flex items-start gap-3 border-gold-400/20">
          <Info size={16} className="text-gold-400 shrink-0 mt-0.5" />
          <p className="text-xs text-slate-400 leading-relaxed">
            <span className="gold-text font-medium">Simulation, not an official statistic.</span>{" "}
            {data.note} Assumed air-travel weight within the Transport & Communication sub-group:{" "}
            <span className="text-slate-300 font-medium">{data.assumed_air_travel_cpi_weight_pct}%</span>.
          </p>
        </div>

        <div className="panel shadow-panel p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-medium text-sm text-slate-300">Vayu Astra Index — 90 Day Series (CPI Input)</h2>
            <span className="text-xs text-slate-500">Base 100 = start of period</span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data.series}>
              <defs>
                <linearGradient id="cpiGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a2235" vertical={false} />
              <XAxis dataKey="date" stroke="#475569" fontSize={11} tickFormatter={(d) => d.slice(5)} minTickGap={40} />
              <YAxis stroke="#475569" fontSize={11} domain={["auto", "auto"]} />
              <Tooltip
                contentStyle={{ background: "#111726", border: "1px solid #243049", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "#94a3b8" }}
              />
              <Area type="monotone" dataKey="index" stroke="#f59e0b" strokeWidth={2} fill="url(#cpiGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
