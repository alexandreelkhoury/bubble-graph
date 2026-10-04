// Worker entry (§7.3). Static assets are served by the assets layer; the Worker runs first only for
// /api/*, /parties/* and /healthz (wrangler.jsonc `run_worker_first`).
import { getServerByName, routePartykitRequest } from "partyserver";
import { ROOM_CODE_REGEX, WS_PATH_PREFIX } from "@mishana/shared/constants";
import { BILLING_PREFIX, handleBilling, productionBillingDeps } from "./billing/routes";
import { runCron } from "./billing/cron";
import type { BillingStore } from "./billing/billing-core";
import type { Env } from "./env";
import { createRoom, healthz, httpError } from "./http";
import { originCheck } from "./origin";
import { clientIp, notFound } from "./request";
import { CID_REGEX } from "./room-core";
import { randomBytes } from "./tokens";

export { Room } from "./room";
export { Billing } from "./billing/billing-do";

/**
 * partyserver's connection id. partysocket sends a UUID/nanoid and the TV a UUID; anything else is refused
 * before the upgrade. SPEC-GAP: §6.2 does not constrain `_pk`, but partyserver throws (and echoes its stack
 * to the client) for a hibernation tag over 256 chars, so it is validated here.
 */
export const PK_REGEX = /^[A-Za-z0-9_-]{1,64}$/;

async function fetch(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  if (path === "/healthz") {
    if (req.method === "GET" || req.method === "HEAD") return healthz();
    return httpError("BAD_MESSAGE", 405);
  }

  if (path.startsWith("/api/")) {
    if (path === "/api/rooms" && req.method === "POST") {
      return createRoom(req, env, {
        getStub: (code) => getServerByName(env.Room, code),
        randomBytes,
        now: () => Date.now(),
      });
    }
    if (path.startsWith(BILLING_PREFIX)) return handleBilling(req, env, productionBillingDeps(env));
    return httpError("BAD_MESSAGE", 405);
  }

  if (path.startsWith("/parties/")) {
    if (req.headers.get("Upgrade")?.toLowerCase() !== "websocket") return notFound();
    if (!path.startsWith(WS_PATH_PREFIX) || !ROOM_CODE_REGEX.test(path.slice(WS_PATH_PREFIX.length))) {
      return notFound();
    }
    // SPEC-GAP: §6.2 closes a bad `cid` with 4000 from inside the DO; rejecting it here (400 before the
    // upgrade) also keeps the DO out of it and avoids the late onConnect close seen on wrangler dev.
    const pk = url.searchParams.get("_pk");
    const cid = url.searchParams.get("cid");
    if (pk === null || !PK_REGEX.test(pk) || cid === null || !CID_REGEX.test(cid)) {
      return new Response("Bad request", { status: 400 });
    }
    const { success } = await env.CONNECT_LIMITER.limit({ key: clientIp(req) });
    if (!success) return new Response("Too many requests", { status: 429 });
    const res = await routePartykitRequest(req, env, { onBeforeConnect: (r) => originCheck(r, env.ALLOWED_ORIGINS) });
    return res ?? notFound();
  }

  return env.ASSETS.fetch(req);
}

/** PAYMENTS-SPEC §3.8: hourly ack retries, daily voided purchases + prune. Dispatches on `controller.cron`. */
function scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): void {
  const deps = productionBillingDeps(env);
  ctx.waitUntil(runCron(env, controller.cron, { store: deps.store() as BillingStore, api: deps.google(env), now: deps.now }));
}

export default { fetch, scheduled } satisfies ExportedHandler<Env>;
