// Pure projection: GameState → client views (§5). Never imports zod at runtime.
import type { Catalog } from "../engine/catalog";
import { candidatePairs, packAllowedByAge } from "../engine/catalog";
import { currentSpeakerId, isInGame } from "../engine/flow";
import { effectiveRoleCounts } from "../engine/roles";
import type { GameState, Player } from "../engine/types";
import type { ErrorCode } from "../protocol/errors";
import type { Me, PackInfo, PlayerView, PublicPlayer, PublicView, TvView } from "../protocol/views";
import { MIN_PLAYERS } from "../constants";

function startBlocker(state: GameState, catalog: Catalog): ErrorCode | null {
  if (state.phase !== "LOBBY") return null;
  if (state.players.filter((p) => p.connected).length < MIN_PLAYERS) return "NOT_ENOUGH_PLAYERS";
  if (!effectiveRoleCounts(state.settings, state.players.length)) return "INVALID_ROLE_CONFIG";
  if (candidatePairs(catalog, state.settings).length === 0) return "NO_WORDS_AVAILABLE";
  return null;
}

function availablePacks(state: GameState, catalog: Catalog): PackInfo[] {
  if (state.phase !== "LOBBY") return [];
  const s = state.settings;
  return catalog.packs
    .filter((p) => p.language === s.wordLocale && packAllowedByAge(p, s))
    .map((p) => ({
      id: p.id,
      locale: p.locale,
      title: { en: p.title.en, fr: p.title.fr, ar: p.title.ar },
      pairCount: p.pairs.filter((q) => s.difficulties.includes(q.difficulty)).length,
      ageRating: p.ageRating,
    }));
}

function publicPlayer(state: GameState, p: Player): PublicPlayer {
  const results = state.phase === "RESULTS";
  return {
    id: p.id,
    name: p.name,
    color: p.color,
    seat: p.seat,
    connected: p.connected,
    alive: p.alive,
    left: p.left,
    isHost: p.id === state.hostPlayerId,
    ready: p.ready,
    spoke: p.spoke,
    hasVoted: state.phase === "VOTING" && state.votes[p.id] !== undefined,
    revealedRole: state.phase !== "LOBBY" && (!p.alive || results) ? p.role : null,
    score: p.score,
  };
}

export function projectPublic(state: GameState, catalog: Catalog): PublicView {
  const s = state;
  const lobby = s.phase === "LOBBY";
  const results = s.phase === "RESULTS";
  const speaking = s.phase === "CLUES" || s.phase === "TIE_BREAK";
  const voting = s.phase === "VOTING";
  const voters = voting ? s.players.filter((p) => p.alive && p.connected) : [];
  const blocker = startBlocker(s, catalog);
  return {
    roomCode: s.roomCode,
    joinUrl: s.joinUrl,
    phase: s.phase,
    gameNumber: s.gameNumber,
    round: s.round,
    settings: { ...s.settings, packIds: [...s.settings.packIds], difficulties: [...s.settings.difficulties], points: { ...s.settings.points } },
    players: s.players.map((p) => publicPlayer(s, p)),
    hostPlayerId: s.hostPlayerId,
    roleCounts: lobby ? effectiveRoleCounts(s.settings, s.players.length) : s.roleCounts ? { ...s.roleCounts } : null,
    canStart: lobby && blocker === null,
    startBlocker: blocker,
    speakingOrder: speaking ? [...s.speakingOrder] : [],
    currentSpeakerId: currentSpeakerId(s),
    revote: s.revote,
    tieCandidates: [...s.tieCandidates],
    deadline: s.deadline ? { kind: s.deadline.kind, at: s.deadline.at, durationMs: s.deadline.durationMs } : null,
    votesCast: voters.filter((p) => s.votes[p.id] !== undefined).length,
    votesExpected: voters.length,
    lastVote: s.lastVote
      ? { ...s.lastVote, tally: s.lastVote.tally.map((t) => ({ targetId: t.targetId, voterIds: [...t.voterIds] })), abstainIds: [...s.lastVote.abstainIds] }
      : null,
    eliminated: s.eliminated ? { playerId: s.eliminated.playerId, role: s.eliminated.role } : null,
    guess: s.guess
      ? { playerId: s.guess.playerId, status: s.guess.status, text: results ? s.guess.text : null, overridden: s.guess.overridden }
      : null,
    result: results && s.result
      ? {
          ...s.result,
          winnerIds: [...s.result.winnerIds],
          civilianWord: { ...s.result.civilianWord },
          undercoverWord: { ...s.result.undercoverWord },
          pack: { ...s.result.pack, title: { ...s.result.pack.title } },
          pointsAwarded: { ...s.result.pointsAwarded },
          guesses: s.result.guesses.map((g) => ({ ...g })),
        }
      : null,
    history: s.history.map((h) => ({ ...h })),
    availablePacks: availablePacks(s, catalog),
  };
}

export function projectForTv(state: GameState, catalog: Catalog): TvView {
  return { kind: "tv", ...projectPublic(state, catalog) };
}

function projectMe(state: GameState, p: Player): Me {
  const dealt = isInGame(state.phase) || state.phase === "RESULTS";
  return {
    id: p.id,
    word: dealt && p.word ? { text: p.word.text, translit: p.word.translit } : null,
    isBlank: dealt && p.role === "BLANK",
    role: dealt && (state.settings.revealRoles || !p.alive || state.phase === "RESULTS") ? p.role : null,
    myVote: state.phase === "VOTING" ? (state.votes[p.id] ?? null) : null,
  };
}

/** `playerId === null` (or unknown) → spectator view with `me: null`. */
export function projectForPlayer(state: GameState, catalog: Catalog, playerId: string | null): PlayerView {
  const p = playerId === null ? undefined : state.players.find((x) => x.id === playerId);
  return { kind: "player", ...projectPublic(state, catalog), me: p ? projectMe(state, p) : null };
}
