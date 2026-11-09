// GAME-TRIVIA §8 / §13.2: the pure view model both Trivia surfaces (phone `game-trivia`, `/tv` `tv-mock-game-trivia`)
// read. Zod-free, DOM-free and unit-tested (web-client/test/games/trivia). Everything here derives from the PUBLIC
// projection plus this phone's own `me`: nothing can surface a secret the server did not send (§8.1).
import type { GameEnvelope, PlayerRoomView, RoomPublic, TvRoomView } from "@jamaa/shared/protocol/v2";
import type { Expression } from "@jamaa/shared/characters";

type Env = Extract<GameEnvelope, { gameId: "trivia" }>;
export type TriviaPub = Env["public"];
export type TriviaMe = NonNullable<Env["me"]>;
export type Phase = TriviaPub["phase"];
export type ScoreRow = TriviaPub["scores"][number];
export type Reveal = NonNullable<TriviaPub["reveal"]>;
export type ChoiceRow = Reveal["choices"][number];
export type Member = RoomPublic["members"][number];
export type QType = "mc4" | "tf";

export interface Trivia {
  pub: TriviaPub;
  me: TriviaMe | null;
  /** `game.doneIds` / `game.awaitedIds` (platform status: who answered, never what). */
  doneIds: readonly string[];
  awaitedIds: readonly string[];
  over: boolean;
  n: number;
}

function of(g: GameEnvelope | null): Trivia | null {
  if (!g || g.gameId !== "trivia") return null;
  return { pub: g.public, me: g.me, doneIds: g.doneIds, awaitedIds: g.awaitedIds, over: g.over, n: g.n };
}
export const triviaOfPhone = (v: PlayerRoomView): Trivia | null => of(v.game);
export const triviaOfTv = (v: TvRoomView): Trivia | null => of(v.game);

/** A player as the screens draw them: the room member (name, colour, seat) + their Trivia score row. */
export interface Player {
  id: string;
  name: string;
  color: Member["color"];
  seat: number;
  connected: boolean;
  isHost: boolean;
  reaction: Member["reaction"];
  row: ScoreRow;
  isNew: boolean;
  waiting: boolean;
}

const NEUTRAL: Omit<Member, "id"> = { name: "", color: "lilac", seat: 99, connected: false, left: true, benched: false, isHost: false, reaction: null };

/** Every scored player in seat order (a member the room already dropped keeps a neutral identity: never a crash). */
export function playersOf(room: RoomPublic, pub: TriviaPub): Player[] {
  const byId = new Map(room.members.map((m) => [m.id, m]));
  return pub.scores.map((row) => {
    const m = byId.get(row.playerId) ?? { id: row.playerId, ...NEUTRAL };
    return {
      id: row.playerId, name: m.name, color: m.color, seat: m.seat, connected: m.connected && !row.left, isHost: m.isHost,
      reaction: m.reaction, row, isNew: pub.newIds.includes(row.playerId), waiting: pub.waitingIds.includes(row.playerId),
    };
  }).sort((a, b) => a.seat - b.seat);
}

/** Players still in the game (left players stay in the tower, greyed, but leave the podium row). */
export const activePlayers = (ps: readonly Player[]): Player[] => ps.filter((p) => !p.row.left);

/** Tower / leaderboard order: rank ↑ (shared places keep seat order), left players last. `before` = the order the
 *  previous scores had (REVEAL: before this question; LEADERBOARD: at the previous board). */
export function standings(ps: readonly Player[], before = false): Player[] {
  const key = (p: Player): number => {
    if (p.row.left) return 1e6 + p.seat;
    const r = before ? p.row.rankBefore : p.row.rank;
    // No previous rank (the first board, a late joiner): order by the score it had, then seat.
    if (r === null) return 1e4 - Math.min(p.row.scoreBefore, 9_999) / 10 + p.seat / 100;
    return r * 100 + p.seat;
  };
  return [...ps].sort((a, b) => key(a) - key(b));
}

