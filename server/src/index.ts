// Worker entry (§7.3). Static assets are served by the assets layer; the Worker runs first only for
// /api/*, /parties/* and /healthz (wrangler.jsonc `run_worker_first`).
import { getServerByName, routePartykitRequest } from "partyserver";
import { ROOM_CODE_REGEX, WS_PATH_PREFIX } from "@jamaa/shared/constants";
import { ADMIN_PREFIX, handleAdmin } from "./admin";
import { BILLING_PREFIX, handleBilling, productionBillingDeps } from "./billing/routes";
import { CRON_HOURLY, runCron } from "./billing/cron";
import { ADMIN_PAGE_PATH, handleAdminPage } from "./monitor/admin-page";
import { CLIENT_ERRORS_PATH, handleClientErrors } from "./monitor/client-errors";
import { runMonitorCron } from "./monitor/notify";
import { bindMonitor, logServerError } from "./monitor/report";
import { statsStub } from "./monitor/stats-api";
import type { BillingStore } from "./billing/billing-core";
import { billingEnabled, billingGate, CONFIG_PATH, handleConfig } from "./config";
import type { Env } from "./env";
import { createRoom, healthz, httpError } from "./http";
import { originCheck } from "./origin";
import { clientIp, notFound } from "./request";
import { CID_REGEX } from "./room-core";
import { randomBytes } from "./tokens";
import { installContent } from "./content";
import { CONTENT_TEXT } from "./content-modules.gen";

// JAMAA-PLATFORM §5.6: the packs ship as wrangler Text modules (content-dist/**.txt), parsed on first use per isolate.
installContent((game) => CONTENT_TEXT[game] ?? []);

export { Room } from "./room";
export { Billing } from "./billing/billing-do";
export { Stats } from "./monitor/stats-do";

/**
 * partyserver's connection id. partysocket sends a UUID/nanoid and the TV a UUID; anything else is refused
 * before the upgrade. SPEC-GAP: §6.2 does not constrain `_pk`, but partyserver throws (and echoes its stack
 * to the client) for a hibernation tag over 256 chars, so it is validated here.
 */
export const PK_REGEX = /^[A-Za-z0-9_-]{1,64}$/;

async function fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  bindMonitor(env, (p) => ctx.waitUntil(p));
  try {
    return await route(req, env, ctx);
  } catch (e) {
    // JAMAA-PLATFORM §8.3: an unhandled exception is a server error (code only; never the request).
    void e;
    logServerError("UNHANDLED", { phase: new URL(req.url).pathname.split("/").slice(0, 3).join("/") });
    return httpError("INTERNAL", 500);
  }
}

async function route(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  if (path === ADMIN_PAGE_PATH || path.startsWith(ADMIN_PAGE_PATH + "/")) return handleAdminPage(req, env);

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
    if (path === CONFIG_PATH) return handleConfig(req, env);
    if (path === CLIENT_ERRORS_PATH) return handleClientErrors(req, env, (p) => ctx.waitUntil(p));
    const gated = billingGate(path, env);
    if (gated) return gated;
    if (path.startsWith(BILLING_PREFIX)) return handleBilling(req, env, productionBillingDeps(env));
    if (path.startsWith(ADMIN_PREFIX)) {
      const deps = productionBillingDeps(env);
      return handleAdmin(req, env, { store: deps.store, now: deps.now });
    }
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

/**
 * Hourly: JAMAA-PLATFORM §8.4 monitoring alerts (always). PAYMENTS-SPEC §3.8 (billing on only): hourly ack retries,
 * daily voided purchases + prune. Dispatches on `controller.cron`.
 */
function scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): void {
  bindMonitor(env, (p) => ctx.waitUntil(p));
  if (controller.cron === CRON_HOURLY) ctx.waitUntil(runMonitorCron(env, statsStub(env)));
  if (!billingEnabled(env)) return; // BILLING_ENABLED off: no Billing DO, no Google calls
  const deps = productionBillingDeps(env);
  ctx.waitUntil(runCron(env, controller.cron, { store: deps.store() as BillingStore, api: deps.google(env), now: deps.now }));
}

export default { fetch, scheduled } satisfies ExportedHandler<Env>;
