// JAMAA-PLATFORM §8.3: server errors reach the monitoring too. `logServerError` keeps the existing structured
// `console.error(JSON)` line (Workers Logs) and also, best effort, writes one AE point and forwards the entry to the
// Stats DO ring (the admin page cannot read Workers Logs without an API token). Forwarding is capped per isolate
// (SERVER_FORWARDS_PER_MIN), so an error storm costs a bounded number of DO requests.
// Fields follow docs/DEV.md "Logging rules": codes, phases, counts and room codes only, never player data.
import type { Env } from "../env";
import { writePoint } from "./events";
import type { StatsInput } from "./stats-core";
import { statsStub } from "./stats-api";

export const SERVER_FORWARDS_PER_MIN = 10;

type MonitorEnv = Pick<Env, "EVENTS" | "STATS">;
interface Bound { env: MonitorEnv; waitUntil: (p: Promise<unknown>) => void }
let bound: Bound | null = null;
let windowStart = 0;
let windowCount = 0;

/** Called by the Worker (per request / cron) and each Durable Object constructor. */
export function bindMonitor(env: MonitorEnv, waitUntil: (p: Promise<unknown>) => void = () => undefined): void {
  bound = { env, waitUntil };
}

/** Test hook. */
export function resetMonitorBinding(): void {
  bound = null;
  windowStart = 0;
  windowCount = 0;
}

/** True while this isolate may still forward an error this minute. */
export function forwardAllowed(now: number): boolean {
  if (now - windowStart >= 60_000) {
    windowStart = now;
    windowCount = 0;
  }
  if (windowCount >= SERVER_FORWARDS_PER_MIN) return false;
  windowCount++;
  return true;
}

export type LogFields = Record<string, string | number | boolean | null | readonly string[]>;

/** The one structured error line, plus the monitoring copy. Never throws. */
export function logServerError(code: string, fields: LogFields = {}): void {
  console.error(JSON.stringify({ code, ...fields }));
  forwardServerError(code, fields);
}

export function forwardServerError(code: string, fields: LogFields = {}): void {
  const b = bound;
  if (!b) return;
  const now = Date.now();
  const phase = typeof fields.phase === "string" ? fields.phase : "";
  writePoint(b.env.EVENTS, { indexes: ["server_error"], blobs: ["server_error", "", "", "server", code, "", phase, ""], doubles: [0, 0, 1] });
  if (!forwardAllowed(now)) return;
  const room = typeof fields.roomCode === "string" ? fields.roomCode : undefined;
  const detail = Object.entries(fields)
    .filter(([k]) => k !== "roomCode" && k !== "phase")
    .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join(",") : String(v)}`)
    .join(" ")
    .slice(0, 200);
  const ev: StatsInput = {
    t: "server_error", at: now,
    entry: { code: code.slice(0, 60), ...(phase ? { screen: phase.slice(0, 40) } : {}), ...(detail ? { message: detail } : {}), ...(room ? { room } : {}) },
  };
  try {
    const stub = statsStub(b.env);
    if (!stub) return;
    const p = stub.ingest([ev]).catch(() => undefined);
    try {
      b.waitUntil(p);
    } catch {
      // A finished request's context: the promise still runs on its own.
    }
  } catch {
    // never throw from a logger
  }
}
