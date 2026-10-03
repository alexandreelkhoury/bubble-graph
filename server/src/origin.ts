// §7.4 Origin allowlist. Used by `onBeforeConnect` (WebSocket upgrades) and by POST /api/rooms.

export function parseAllowedOrigins(list: string | undefined): string[] {
  return (list ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

/** True when the request has no Origin, a same-origin Origin, or an allowlisted Origin. */
export function isOriginAllowed(req: Request, allowedOrigins: string | undefined): boolean {
  const origin = req.headers.get("Origin");
  if (origin === null) return true;
  if (origin === new URL(req.url).origin) return true;
  return parseAllowedOrigins(allowedOrigins).includes(origin);
}

/** `undefined` = allowed; otherwise the 403 response to return. */
export function originCheck(req: Request, allowedOrigins: string | undefined): Response | undefined {
  return isOriginAllowed(req, allowedOrigins) ? undefined : new Response("Forbidden", { status: 403 });
}