/** §8.2: the token ids of a question type, in DISPLAYED position order (A..D or True/False; never mirrored). */
export const TOKENS_MC4 = ["a", "b", "c", "d"] as const;
export const TOKENS_TF = ["true", "false"] as const;
export type TokenId = (typeof TOKENS_MC4)[number] | (typeof TOKENS_TF)[number];
export function tokensOf(type: QType): readonly TokenId[] {
  return type === "tf" ? TOKENS_TF : TOKENS_MC4;
}
/** The tile letter (Latin in every locale, DESIGN-JAMAA §1.5), or null for True/False. */
export function letterOf(token: TokenId): string | null {
  return token.length === 1 ? token.toUpperCase() : null;
}

/** The option label shown in a tile: tf tiles show the platform True/False words when the pack label is empty. */
export function optionText(pub: TriviaPub, i: number): string {
  return pub.options[i] ?? "";
}

// ---------- the phone's verdict (§8.3 REVEAL, TR-PH-03) ----------

export type Verdict =
  | { kind: "waiting" }
  | { kind: "voided" }
  | { kind: "correct"; points: number; streakBonus: number; total: number; streak: number; onFire: boolean; fastest: boolean; rank: number | null; final: boolean }
  | { kind: "wrong"; rank: number | null; right: number; myChoice: number }
  | { kind: "none"; rank: number | null; right: number };

/** This phone's REVEAL verdict, from the public reveal (its own choice row) — never from local state. */
export function verdictOf(pub: TriviaPub, me: TriviaMe | null, myId: string | null): Verdict | null {
  const r = pub.reveal;
  if (!r || !myId) return null;
  if (me?.waitingForNext || pub.waitingIds.includes(myId)) return { kind: "waiting" };
  if (r.voided) return { kind: "voided" };
  const row = pub.scores.find((s) => s.playerId === myId);
  const rank = row?.rank ?? null;
  const c = r.choices.find((x) => x.id === myId);
  if (!c || c.choice === null) return { kind: "none", rank, right: r.correct };
  if (!c.correct) return { kind: "wrong", rank, right: r.correct, myChoice: c.choice };
  const streak = row?.streak ?? 0;
  return {
    kind: "correct", points: c.points, streakBonus: c.streakBonus, total: c.points + c.streakBonus, streak,
    onFire: streak >= 3, fastest: r.fastestIds.includes(myId), rank, final: pub.isFinal,
  };
}

/** LEADERBOARD phone line: "You're in the lead!" or "{points} behind {name}" (the player just above, §8.3). */
export function gapAhead(ps: readonly Player[], myId: string): { leading: true } | { leading: false; points: number; name: string } | null {
  const order = standings(ps).filter((p) => !p.row.left);
  const i = order.findIndex((p) => p.id === myId);
  if (i < 0) return null;
  const mine = order[i]!.row.score;
  // The nearest player strictly ahead in points (a shared place is not "behind").
  for (let k = i - 1; k >= 0; k--) {
    const o = order[k]!;
    if (o.row.score > mine) return { leading: false, points: o.row.score - mine, name: o.name };
  }
  return { leading: true };
}

/** Rank ties: the place is shared with someone else (§5.3). */
export function sharedPlace(ps: readonly Player[], id: string): boolean {
  const me = ps.find((p) => p.id === id);
  if (!me || me.row.rank === null) return false;
  return ps.some((p) => p.id !== id && !p.row.left && p.row.rank === me.row.rank);
}

// ---------- results (§8.3 RESULTS, §12.5) ----------

export interface Stat { key: "fastest" | "streak" | "correct"; name: string; count: number; color: Member["color"] }

/** The three stat cards: most "Fastest finger" bolts, longest streak, most correct (ties: better rank, then seat). */
export function resultsStats(ps: readonly Player[]): Stat[] {
  const live = standings(ps).filter((p) => !p.row.left || p.row.correct > 0);
  const best = (pick: (r: ScoreRow) => number): Player | null => {
    let out: Player | null = null;
    for (const p of live) if (pick(p.row) > 0 && (!out || pick(p.row) > pick(out.row))) out = p;
    return out;
  };
  const out: Stat[] = [];
  const f = best((r) => r.fastest);
  if (f) out.push({ key: "fastest", name: f.name, count: f.row.fastest, color: f.color });
  const s = best((r) => r.bestStreak);
  if (s) out.push({ key: "streak", name: s.name, count: s.row.bestStreak, color: s.color });
  const c = best((r) => r.correct);
  if (c) out.push({ key: "correct", name: c.name, count: c.row.correct, color: c.color });
  return out;
}

