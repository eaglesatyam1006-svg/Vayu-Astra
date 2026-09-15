import { Loader2, AlertCircle } from "lucide-react";

export function LoadingState({ label = "Loading data..." }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-slate-500 gap-3">
      <Loader2 className="animate-spin text-accent-400" size={28} />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-slate-500 gap-3">
      <AlertCircle className="text-bad" size={28} />
      <span className="text-sm text-center max-w-md">
        Couldn't reach the backend. Make sure the API server is running on port 8000.
      </span>
      {message && <span className="text-xs text-slate-600 font-mono">{message}</span>}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 px-4 py-1.5 rounded-lg bg-accent-500/15 text-accent-400 text-xs border border-accent-500/30 hover:bg-accent-500/25 transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  );
}

export function SkeletonBlock({ className = "" }) {
  return <div className={`animate-pulse bg-white/5 rounded-lg ${className}`} />;
}
