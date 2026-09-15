import { useEffect, useState } from "react";

export default function PageHeader({ title, subtitle }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight text-gradient">{title}</h1>
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-good/10 border border-good/30 text-good text-[10px] font-medium uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-good pulse-dot" />
            Live
          </span>
        </div>
        {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
      </div>
      <div className="text-right">
        <div className="text-xs text-slate-500 font-mono">{now.toLocaleTimeString("en-IN")}</div>
        <div className="text-[9px] text-gold-400/60 font-mono uppercase tracking-[0.15em] mt-0.5">
          Clearance: Public
        </div>
      </div>
    </div>
  );
}
