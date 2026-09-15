import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Radio,
  Map,
  AlertTriangle,
  TrendingUp,
  Database,
  Plane,
  Globe,
  Landmark,
  Terminal,
  HeartPulse,
} from "lucide-react";

const NAV_ITEMS = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/live-market", label: "Live Market", icon: Radio },
  { to: "/routes", label: "Route Intelligence", icon: Map },
  { to: "/anomalies", label: "Anomalies", icon: AlertTriangle },
  { to: "/forecast", label: "Forecasting", icon: TrendingUp },
  { to: "/geo", label: "Geographic View", icon: Globe },
  { to: "/cpi", label: "CPI Intelligence", icon: Landmark },
  { to: "/data-quality", label: "Data Sources", icon: Database },
  { to: "/api-portal", label: "API Portal", icon: Terminal },
  { to: "/system-health", label: "System Health", icon: HeartPulse },
];

export default function Sidebar() {
  return (
    <aside className="w-64 shrink-0 h-screen sticky top-0 border-r border-white/5 bg-base-900/60 backdrop-blur-sm flex flex-col">
      <div className="flex items-center gap-2 px-6 py-6">
        <div className="relative w-9 h-9 rounded-lg bg-accent-500/15 border border-accent-500/30 flex items-center justify-center shadow-reactor">
          <span className="absolute inset-0 rounded-lg reactor-ring opacity-30 animate-reactor-spin" />
          <Plane size={18} className="text-accent-400 relative" />
        </div>
        <div>
          <div className="font-semibold tracking-tight text-lg leading-none holo-text">Vayu Astra</div>
          <div className="text-[10px] text-gold-400/80 mt-1 uppercase tracking-[0.15em] font-mono">
            National Airfare Intelligence Core
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-accent-500/10 text-accent-400 border border-accent-500/20"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent"
              }`
            }
          >
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-6 py-4 border-t border-white/5 text-[11px] text-slate-600">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-1.5 h-1.5 rounded-full bg-good pulse-dot" />
          <span className="text-slate-400">System operational</span>
        </div>
        <div className="font-mono text-[10px] text-slate-600">v2.0.0 · ASTRA AI-linked</div>
      </div>
    </aside>
  );
}
