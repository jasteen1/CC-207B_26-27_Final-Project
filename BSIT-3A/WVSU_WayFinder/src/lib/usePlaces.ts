import { useCallback, useEffect, useRef, useState } from "react";
import type { DataResult } from "./types";

type State<T> =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "done"; result: DataResult<T> }
  | { state: "error" };

export type Async<T> = State<T> & {
  reload: () => void;
};

interface CacheEntry<T> {
  key: string;
  attempt: number;
  result: DataResult<T>;
}

/**
 * Fetches data when enabled.
 *
 * - Ignores stale responses.
 * - Supports manual retries.
 * - Keeps the last successful result cached.
 * - Does not fetch while disabled.
 * - Reuses cached data when re-enabled with the same key.
 *
 * The third parameter is optional and defaults to true,
 * preserving existing useAsync calls throughout the app.
 */
export function useAsync<T>(
  key: string,
  run: () => Promise<DataResult<T>>,
  enabled = true
): Async<T> {
  const [value, setValue] = useState<State<T>>(() =>
    enabled ? { state: "loading" } : { state: "idle" }
  );

  const [attempt, setAttempt] = useState(0);

  const cache = useRef<CacheEntry<T> | null>(null);

  const reload = useCallback(() => {
    setAttempt((current) => current + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    // Do not fetch while this resource is not needed.
    // Keep any successfully loaded data available.
    if (!enabled) {
      return () => {
        cancelled = true;
      };
    }

    // Reuse previously loaded data when possible.
    const cached = cache.current;

    if (cached?.key === key && cached.attempt === attempt) {
      setValue({
        state: "done",
        result: cached.result,
      });

      return () => {
        cancelled = true;
      };
    }

    setValue({ state: "loading" });

    Promise.resolve()
      .then(run)
      .then(
        (result) => {
          if (cancelled) return;

          cache.current = {
            key,
            attempt,
            result,
          };

          setValue({
            state: "done",
            result,
          });
        },
        () => {
          if (!cancelled) {
            setValue({ state: "error" });
          }
        }
      );

    return () => {
      cancelled = true;
    };

    // run is intentionally excluded because callers may pass
    // a new inline function on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt, enabled]);

  return {
    ...value,
    reload,
  };
}