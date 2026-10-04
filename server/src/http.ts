// §6.6 / §7.6 HTTP handlers. Never imports partyserver.
import { BRAND } from "@mishana/shared/brand";
import { HTTP_BODY_MAX_BYTES, PROTOCOL_VERSION, WS_PATH_PREFIX } from "@mishana/shared/constants";
import type { Locale } from "@mishana/shared/constants";
import type { EntitlementStatus, ErrorCode } from "@mishana/shared/protocol";
import { CreateRoomRequest } from "@mishana/shared/protocol";
import { billingPacks } from "./billing/catalog-info";
import { billingModeForRequest } from "./billing/mode";
import { verifyEntitlementToken, verifyKeysFromSecret } from "./billing/token";
import type { RoomEntitlement } from "./billing/token";
import { generateRoomCode } from "./codes";
import type { Env } from "./env";
import { isOriginAllowed } from "./origin";
import type { InitRoomArgs, InitRoomResult } from "./room-core";
import { clientIp } from "./request";
import { randomHex, sha256hex } from "./tokens";

export interface CreateRoomDeps {
  getStub(code: string): Promise<{ initRoom(args: InitRoomArgs): Promise<InitRoomResult> }>;
  randomBytes(n: number): Uint8Array;
  now(): number;
}

export const MAX_CODE_ATTEMPTS = 10;

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}

export function httpError(code: ErrorCode, status: number): Response {
  return json({ error: code }, status, { "Cache-Control": "no-store" });
}

export function healthz(): Response {
  return json({ ok: true, app: BRAND.slug, protocol: PROTOCOL_VERSION }, 200, { "Cache-Control": "no-store" });
}

/** Reads at most `max` bytes of the body; `null` when the body is larger. */
export async function readBodyLimited(req: Request, max: number): Promise<Uint8Array | null> {
  const declared = req.headers.get("Content-Length");
  if (declared !== null && Number(declared) > max) return null;
  if (!req.body) return new Uint8Array(0);
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return out;
}

export async function createRoom(req: Request, env: Env, deps: CreateRoomDeps): Promise<Response> {
  // 1. Origin (only when present).
  if (!isOriginAllowed(req, env.ALLOWED_ORIGINS)) return httpError("BAD_MESSAGE", 403);

  // 2. Rate limit per IP (raw IP used only as the limiter key, never logged or stored).
  const { success } = await env.CREATE_ROOM_LIMITER.limit({ key: clientIp(req) });
  if (!success) return httpError("RATE_LIMITED", 429);

  // 3. Body: optional JSON {locale, entitlement}.
  const body = await readBodyLimited(req, HTTP_BODY_MAX_BYTES);
  if (body === null) return httpError("BAD_MESSAGE", 400);
  let locale: Locale = "en";
  let entitlementToken: string | null = null;
  if (body.byteLength > 0) {
    const ct = (req.headers.get("Content-Type") ?? "").split(";")[0]?.trim().toLowerCase();
    if (ct !== "application/json") return httpError("BAD_MESSAGE", 400);
    let parsed: unknown;
    try {
      parsed = JSON.parse(new TextDecoder().decode(body));
    } catch {
      return httpError("BAD_MESSAGE", 400);
    }
    const r = CreateRoomRequest.safeParse(parsed);
    if (!r.success) return httpError("BAD_MESSAGE", 400);
    locale = r.data.locale ?? "en";
    entitlementToken = r.data.entitlement ?? null;
  }
  // PAYMENTS-SPEC §3.10/§3.11: the billing mode is decided here, once, from the request; the token is verified before
  // a code is drawn. An invalid or expired token gives a free room (the TV refreshes on "INVALID").
  const billingMode = billingModeForRequest(env, req);
  let roomEntitlement: RoomEntitlement | null = null;
  if (entitlementToken !== null) {
    const keys = await verifyKeysFromSecret(env.ENTITLEMENT_KEYS);
    roomEntitlement = await verifyEntitlementToken(entitlementToken, keys, deps.now(), billingMode === "fake", billingPacks().premiumIds);
  }
  const entitlement: EntitlementStatus = entitlementToken === null ? "NONE" : roomEntitlement ? "OK" : "INVALID";

  // 4. TV token (hashed before it reaches the DO).
  const tvToken = randomHex(16, deps.randomBytes);
  const tvTokenHash = await sha256hex(tvToken);

  // 7. joinUrl base (computed once; it does not depend on the code).
  const base = (env.JOIN_BASE_URL || new URL(req.url).origin).replace(/\/$/, "");

  // 5–6. Draw codes until a DO accepts initRoom.
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const code = generateRoomCode(deps.randomBytes);
    const joinUrl = `${base}/${code}`;
    let ok: boolean;
    try {
      const stub = await deps.getStub(code);
      const r = await stub.initRoom({ tvTokenHash, joinUrl, locale, now: deps.now(), entitlement: roomEntitlement, billingMode });
      ok = r.ok;
    } catch {
      console.error(JSON.stringify({ code: "INTERNAL", phase: "createRoom", roomCode: code }));
      return httpError("INTERNAL", 503);
    }
    if (ok) {
      // 8. 201, never cached (the body carries tvToken).
      return json({ code, tvToken, joinUrl, wsPath: WS_PATH_PREFIX + code, entitlement }, 201, { "Cache-Control": "no-store" });
    }
  }
  return httpError("INTERNAL", 503);
}
