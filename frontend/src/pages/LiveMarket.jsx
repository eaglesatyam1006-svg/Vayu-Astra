import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { api } from "../api";
import { useApi } from "../useApi";
import PageHeader from "../components/PageHeader";
import { LoadingState, ErrorState } from "../components/States";

export default function LiveMarket() {
  const { data, loading, error } = useApi(() => api.routes(), [], { pollMs: 8000 });
  const [secondsAgo, setSecondsAgo] = useState(0);
  const tableRef = useRef(null);

  useEffect(() => {
    const t = setInterval(() => setSecondsAgo((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    setSecondsAgo(0);
  }, [data]);

  useEffect(() => {
    if (!loading && !error && tableRef.current) {
      gsap.fromTo(
        tableRef.current.querySelectorAll("tbody tr"),
        { opacity: 0, x: -8 },
        { opacity: 1, x: 0, duration: 0.35, stagger: 0.03, ease: "power2.out" }
      );
    }
  }, [loading, error, data]);

  if (loading) return <LoadingState label="Connecting to live market feed..." />;
  if (error) return <ErrorState message={error} />;

  const sorted = [...data.routes].sort((a, b) => Math.abs(b.change_pct) - Math.abs(a.change_pct));

  return (
    <div>
      <PageHeader
        title="Live Airfare Market"
        subtitle={`Last updated ${secondsAgo === 0 ? "just now" : `${secondsAgo}s ago`} · refreshes every 8s`}
      />

      <div className="panel hud-corners shadow-panel overflow-hidden">
        <table ref={tableRef} className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5 text-left text-xs uppercase tracking-wider text-slate-500">
              <th className="px-5 py-3 font-medium">Route</th>
              <th className="px-5 py-3 font-medium">Current Fare</th>
              <th className="px-5 py-3 font-medium">24h Change</th>
              <th className="px-5 py-3 font-medium">Volatility</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const highVol = r.volatility > 12;
              return (
                <tr
                  key={`${r.origin}-${r.destination}`}
                  className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors"
                >
                  <td className="px-5 py-3.5">
                    <div className="font-medium text-slate-200">
                      {r.origin} → {r.destination}
                    </div>
                    <div className="text-xs text-slate-500">
                      {r.origin_city} to {r.destination_city}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 tabular-nums text-slate-300">
                    ₹{r.current_fare.toLocaleString("en-IN")}
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`tabular-nums font-medium ${r.change_pct >= 0 ? "text-good" : "text-bad"}`}
                    >
                      {r.change_pct >= 0 ? "▲" : "▼"} {Math.abs(r.change_pct).toFixed(2)}%
                    </span>
                  </td>
                  <td className="px-5 py-3.5 tabular-nums text-slate-400">{r.volatility.toFixed(2)}%</td>
                  <td className="px-5 py-3.5">
                    {highVol ? (
                      <span className="text-[11px] px-2 py-1 rounded-full bg-warn/10 text-warn border border-warn/30">
                        High Volatility
                      </span>
                    ) : (
                      <span className="text-[11px] px-2 py-1 rounded-full bg-good/10 text-good border border-good/30">
                        Stable
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
