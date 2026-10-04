// Small Request/Response helpers shared by the Worker entry and the Durable Object.

/** Client IP as seen by Cloudflare; "local" under `wrangler dev` / tests. Used only as a limiter or hash key. */
export function clientIp(req: Request): string {
  return req.headers.get("CF-Connecting-IP") ?? "local";
}

export function notFound(): Response {
  return new Response("Not found", { status: 404 });
}
