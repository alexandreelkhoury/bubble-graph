// JAMAA-PLATFORM §8.3: POST /api/client-errors. A compact, size-capped, rate-limited, PII-free error report from the
// phone, the browser TVs and the Android TV app. Logged as one structured JSON line (code CLIENT_ERROR), written as one
// AE point and kept in the Stats DO ring for the admin page. Clients throttle and dedupe before sending (a few reports
// per session); the server limits per IP (CLIENT_ERROR_LIMITER), caps the body, truncates and scrubs every string.
import * as z from "zod";
import { ROOM_CODE_REGEX } from "@jamaa/shared/constants";
import type { Env } from "../env";
import { readBodyLimited } from "../http";
import { isOriginAllowed } from "../origin";
import { clientIp } from "../request";
import { PLATFORMS, writePoint } from "./events";
import type { StatsInput } from "./stats-core";
import { statsStub } from "./stats-api";

export const CLIENT_ERRORS_PATH = "/api/client-errors";
export const CLIENT_ERROR_MAX_BYTES = 8 * 1024;
export const MESSAGE_MAX = 300;
export const STACK_MAX = 1500;

/** Short keys keep the phone reporter tiny. Over-long strings are refused at the schema caps, then truncated below. */
export const ClientErrorReport = z.object({
  p: z.enum(PLATFORMS),
  v: z.string().max(40).optional(),
  s: z.string().max(80).optional(),
  k: z.enum(["error", "rejection", "boundary", "crash", "caught"]).optional(),
  n: z.string().max(120).optional(),
  m: z.string().max(2000).optional(),
  st: z.string().max(6000).optional(),
  r: z.string().regex(ROOM_CODE_REGEX).optional(),
  c: z.number().int().min(1).max(10_000).optional(),
});
export type ClientErrorReport = z.infer<typeof ClientErrorReport>;

/**
 * PII scrub (docs/DEV.md "Logging rules"): no emails, URL query strings or fragments (join links, tokens), long hex or
 * base64-like runs (tokens, install ids), long digit runs; control characters dropped; then truncated.
 */
export function scrub(s: string, max: number): string {
  return s
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "[email]")
    .replace(/([?#])[^\s)'"]+/g, "$1[…]")
    .replace(/\b[0-9a-f]{16,}\b/gi, "[hex]")
    .replace(/[A-Za-z0-9_-]{32,}/g, "[token]")
    .replace(/\d{7,}/g, "[n]")
    // eslint-disable-next-line no-control-regex -- stripping control characters is the point
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "")
    .slice(0, max);
}

const safeLabel = (s: string | undefined, max: number): string | undefined => {
  if (s === undefined) return undefined;
  const v = s.replace(/[^\w.:/+-]/g, "").slice(0, max);
  return v.length > 0 ? v : undefined;
};

function noContent(status = 204): Response {
  return new Response(null, { status, headers: { "Cache-Control": "no-store" } });
}

export async function handleClientErrors(req: Request, env: Env, waitUntil: (p: Promise<unknown>) => void, now = Date.now()): Promise<Response> {
  if (req.method !== "POST") return noContent(405);
  if (!isOriginAllowed(req, env.ALLOWED_ORIGINS)) return noContent(403);
  // Raw IP only as the limiter key, never logged or stored.
  if (env.CLIENT_ERROR_LIMITER) {
    const { success } = await env.CLIENT_ERROR_LIMITER.limit({ key: clientIp(req) });
    if (!success) return noContent(429);
  }
  const ct = (req.headers.get("Content-Type") ?? "").split(";")[0]?.trim().toLowerCase();
  // text/plain: navigator.sendBeacon with a string body (no CORS preflight).
  if (ct !== "application/json" && ct !== "text/plain") return noContent(415);
  const body = await readBodyLimited(req, CLIENT_ERROR_MAX_BYTES);
  if (body === null) return noContent(413);
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(body));
  } catch {
    return noContent(400);
  }
  const r = ClientErrorReport.safeParse(parsed);
  if (!r.success) return noContent(400);
  const d = r.data;
  const name = safeLabel(d.n, 60) ?? "Error";
  const version = safeLabel(d.v, 32);
  const screen = safeLabel(d.s, 40);
  const message = d.m !== undefined ? scrub(d.m, MESSAGE_MAX) : undefined;
  const stack = d.st !== undefined ? scrub(d.st, STACK_MAX) : undefined;
  const count = d.c ?? 1;
  // A cross-origin script error carries no information (the phone reporter leaves this check to the server).
  if (message === undefined || message === "Script error.") return noContent();
  console.warn(JSON.stringify({
    code: "CLIENT_ERROR", platform: d.p, v: version ?? null, screen: screen ?? null, kind: d.k ?? "error", name,
    message: message ?? null, stack: stack ?? null, roomCode: d.r ?? null, count,
  }));
  writePoint(env.EVENTS, {
    indexes: ["client_error"], blobs: ["client_error", "", "", d.p, name, version ?? "", screen ?? "", d.r ?? ""], doubles: [0, 0, count],
  });
  const stub = statsStub(env);
  if (stub) {
    const ev: StatsInput = {
      t: "client_error", at: now,
      entry: {
        code: name, platform: d.p,
        ...(version ? { v: version } : {}), ...(screen ? { screen } : {}), ...(message ? { message } : {}),
        ...(stack ? { stack } : {}), ...(d.r ? { room: d.r } : {}),
      },
    };
    waitUntil(stub.ingest([ev]).catch(() => undefined));
  }
  return noContent();
}
