// JAMAA-PLATFORM §8.8: the admin room inspector. A read-only, structured view of one room's live state for the owner
// (GET /api/admin/room?code=…, ADMIN_TOKEN only). Built by RoomCore#inspect from what it holds or reads; it never writes
// and never broadcasts. Redacted: the TV token hash, resume-token hashes, connection ids, the hashed-IP keys and the
// entitlement subject (an install hash). Shown on purpose (owner only, under `hiddenState` with a note): the hidden game state.
import type { RoomHistory, RoomState } from "@jamaa/shared/room";
import type { ConnState } from "../room-core";
import type { RoomMeta, Sessions } from "../room-store";

export const REDACTED = "[redacted]";
/** Keys never shown, at any depth (tokens and hashes, connection ids, hashed IPs, signatures, the entitlement subject). */
const SECRET_KEY = /token|hash|^ip|ipkey|^cid$|^sig|^sub$|secret|password/i;

/** A deep copy with every secret-looking key's value replaced by REDACTED. */
export function redactDeep(x: unknown, depth = 0): unknown {
  if (depth > 24) return "…";
  if (Array.isArray(x)) return x.map((v) => redactDeep(v, depth + 1));
  if (typeof x !== "object" || x === null) return x;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(x)) out[k] = SECRET_KEY.test(k) ? REDACTED : redactDeep(v, depth + 1);
  return out;
}

export interface InspectInput {
  code: string;
  now: number;
  meta: RoomMeta | null;
  state: RoomState | null;
  history: RoomHistory | null;
  sessions: Sessions;
  sockets: (ConnState | null)[];
  alarm: number | null;
  nextWakeAt: number | null;
  expiresAt: number | null;
  /** Whether the room's records came from the DO's in-memory cache or straight from storage (an evicted room). */
  source: "memory" | "storage";
}

export const SECRET_NOTE = "Owner only: the hidden game state (answers, roles, votes, words). Never shown to players.";

export function inspectRoom(i: InspectInput): Record<string, unknown> {
  const { meta, state } = i;
  if (!meta || !state) return { code: i.code, exists: false, now: i.now };
  const ent = meta.entitlement ?? null;
  const g = state.game;
  const gs = (g?.state ?? null) as Record<string, unknown> | null;
  const out = {
    code: i.code, exists: true, now: i.now, source: i.source,
    room: {
      phase: state.phase, gameId: g?.id ?? state.setupGameId, setupGameId: state.setupGameId, contentLocale: state.contentLocale,
      hostPlayerId: state.hostPlayerId, version: state.version, viewRev: meta.viewRev ?? 0, seq: state.version + (meta.viewRev ?? 0),
      tvGames: state.tvGames, enabledGames: meta.enabledGames ?? null, settings: g ? state.gameSettings[g.id] : state.setupGameId ? state.gameSettings[state.setupGameId] : null,
    },
    timers: {
      alarm: i.alarm, nextWakeAt: i.nextWakeAt, expiresAt: i.expiresAt, gameDeadline: gs?.deadline ?? null, tvBusyUntil: meta.tvBusyUntil ?? null,
      createdAt: meta.createdAt, lastActivityAt: meta.lastActivityAt, tvLeftAt: meta.tvLeftAt ?? null, gameStartedAt: meta.gameStartedAt ?? null,
    },
    members: state.members.map((m) => ({
      id: m.id, name: m.name, color: m.color, seat: m.seat, locale: m.locale, connected: m.connected, left: m.left, benched: m.benched,
      host: m.id === state.hostPlayerId, kicked: i.sessions[m.id]?.kicked ?? false, joinedAt: m.joinedAt, disconnectedAt: m.disconnectedAt,
    })),
    sockets: i.sockets.map((s) => ({ role: s?.role ?? "pending", playerId: s?.playerId ?? null, openedAt: s?.openedAt ?? null })),
    meta: {
      platform: meta.platform ?? "unknown", billingMode: meta.billingMode ?? "google", focus: meta.focus ?? null, joins: meta.joins ?? 0,
      entitlement: ent ? { mode: ent.mode, premiumUntilMs: ent.premiumUntilMs, expMs: ent.expMs, packs: ent.packs } : null,
    },
    game: g ? { id: g.id, n: g.n, phase: gs?.phase ?? null, schema: gs?.schema ?? null } : null,
    cup: state.cup,
    history: { games: i.history?.games ?? [], usedKeys: Object.fromEntries(Object.entries(i.history?.memory ?? {}).map(([k, v]) => [k, v?.usedKeys.length ?? 0])) },
    hiddenState: g ? { note: SECRET_NOTE, gameState: g.state } : null,
  };
  return redactDeep(out) as Record<string, unknown>;
}