/** Podium steps 1..3 (shared places share a step: every player of rank 1 stands on the top step, §5.3). */
export function podiumOf(ps: readonly Player[]): { step: 1 | 2 | 3; players: Player[] }[] {
  const ranked = standings(ps).filter((p) => !p.row.left && p.row.rank !== null);
  const ranks = [...new Set(ranked.map((p) => p.row.rank!))].sort((a, b) => a - b).slice(0, 3);
  return ranks.map((r, i) => ({ step: (i + 1) as 1 | 2 | 3, players: ranked.filter((p) => p.row.rank === r) }));
}

/** LEADERBOARD: the biggest climber since the previous board ("+3 places!"), only for a climb of ≥ 1 place. */
export function biggestClimb(ps: readonly Player[]): { id: string; places: number } | null {
  let out: { id: string; places: number } | null = null;
  for (const p of ps) {
    if (p.row.left || p.row.rank === null || p.row.rankBefore === null) continue;
    const d = p.row.rankBefore - p.row.rank;
    if (d > 0 && (!out || d > out.places)) out = { id: p.id, places: d };
  }
  return out;
}

// ---------- characters (DESIGN-JAMAA §4.3: a function of the PUBLIC view only) ----------

/** A podium character's expression in this phase. Before REVEAL: `done` when answered, `think` while awaited, never a
 *  hint of right or wrong. REVEAL: cheer (right), shock (the only one wrong) / sad (wrong), away-style z (no answer). */
export function expressionFor(t: Trivia, p: Player): Expression {
  if (!p.connected) return "away";
  const pub = t.pub;
  switch (pub.phase) {
    case "ANSWER":
      if (t.doneIds.includes(p.id) || pub.answeredIds.includes(p.id)) return "done";
      return p.waiting ? "idle" : "think";
    case "REVEAL": {
      const r = pub.reveal;
      if (!r || r.voided) return "idle";
      const c = r.choices.find((x) => x.id === p.id);
      if (!c) return "idle";
      if (c.choice === null) return r.tooSlow || r.stumped ? "shock" : "away";
      if (c.correct) return "cheer";
      if (r.stumped) return "shock";
      const wrong = r.choices.filter((x) => x.choice !== null && !x.correct).length;
      return wrong === 1 ? "shock" : "sad";
    }
    case "LEADERBOARD":
      return p.row.rank === 1 && p.row.score > 0 ? "cheer" : "idle";
    case "RESULTS":
      return p.row.rank === 1 ? "cheer" : p.row.rank !== null && p.row.rank <= 3 ? "happy" : "idle";
    default:
      return "idle";
  }
}

/** The flame overlay grows one step at streak 3, 5 and 7 (§12.3 "3, 5, 7…"); 0 = none. */
export function flameLevel(streak: number): 0 | 1 | 2 | 3 {
  return streak >= 7 ? 3 : streak >= 5 ? 2 : streak >= 3 ? 1 : 0;
}

// ---------- small text helpers ----------

/** "3.2" from milliseconds (one decimal, Western digits; the copy carries the unit). */
export function secs(ms: number): string {
  return (Math.max(0, Math.round(ms / 100)) / 10).toFixed(1);
}

/** A question shortened to `max` graphemes for the phone strip ("Which singer is known…"). */
export function excerpt(text: string, max: number): string {
  const seg = typeof Intl !== "undefined" && "Segmenter" in Intl
    ? [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)].map((s) => s.segment)
    : [...text];
  if (seg.length <= max) return text;
  return seg.slice(0, Math.max(1, max - 1)).join("").trimEnd() + "…";
}

/** Milliseconds left on the server clock (never negative). */
export function leftMs(deadline: number | null, localNow: number, offset: number): number {
  return deadline === null ? 0 : Math.max(0, deadline - (localNow + offset));
}

/** The "QUESTION 3 / 10" counter: `index` is 0-based (§13.2). */
export function questionNumber(pub: TriviaPub): { index: number; total: number } {
  return { index: Math.min(pub.total, pub.index + 1), total: pub.total };
}
