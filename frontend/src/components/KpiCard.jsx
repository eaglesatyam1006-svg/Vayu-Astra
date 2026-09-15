import { useEffect, useRef } from "react";
import gsap from "gsap";

/**
 * KPI card with a GSAP count-up animation on the numeric value.
 * value: number to animate to
 * format: fn(number) -> display string (e.g. currency formatting)
 */
export default function KpiCard({ label, value, format, changePct, suffix = "", icon: Icon, accent = "accent" }) {
  const valueRef = useRef(null);

  useEffect(() => {
    if (value == null || !valueRef.current) return;
    const obj = { v: 0 };
    gsap.to(obj, {
      v: value,
      duration: 1.1,
      ease: "power2.out",
      onUpdate: () => {
        if (valueRef.current) {
          valueRef.current.textContent = format ? format(obj.v) : Math.round(obj.v).toLocaleString("en-IN");
        }
      },
    });
  }, [value, format]);

  const positive = changePct >= 0;
  const colorMap = {
    accent: "text-accent-400",
    good: "text-good",
    bad: "text-bad",
    warn: "text-warn",
    gold: "text-gold-400",
  };

  return (
    <div className="panel shadow-panel p-5 flex flex-col gap-2 min-w-0 glass-hover">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-slate-500">{label}</span>
        {Icon && <Icon size={15} className={colorMap[accent]} />}
      </div>
      <div className="flex items-baseline gap-2">
        <span ref={valueRef} className="text-2xl font-semibold tabular-nums">
          {value == null ? "—" : "0"}
        </span>
        {suffix && <span className="text-sm text-slate-500">{suffix}</span>}
      </div>
      {changePct !== undefined && changePct !== null && (
        <div className={`text-xs font-medium ${positive ? "text-good" : "text-bad"}`}>
          {positive ? "▲" : "▼"} {Math.abs(changePct).toFixed(2)}%
        </div>
      )}
    </div>
  );
}
