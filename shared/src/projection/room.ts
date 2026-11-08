// JAMAA-PLATFORM §2.5: RoomState → the v2 RoomView for the TV and for each phone. Pure; never imports zod at runtime.
// `content` is the room's PLAYABLE content; `fullContent` is used only for the metadata of locked packs (never items).
import { LOCALES } from "../constants";
import type { Locale } from "../constants";
import type { ContentCatalog } from "../content/catalog";
import type { PackMeta, RoomAccess } from "../content/types";
import { packProductId } from "../billing/products";
import type { GameId } from "../games/ids";
import { GAME_CONTENT, GAME_DEFS } from "../games/registry";
import { gameAvailable, roomGames, rosterOf } from "../room/reduce";
import type { RoomHistory, RoomState } from "../room/types";
import type { ErrorCode } from "../protocol/errors";
import type { GameEnvelope } from "../games/protocol";
import type { GameCard, LockedPackInfoV2, MemberPublic, PackInfoV2, PlayerRoomView, RoomPublic, RoomSetup, TvRoomView } from "../protocol/v2/views";

/** Everything outside RoomState that a projection needs (RoomCore meta, access, content). */
export interface RoomViewCtx {
  content: ContentCatalog;         // playable (§4.4)
  fullContent: ContentCatalog;     // every shipped pack: locked-pack metadata only
  access: RoomAccess;
  enabledGames: readonly GameId[]; // GAMES_ENABLED ∩ registry enabled
  focusedGameId: GameId;           // ephemeral RoomCore meta (§2.3)
  tvBusy: boolean;                 // meta.tvBusyUntil > now
  history: RoomHistory;            // memory for the setup extras
}

interface PackRow { meta: PackMeta; shown: boolean; itemCount: number }

function packRows(id: GameId, packs: readonly unknown[], settings: unknown, locale: Locale): PackRow[] {
  const adapter = GAME_CONTENT[id];
  const out: PackRow[] = [];
  for (const p of packs) {
    const meta = adapter.meta(p);
    if (!meta.languages.includes(locale) || meta.ageRating === "adult") continue;
    const v = adapter.setupView ? adapter.setupView(p, settings) : { shown: true, itemCount: meta.itemCount };
    out.push({ meta, shown: v.shown, itemCount: v.itemCount });
  }
  return out;
}

function packInfo(r: PackRow): PackInfoV2 {
  const m = r.meta;
  return {
    id: m.id, gameId: m.gameId, family: m.family, locale: m.locale, title: { ...m.title }, pairCount: r.itemCount, ageRating: m.ageRating,
    tier: m.tier, stars: m.stars, domain: m.domain, topics: [...m.topics],
  };
}

function lockedInfo(r: PackRow): LockedPackInfoV2 {
  const m = r.meta;
  return {
    id: m.id, gameId: m.gameId, family: m.family, locale: m.locale, title: { ...m.title }, pairCount: r.itemCount, ageRating: m.ageRating,
    productId: packProductId(m.family), stars: m.stars, domain: m.domain, topics: [...m.topics],
  };
}

/** Packs of `full` (in the content language) whose id is absent from the playable catalog. */
function lockedRows(id: GameId, s: RoomState, ctx: RoomViewCtx, settings: unknown): PackRow[] {
  const adapter = GAME_CONTENT[id];
  const playable = new Set((ctx.content[id].packs as unknown[]).map((p) => adapter.meta(p).id));
  return packRows(id, ctx.fullContent[id].packs as unknown[], settings, s.contentLocale).filter((r) => !playable.has(r.meta.id));
}

/** GAME_FULL when the active members exceed the game's maxPlayers, else the game's own start blocker. */
export function setupStartBlocker(s: RoomState, id: GameId, content: ContentCatalog): ErrorCode | null {
  const def = GAME_DEFS[id];
  const roster = rosterOf({ ...s, members: s.members.map((m) => ({ ...m, benched: false })) }, id);
  if (roster.length > def.meta.maxPlayers) return "GAME_FULL";
  return def.startBlocker(roster, s.gameSettings[id], content[id], s.contentLocale);
}

