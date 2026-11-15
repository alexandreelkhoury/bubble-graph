// JAMAA-PLATFORM §7 (Monitoring): the meaningful events a room emits, and their Workers Analytics Engine layout.
// One data point per event, NEVER per WebSocket message. Ids, codes and counts only: no names, no IPs, no tokens.
//
// AE layout (dataset `jamaa_events`, binding EVENTS), fixed positions so SQL queries stay stable:
//   index1  event name (also the sampling key)
//   blob1   event   blob2 game id   blob3 locale   blob4 platform   blob5 reason / error name   blob6 app version
//   blob7   screen / phase          blob8 room code (client errors only, optional)
//   double1 players   double2 duration (s)   double3 count (1, or the dedupe count of a client error)
import type { GameId } from "@jamaa/shared/games/ids";

export const PLATFORMS = ["phone", "tv-web", "tv-pixi", "tv-android"] as const;
export type Platform = (typeof PLATFORMS)[number];
export type PlatformOrUnknown = Platform | "unknown";

/** `X-Jamaa-Client: <platform>/<version>` sent by the TVs with POST /api/rooms (an old server ignores the header). */
export const CLIENT_HEADER = "X-Jamaa-Client";
const CLIENT_HEADER_RE = /^(phone|tv-web|tv-pixi|tv-android)\/([0-9A-Za-z.+_-]{1,32})$/;

export function parseClientHeader(raw: string | null): { platform: PlatformOrUnknown; version: string | null } {
  const m = CLIENT_HEADER_RE.exec((raw ?? "").trim());
  return m ? { platform: m[1] as Platform, version: m[2] ?? null } : { platform: "unknown", version: null };
}

export function isPlatform(x: unknown): x is Platform {
  return typeof x === "string" && (PLATFORMS as readonly string[]).includes(x);
}

export type GameEndReason = "finished" | "aborted" | "abandoned" | "expired";
export type RoomCloseReason = "expired" | "replaced";

/** What a room reports (RoomCore → RoomMonitor). `room` / `game` are idempotency ids (code:createdAt[:n]). */
export type RoomEvent =
  | { t: "room_created"; room: string; at: number; locale: string; platform: PlatformOrUnknown }
  | { t: "room_closed"; room: string; at: number; reason: RoomCloseReason; joins: number }
  | { t: "game_started"; room: string; game: string; at: number; gameId: GameId; players: number; locale: string; platform: PlatformOrUnknown; joins: number }
  | { t: "game_ended"; room: string; game: string; at: number; gameId: GameId; players: number; durationMs: number; reason: GameEndReason; platform: PlatformOrUnknown; joins: number }
  | { t: "player_joined"; room: string; at: number; platform: PlatformOrUnknown }
  | { t: "player_left"; room: string; at: number; platform: PlatformOrUnknown };

/** The sink a Room gets. Must never throw and never block the room (best effort). */
export interface RoomMonitor { emit(ev: RoomEvent): void }
export const NO_MONITOR: RoomMonitor = { emit: () => undefined };

/** The AE data point for a room event. */
export function roomEventPoint(ev: RoomEvent): AnalyticsEngineDataPoint {
  const base = (gameId: string, locale: string, platform: string, reason: string, players: number, durationS: number): AnalyticsEngineDataPoint => ({
    indexes: [ev.t],
    blobs: [ev.t, gameId, locale, platform, reason, "", "", ""],
    doubles: [players, durationS, 1],
  });
  switch (ev.t) {
    case "room_created": return base("", ev.locale, ev.platform, "", 0, 0);
    case "room_closed": return base("", "", "", ev.reason, ev.joins, 0);
    case "game_started": return base(ev.gameId, ev.locale, ev.platform, "", ev.players, 0);
    case "game_ended": return base(ev.gameId, "", ev.platform, ev.reason, ev.players, Math.round(ev.durationMs / 1000));
    case "player_joined":
    case "player_left": return base("", "", ev.platform, "", 0, 0);
  }
}

/** The events the Stats DO counts (player joins/leaves go to Analytics Engine only; their count rides on these). */
export function isStatsEvent(ev: RoomEvent): boolean {
  return ev.t === "room_created" || ev.t === "room_closed" || ev.t === "game_started" || ev.t === "game_ended";
}

/** Writes one AE point; a missing binding (local dev, tests) or a runtime error is ignored. */
export function writePoint(ds: AnalyticsEngineDataset | undefined, p: AnalyticsEngineDataPoint): void {
  try {
    ds?.writeDataPoint(p);
  } catch {
    // AE is best effort: monitoring must never break a request.
  }
}
