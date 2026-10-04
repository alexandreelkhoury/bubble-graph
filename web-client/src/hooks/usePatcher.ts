// Optimistic settings edits shared by the phone sheet (PH-03b) and the TV mock (TV-03).
import { useEffect, useRef, useState } from "preact/hooks";
import type { Settings, SettingsPatch } from "@mishana/shared/engine";

/** Order-insensitive deep equality for settings values (JSON-shaped). */
export function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => same((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

/** An in-flight patch is given up on after this long without a confirming state or an error. */
const INFLIGHT_MS = 5000;

/**
 * Optimistic local values, flushed as one UPDATE_SETTINGS patch after 300 ms. An override is dropped when the
 * server's settings match it, when the error for its action id arrives (NOT_HOST, WRONG_PHASE, INVALID_SETTINGS…),
 * or when nothing is pending or in flight; an unrelated broadcast in between never makes it flicker back.
 */
export function usePatcher(
  server: Settings,
  send: (patch: SettingsPatch) => string | null,
  error: { ref: string | null } | null,
): [Settings, (p: SettingsPatch) => void] {
  const [over, setOver] = useState<SettingsPatch>({});
  const pending = useRef<SettingsPatch>({});
  const inflight = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const serverRef = useRef(server);
  serverRef.current = server;
  const settle = (): void => {
    setOver((o) => {
      const busy = Object.keys(pending.current).length > 0 || inflight.current.size > 0;
      const keep: Record<string, unknown> = {};
      let all = true;
      for (const [k, v] of Object.entries(o)) {
        if (same(v, (serverRef.current as unknown as Record<string, unknown>)[k])) continue;
        all = false;
        if (busy) keep[k] = v;
      }
      // Every in-flight change is visible in the server's settings: the patches are confirmed.
      if (all && Object.keys(pending.current).length === 0) clearInflight();
      return Object.keys(keep).length === Object.keys(o).length ? o : (keep as SettingsPatch);
    });
  };
  const clearInflight = (): void => {
    for (const h of inflight.current.values()) clearTimeout(h);
    inflight.current.clear();
  };
  useEffect(settle, [server]);
  useEffect(() => {
    // The server rejected one of our patches: drop what isn't still pending locally.
    if (!error?.ref || !inflight.current.has(error.ref)) return;
    clearTimeout(inflight.current.get(error.ref));
    inflight.current.delete(error.ref);
    setOver(() => ({ ...pending.current }));
  }, [error]);
  useEffect(() => () => {
    if (timer.current !== null) clearTimeout(timer.current);
    clearInflight();
  }, []);
  const set = (p: SettingsPatch): void => {
    pending.current = { ...pending.current, ...p };
    setOver((o) => ({ ...o, ...p }));
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      const patch = pending.current;
      pending.current = {};
      const id = send(patch);
      if (id === null) {
        settle(); // not sent (socket not OPEN): fall back to the server's values
        return;
      }
      inflight.current.set(id, setTimeout(() => {
        inflight.current.delete(id);
        settle();
      }, INFLIGHT_MS));
    }, 300);
  };
  return [{ ...server, ...over } as Settings, set];
}