function projectSetup(s: RoomState, ctx: RoomViewCtx): RoomSetup | null {
  const id = s.setupGameId;
  if (s.phase !== "SETUP" || id === null) return null;
  const def = GAME_DEFS[id];
  const settings = s.gameSettings[id];
  const roster = rosterOf(s, id);
  const blocker = setupStartBlocker(s, id, ctx.content);
  const memory = ctx.history.memory[id] ?? { usedKeys: [] };
  return {
    gameId: id,
    settings: JSON.parse(JSON.stringify(settings)) as never,
    canStart: blocker === null,
    startBlocker: blocker,
    availablePacks: packRows(id, ctx.content[id].packs as unknown[], settings, s.contentLocale).filter((r) => r.shown).map(packInfo),
    lockedPacks: lockedRows(id, s, ctx, settings).filter((r) => r.shown).map(lockedInfo),
    extras: def.projectSetup(settings, roster, ctx.content[id], ctx.access, s.contentLocale, memory),
  } as RoomSetup;
}

function gameCards(s: RoomState, ctx: RoomViewCtx): GameCard[] {
  return roomGames(s, ctx.enabledGames).map((id) => {
    const m = GAME_DEFS[id].meta;
    const settings = s.gameSettings[id];
    return {
      id, minPlayers: m.minPlayers, maxPlayers: m.maxPlayers,
      available: gameAvailable(ctx.content, id, s.contentLocale) || gameAvailable(ctx.fullContent, id, s.contentLocale),
      lockedPackCount: lockedRows(id, s, ctx, settings).length,
      durationMinutes: [m.rules.durationMinutes[0], m.rules.durationMinutes[1]],
    };
  });
}

/** The languages with at least one shipped pack in any game of `room.games` (the content-language picker), LOCALES order. */
function contentLocales(s: RoomState, ctx: RoomViewCtx): Locale[] {
  const ids = roomGames(s, ctx.enabledGames);
  return LOCALES.filter((l) => ids.some((id) => gameAvailable(ctx.fullContent, id, l)));
}

export function projectRoomPublic(s: RoomState, ctx: RoomViewCtx): RoomPublic {
  const members: MemberPublic[] = s.members.map((m) => ({
    id: m.id, name: m.name, color: m.color, seat: m.seat, connected: m.connected, left: m.left, benched: m.benched,
    isHost: m.id === s.hostPlayerId, reaction: m.reaction ? { kind: m.reaction.kind, n: m.reaction.n } : null,
  }));
  const last = s.cup.last;
  return {
    roomCode: s.roomCode,
    joinUrl: s.joinUrl,
    phase: s.phase,
    focusedGameId: ctx.focusedGameId,
    setupGameId: s.setupGameId,
    contentLocale: s.contentLocale,
    members,
    hostPlayerId: s.hostPlayerId,
    games: gameCards(s, ctx),
    setup: projectSetup(s, ctx),
    cup: {
      stars: { ...s.cup.stars },
      last: last ? { gameId: last.gameId, n: last.n, ranking: last.ranking.map((g) => [...g]), points: { ...last.points } } : null,
    },
    premium: ctx.access.premium,
    tvBusy: s.phase !== "PLAYING" && ctx.tvBusy,
    contentLocales: contentLocales(s, ctx),
  };
}

/** The game envelope; `viewer` is a member id in the game (their `me`), or null (TV, benched, spectator: `me: null`). */
function projectEnvelope(s: RoomState, ctx: RoomViewCtx, viewer: string | null): GameEnvelope | null {
  const g = s.game;
  if (!g) return null;
  const def = GAME_DEFS[g.id];
  const content = ctx.content[g.id];
  const st = def.projectStatus(g.state);
  return {
    gameId: g.id,
    n: g.n,
    phase: st.phase,
    doneIds: [...st.doneIds],
    awaitedIds: [...st.awaitedIds],
    public: def.projectPublic(g.state, content),
    me: viewer === null ? null : def.projectMe(g.state, viewer, content),
    over: def.outcome(g.state) !== null,
  } as GameEnvelope;
}

export function projectRoomForTv(s: RoomState, ctx: RoomViewCtx): TvRoomView {
  return { kind: "tv", room: projectRoomPublic(s, ctx), game: projectEnvelope(s, ctx, null), me: null };
}

/** `playerId` null or unknown → a spectator view (`me: null`); benched members get the TV-equivalent game view. */
export function projectRoomForPlayer(s: RoomState, ctx: RoomViewCtx, playerId: string | null): PlayerRoomView {
  const m = playerId === null ? undefined : s.members.find((x) => x.id === playerId);
  const inGame = m !== undefined && !m.benched && !m.left;
  return {
    kind: "player",
    room: projectRoomPublic(s, ctx),
    game: projectEnvelope(s, ctx, inGame ? m.id : null),
    me: m ? { id: m.id, benched: m.benched } : null,
  };
}

