// JAMAA-PLATFORM §8.3: the tiny client error reporter (phone, /tv, /tv-pixi). Uncaught errors and unhandled rejections
// become one compact POST /api/client-errors each (sendBeacon: no preflight, survives a closing tab). Throttled per page
// load: at most MAX_REPORTS, each distinct error once. No player data: error name/message/stack, the screen and the
// room code only (the server scrubs again). Written for size: it ships in the phone core (§3.8 budget, ≈0.3 KB gz).
export const MAX_REPORTS = 5;

/** `p` overrides the platform (the browser TVs), `s` the screen, `r` the room code. */
type Ctx = () => { p?: string; s?: string; r?: string };
let ctx: Ctx = () => ({});
let sent = 0;
const seen = new Set<string>();

/** The context to attach; set by the phone shell and the TV store. */
export const setReportContext = (f: Ctx): void => {
  ctx = f;
};

/**
 * The report body for `e`, or null when throttled, a duplicate or empty. The server drops "Script error." (a cross-origin
 * script without details) and defaults the kind to "error"; both checks live there to keep this file small.
 */
export function errorReport(e: unknown): Record<string, unknown> | null {
  const x = e as Error | null | undefined;
  const n = x?.name || "Error";
  const m = String(x?.message ?? e ?? "").slice(0, 300);
  if (!m || sent >= MAX_REPORTS || seen.has(n + m)) return null;
  seen.add(n + m);
  sent++;
  return { p: "phone", n, m, st: String(x?.stack ?? "").slice(0, 1500), ...ctx() };
}

/** Reports an error (also a caught one; same throttle). */
export function reportError(e: unknown, send = (b: string): unknown => navigator.sendBeacon("/api/client-errors", b)): void {
  const r = errorReport(e);
  if (r) send(JSON.stringify(r));
}

/** Call once at startup (main.tsx). */
export function installReporter(w: Pick<Window, "addEventListener"> = window): void {
  w.addEventListener("error", (ev) => reportError((ev as ErrorEvent).error ?? (ev as ErrorEvent).message));
  w.addEventListener("unhandledrejection", (ev) => reportError((ev as PromiseRejectionEvent).reason));
}

/** Test hook. */
export function resetReporter(): void {
  sent = 0;
  seen.clear();
  ctx = () => ({});
}
