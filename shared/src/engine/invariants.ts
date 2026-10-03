import { MAX_PLAYERS } from "../constants";
import { currentSpeakerId, isInGame } from "./flow";
import { nameKey } from "./sanitize";
import type { DeadlineKind, GameState } from "./types";
import { checkWinner } from "./win";

export class InvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvariantError";
  }
}

/** Messages name the invariant number and player ids only (never words or guess text). */
function fail(n: number, detail: string): never {
  throw new InvariantError(`invariant ${n}: ${detail}`);
}

function unique(xs: readonly unknown[]): boolean {
  return new Set(xs).size === xs.length;
}

/** Expected deadline kind for the phase, and whether null is allowed (§4.7 table). */
function expectedDeadline(s: GameState): { kind: DeadlineKind | null; nullOk: boolean } {
  const st = s.settings;
  switch (s.phase) {
    case "LOBBY":
    case "RESULTS": return { kind: null, nullOk: true };
    case "ROLE_REVEAL": return { kind: "REVEAL", nullOk: st.revealSeconds === 0 };
    case "CLUES":
    case "TIE_BREAK": return { kind: "CLUE", nullOk: st.clueSeconds === 0 };
    case "VOTING": return { kind: "VOTE", nullOk: st.voteSeconds === 0 };
    case "ELIMINATION": return { kind: "ELIMINATION", nullOk: false };
    case "MR_WHITE_GUESS":
      return s.guess?.status === "PENDING" ? { kind: "GUESS", nullOk: st.guessSeconds === 0 } : { kind: "VERDICT", nullOk: false };
  }
}

export function assertInvariants(s: GameState): void {
  const ps = s.players;
  const byId = new Map(ps.map((p) => [p.id, p]));
  // 1
  if (ps.length > MAX_PLAYERS) fail(1, `players.length=${ps.length}`);
  if (!unique(ps.map((p) => p.id))) fail(1, "duplicate id");
  if (!unique(ps.map((p) => p.seat))) fail(1, "duplicate seat");
  if (!unique(ps.map((p) => nameKey(p.name)))) fail(1, "duplicate name");
  if (!unique(ps.map((p) => p.color))) fail(1, "duplicate colour");
  for (let i = 1; i < ps.length; i++) if ((ps[i - 1]?.seat ?? 0) >= (ps[i]?.seat ?? 0)) fail(1, "players not sorted by seat");
  // 2
  if (s.hostPlayerId !== null) {
    const h = byId.get(s.hostPlayerId);
    if (!h || h.left) fail(2, `host ${s.hostPlayerId}`);
  }
  // 3
  if (s.phase === "LOBBY") {
    for (const p of ps) {
      if (p.left) fail(3, `left player ${p.id} in LOBBY`);
      if (p.role !== null || p.word !== null || !p.alive) fail(3, `player ${p.id} not reset`);
    }
    if (s.round !== 0 || s.guessLog.length !== 0) fail(3, "round/guessLog");
    if (s.result !== null || s.deadline !== null || s.pair !== null || s.roleCounts !== null) fail(3, "result/deadline/pair/roleCounts");
  }
  // 4
  const inGame = isInGame(s.phase);
  if (inGame || s.phase === "RESULTS") {
    const pair = s.pair;
    if (!pair || !s.roleCounts) fail(4, "pair/roleCounts null");
    const c = { civilian: 0, undercover: 0, blank: 0 };
    for (const p of ps) {
      if (p.role === null) fail(4, `player ${p.id} without role`);
      if (p.role === "CIVILIAN") {
        c.civilian++;
        if (p.word?.text !== pair.civilian.text) fail(4, `civilian ${p.id} word`);
      } else if (p.role === "UNDERCOVER") {
        c.undercover++;
        if (p.word?.text !== pair.undercover.text) fail(4, `undercover ${p.id} word`);
      } else {
        c.blank++;
        if (p.word !== null) fail(4, `blank ${p.id} has a word`);
      }
    }
    const rc = s.roleCounts;
    if (c.civilian !== rc.civilian || c.undercover !== rc.undercover || c.blank !== rc.blank) fail(4, "role counts mismatch");
  }
  // 5
  if (s.phase === "CLUES" || s.phase === "TIE_BREAK") {
    if (s.turnIdx < 0 || s.turnIdx >= s.speakingOrder.length) fail(5, `turnIdx=${s.turnIdx}`);
    const sp = byId.get(currentSpeakerId(s) ?? "");
    if (!sp || !sp.alive || sp.spoke) fail(5, `speaker ${sp?.id ?? "?"}`);
    if (!sp.connected && s.deadline === null) fail(5, `disconnected speaker ${sp.id} without deadline`);
  }
  // 6
  if (s.phase === "VOTING") {
    for (const [voter, target] of Object.entries(s.votes)) {
      if (!byId.get(voter)?.alive || !byId.get(target)?.alive) fail(6, `vote ${voter}→${target} not alive`);
      if (voter === target) fail(6, `self vote ${voter}`);
      if (s.revote && !s.tieCandidates.includes(target)) fail(6, `revote target ${target}`);
    }
  }
  // 7
  if ((s.phase === "TIE_BREAK" || (s.phase === "VOTING" && s.revote)) && s.tieCandidates.length < 2) fail(7, "tieCandidates < 2");
  // 8
  if (["ROLE_REVEAL", "CLUES", "VOTING", "TIE_BREAK"].includes(s.phase) && checkWinner(s) !== null) fail(8, "winner while playing");
  // 9
  if ((s.phase === "RESULTS") !== (s.result !== null)) fail(9, "RESULTS ⇔ result");
  if (s.phase === "RESULTS" && s.deadline !== null) fail(9, "deadline in RESULTS");
  // 10
  const exp = expectedDeadline(s);
  if (s.deadline !== null && s.deadline.kind !== exp.kind) fail(10, `deadline ${s.deadline.kind} in ${s.phase}`);
  if (s.deadline === null && !exp.nullOk) fail(10, `missing deadline in ${s.phase}`);
  // 11
  if (!Number.isInteger(s.rngState) || s.rngState < 0 || s.rngState > 0xffffffff) fail(11, "rngState");
  if (!(s.version >= 0)) fail(11, "version");
  for (const p of ps) if (!(p.score >= 0)) fail(11, `score ${p.id}`);
  // 12
  if (s.phase === "MR_WHITE_GUESS") {
    if (!s.guess) fail(12, "guess null");
    if (byId.get(s.guess.playerId)?.role !== "BLANK") fail(12, `guesser ${s.guess.playerId} not BLANK`);
  }
  // 13
  if (["ROLE_REVEAL", "CLUES", "VOTING", "TIE_BREAK"].includes(s.phase) && ps.filter((p) => p.alive).length < 3) fail(13, "fewer than 3 alive");
  // 14
  for (const p of ps) {
    if (p.left && p.connected) fail(14, `left player ${p.id} connected`);
    if (p.left && inGame && p.alive) fail(14, `left player ${p.id} alive`);
  }
  // 15
  if (s.phase === "RESULTS" && s.result) {
    for (const id of [...s.result.winnerIds, ...Object.keys(s.result.pointsAwarded)]) if (!byId.has(id)) fail(15, `result id ${id}`);
  }
}
