// JAMAA-PLATFORM §8.5: the owner's monitoring page, GET /admin (+ /admin/app.js), served by the Worker (never part of
// the phone bundle). Plain HTML + JS, no library (charts are inline SVG built by the script). The page itself holds no
// data: it asks for ADMIN_TOKEN once, keeps it in sessionStorage (never in the URL), and reads /api/admin/* with
// `Authorization: Bearer` (overview every 30 s; history, content stats, game switches, room inspector). 404 while
// ADMIN_TOKEN is unset or too short, like the API. Strict CSP: same-origin script only, no inline script.
import { adminToken } from "../admin";
import PAGE_HTML from "./admin-ui/page.html.txt";
import APP_JS from "./admin-ui/app.js.txt";
import type { Env } from "../env";
import { notFound } from "../request";

export const ADMIN_PAGE_PATH = "/admin";
export const ADMIN_SCRIPT_PATH = "/admin/app.js";

const HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
  "Content-Security-Policy":
    "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
};

// The page and its script are wrangler Text modules (admin-ui/*.txt): a string payload the Worker only serves, so it does
// not count toward the 450 KB script budget (check-size.mjs counts them with the content modules) and is easier to edit.
const HTML: string = PAGE_HTML;
const JS: string = APP_JS;

export function handleAdminPage(req: Request, env: Env): Response {
  if (adminToken(env) === null) return notFound();
  if (req.method !== "GET" && req.method !== "HEAD") return new Response(null, { status: 405 });
  const path = new URL(req.url).pathname;
  if (path === ADMIN_SCRIPT_PATH) return new Response(JS, { headers: { ...HEADERS, "Content-Type": "text/javascript; charset=utf-8" } });
  if (path === ADMIN_PAGE_PATH || path === ADMIN_PAGE_PATH + "/") return new Response(HTML, { headers: { ...HEADERS, "Content-Type": "text/html; charset=utf-8" } });
  return notFound();
}
