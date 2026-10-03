// Worker entry (§7.3). Static assets are served by the assets layer; the Worker runs first only for
// /api/*, /parties/* and /healthz (wrangler.jsonc `run_worker_first`).
import { getServerByName, routePartykitRequest } from "partyserver";
import { ROOM_CODE_REGEX, WS_PATH_PREFIX } from "@mishana/shared/constants";
import type { Env } from "./env";
import { createRoom, healthz, httpError } from "./http";
import { originCheck } from "./origin";
import { randomBytes } from "./tokens";

export { Room } from "./room";

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
    return httpError("BAD_MESSAGE", 405);
  }

  if (path.startsWith("/parties/")) {
    if (req.headers.get("Upgrade")?.toLowerCase() !== "websocket") return new Response("Not found", { status: 404 });
    if (!path.startsWith(WS_PATH_PREFIX) || !ROOM_CODE_REGEX.test(path.slice(WS_PATH_PREFIX.length))) {
      return new Response("Not found", { status: 404 });
    }
    const { success } = await env.CONNECT_LIMITER.limit({ key: req.headers.get("CF-Connecting-IP") ?? "local" });
    if (!success) return new Response("Too many requests", { status: 429 });
    const res = await routePartykitRequest(req, env, { onBeforeConnect: (r) => originCheck(r, env.ALLOWED_ORIGINS) });
    return res ?? new Response("Not found", { status: 404 });
  }

  return env.ASSETS.fetch(req);
}

export default { fetch } satisfies ExportedHandler<Env>;
