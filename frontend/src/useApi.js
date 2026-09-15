import { useEffect, useRef, useState } from "react";

/**
 * Fetches data from a fetcher fn, with loading/error state and optional polling.
 * Never lets an unhandled rejection surface to the UI as a blank crash —
 * failures resolve into a clear error state that pages render gracefully.
 */
export function useApi(fetcher, deps = [], { pollMs = 0 } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    let interval;

    async function load(isPoll) {
      if (!isPoll) setLoading(true);
      try {
        const result = await fetcher();
        if (mounted.current) {
          setData(result);
          setError(null);
        }
      } catch (err) {
        if (mounted.current) setError(err.message || "Failed to load data");
      } finally {
        if (mounted.current && !isPoll) setLoading(false);
      }
    }

    load(false);
    if (pollMs > 0) {
      interval = setInterval(() => load(true), pollMs);
    }

    return () => {
      mounted.current = false;
      if (interval) clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error };
}
