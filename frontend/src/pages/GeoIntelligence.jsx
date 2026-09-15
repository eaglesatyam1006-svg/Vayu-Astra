import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { MapPin } from "lucide-react";
import { api } from "../api";
import { useApi } from "../useApi";
import PageHeader from "../components/PageHeader";
import { LoadingState, ErrorState } from "../components/States";

const WIDTH = 640;
const HEIGHT = 460;
const PADDING = 56;

function buildProjection(airports) {
  const lats = airports.map((a) => a.lat);
  const lons = airports.map((a) => a.lon);
  const minLat = Math.min(...lats) - 1.5;
  const maxLat = Math.max(...lats) + 1.5;
  const minLon = Math.min(...lons) - 1.5;
  const maxLon = Math.max(...lons) + 1.5;

  return (lat, lon) => {
    const x = PADDING + ((lon - minLon) / (maxLon - minLon)) * (WIDTH - PADDING * 2);
    const y = HEIGHT - PADDING - ((lat - minLat) / (maxLat - minLat)) * (HEIGHT - PADDING * 2);
    return { x, y };
  };
}

export default function GeoIntelligence() {
  const { data, loading, error } = useApi(() => api.geoRoutes(), [], { pollMs: 20000 });
  const [selectedCity, setSelectedCity] = useState(null);
  const svgRef = useRef(null);

  useEffect(() => {
    if (!loading && !error && svgRef.current) {
      gsap.fromTo(
        svgRef.current.querySelectorAll(".geo-fade"),
        { opacity: 0 },
        { opacity: 1, duration: 0.8, stagger: 0.015, ease: "power1.out" }
      );
    }
  }, [loading, error]);

  const project = useMemo(() => (data ? buildProjection(data.airports) : null), [data]);

  if (loading) return <LoadingState label="Loading geographic intelligence..." />;
  if (error) return <ErrorState message={error} />;

  const { airports, routes } = data;

  const cityStats = (code) => {
    const related = routes.filter((r) => r.origin === code || r.destination === code);
    if (related.length === 0) return null;
    const avgFare = related.reduce((s, r) => s + r.current_fare, 0) / related.length;
    const avgChange = related.reduce((s, r) => s + r.change_pct, 0) / related.length;
    const avgVol = related.reduce((s, r) => s + r.volatility, 0) / related.length;
    return { routeCount: related.length, avgFare, avgChange, avgVol };
  };

  const activeStats = selectedCity ? cityStats(selectedCity.code) : null;

  return (
    <div>
      <PageHeader title="Geographic Intelligence" subtitle="Route network across tracked Indian airports" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 panel hud-corners shadow-panel p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-medium text-sm text-slate-300">India Airfare Map</h2>
            <span className="text-xs text-slate-500">Click a city for route stats</span>
          </div>
          <svg ref={svgRef} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-auto">
            {routes.map((r) => {
              const o = project(r.origin_coords.lat, r.origin_coords.lon);
              const d = project(r.destination_coords.lat, r.destination_coords.lon);
              const stroke = r.change_pct >= 3 ? "#ef4444" : r.change_pct <= -1 ? "#22c55e" : "#243049";
              const highlighted =
                selectedCity && (r.origin === selectedCity.code || r.destination === selectedCity.code);
              return (
                <line
                  key={`${r.origin}-${r.destination}`}
                  className="geo-fade"
                  x1={o.x}
                  y1={o.y}
                  x2={d.x}
                  y2={d.y}
                  stroke={stroke}
                  strokeWidth={highlighted ? 2.5 : 1.2}
                  strokeOpacity={highlighted ? 0.9 : selectedCity ? 0.15 : 0.5}
                />
              );
            })}
            {airports.map((a) => {
              const { x, y } = project(a.lat, a.lon);
              const isSelected = selectedCity?.code === a.code;
              return (
                <g
                  key={a.code}
                  className="geo-fade cursor-pointer"
                  onClick={() => setSelectedCity(isSelected ? null : a)}
                >
                  <circle
                    cx={x}
                    cy={y}
                    r={isSelected ? 9 : 6}
                    fill={isSelected ? "#38bdf8" : "#0ea5e9"}
                    fillOpacity={isSelected ? 1 : 0.85}
                    stroke="#05070d"
                    strokeWidth={2}
                  />
                  <text x={x} y={y - 14} textAnchor="middle" fontSize="11" fill="#94a3b8" fontFamily="monospace">
                    {a.code}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="panel shadow-panel p-6">
          <h2 className="font-medium text-sm text-slate-300 mb-4 flex items-center gap-2">
            <MapPin size={15} className="text-accent-400" />
            {selectedCity ? `${selectedCity.city} (${selectedCity.code})` : "Select an airport"}
          </h2>

          {!selectedCity && (
            <p className="text-sm text-slate-500">
              Click any marker on the map to see routes, average fare, and volatility for that airport.
            </p>
          )}

          {selectedCity && activeStats && (
            <div className="space-y-4">
              {[
                ["Routes", activeStats.routeCount],
                ["Average Fare", `₹${Math.round(activeStats.avgFare).toLocaleString("en-IN")}`],
                ["Average Change", `${activeStats.avgChange >= 0 ? "▲" : "▼"} ${Math.abs(activeStats.avgChange).toFixed(1)}%`],
                ["Average Volatility", `${activeStats.avgVol.toFixed(2)}%`],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between text-sm border-b border-white/5 pb-3">
                  <span className="text-slate-500">{label}</span>
                  <span className="font-medium tabular-nums text-slate-200">{value}</span>
                </div>
              ))}

              <div className="pt-2">
                <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">Connected routes</div>
                <div className="space-y-2">
                  {routes
                    .filter((r) => r.origin === selectedCity.code || r.destination === selectedCity.code)
                    .map((r) => (
                      <div key={`${r.origin}-${r.destination}`} className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">
                          {r.origin} → {r.destination}
                        </span>
                        <span className={r.change_pct >= 0 ? "text-good" : "text-bad"}>
                          {r.change_pct >= 0 ? "▲" : "▼"} {Math.abs(r.change_pct).toFixed(1)}%
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
