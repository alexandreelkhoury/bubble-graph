// Scripted scenario for the generated (G) fixtures (§10). Deterministic: seed 12345, test catalog, scripted clock.
import type { ColorId, Locale } from "../src/constants";
import { assertInvariants } from "../src/engine/invariants";
import { isGuessCorrect } from "../src/engine/normalize";
import { createInitialState, reduce } from "../src/engine/reduce";
import type { Action, ClientIntent, GameState } from "../src/engine/types";
import { projectForPlayer, projectForTv } from "../src/projection/project";
import { TEST_CATALOG } from "../test/support/test-catalog";

export const FIXTURE_SEED = 12345;
export const FIXTURE_T0 = 1_790_000_000_000;

const CAST: { name: string; color: ColorId; id: string; locale: Locale }[] = [
  { name: "Rami", color: "coral", id: "p_0a1b2c3d4e5f60718293a4b5", locale: "en" },
  { name: "Léa", color: "azure", id: "p_1b2c3d4e5f60718293a4b5c6", locale: "fr" },
  { name: "نور", color: "jade", id: "p_2c3d4e5f60718293a4b5c6d7", locale: "ar" },
  { name: "Sam", color: "lemon", id: "p_3d4e5f60718293a4b5c6d7e8", locale: "en" },
  { name: "Zoé", color: "grape", id: "p_4e5f60718293a4b5c6d7e8f9", locale: "fr" },
];
const LEA = "p_1b2c3d4e5f60718293a4b5c6";

/** Returns generated file name → file content (pretty-printed, trailing newline). */
export function generateFixtures(): Map<string, string> {
  const files = new Map<string, string>();
  let now = FIXTURE_T0;
  let state: GameState = createInitialState({ roomCode: "KXRT", joinUrl: "https://mish-ana.example.workers.dev/KXRT", seed: FIXTURE_SEED, wordLocale: "en" });

  const dispatch = (action: Action, at?: number): void => {
    if (at !== undefined) now = at;
    else now += 1000;
    const r = reduce(state, action, { now, catalog: TEST_CATALOG });
    if (!r.ok) throw new Error(`fixture scenario: ${action.type} failed with ${r.error}`);
    assertInvariants(r.state);
    state = r.state;
  };
  const tv = (a: ClientIntent): void => dispatch({ ...a, by: { kind: "tv" } } as Action);
  const as = (playerId: string, a: ClientIntent): void => dispatch({ ...a, by: { kind: "player", playerId } } as Action);
  const write = (name: string, view: unknown): void => {
    const msg = { v: 1, t: "state", seq: state.version, serverNow: now, view };
    files.set(name, JSON.stringify(msg, null, 2) + "\n");
  };
  const writeTv = (phase: string): void => write(`s2c.state.tv.${phase}.json`, projectForTv(state, TEST_CATALOG));
  const writePlayer = (name: string, pid: string | null): void => write(`s2c.state.player.${name}.json`, projectForPlayer(state, TEST_CATALOG, pid));
  const join = (i: number): void => {
    const c = CAST[i];
    if (!c) throw new Error("cast");
    dispatch({ type: "JOIN", by: { kind: "system" }, playerId: c.id, name: c.name, color: c.color, locale: c.locale }, FIXTURE_T0 + i);
  };
  const speakAll = (): void => {
    while (state.phase === "CLUES" || state.phase === "TIE_BREAK") {
      const sp = state.speakingOrder[state.turnIdx];
      if (!sp) throw new Error("no speaker");
      as(sp, { type: "CLUE_DONE" });
    }
  };
  /** Current phase (a call, so TypeScript does not narrow it across dispatches). */
  const phase = (): GameState["phase"] => state.phase;
  const roleOf = (id: string) => state.players.find((p) => p.id === id)?.role;
  const alive = () => state.players.filter((p) => p.alive);
  /** Everyone votes for `target`; the target votes for the first other alive player. */
  const voteOut = (target: string): void => {
    const other = alive().find((p) => p.id !== target)?.id;
    for (const p of alive()) {
      if (state.phase !== "VOTING") break;
      as(p.id, { type: "CAST_VOTE", targetId: p.id === target ? (other as string) : target });
    }
  };

  // ---------------- Game 1
  for (let i = 0; i < 4; i++) join(i);
  now = FIXTURE_T0 + 1000;
  tv({ type: "UPDATE_SETTINGS", patch: { roleMode: "custom", undercoverCount: 1, blankCount: 0 } });
  writeTv("lobby");
  writePlayer("lobby_spectator", null);
  writePlayer("lobby", LEA);
  tv({ type: "START" });
  writeTv("role_reveal");
  for (const p of state.players) if (phase() === "ROLE_REVEAL") as(p.id, { type: "READY" });
  writeTv("clues");
  speakAll();
  // Round 1 votes split 2–2 between seat 0 and seat 3.
  const [a, b, c, d] = state.players.map((p) => p.id) as [string, string, string, string];
  as(a, { type: "CAST_VOTE", targetId: d });
  as(b, { type: "CAST_VOTE", targetId: d });
  writePlayer("voting", LEA);
  as(c, { type: "CAST_VOTE", targetId: a });
  as(d, { type: "CAST_VOTE", targetId: a });
  writeTv("tie_break");
  speakAll();
  // Re-vote: unique maximum on seat 3.
  as(a, { type: "CAST_VOTE", targetId: d });
  as(b, { type: "CAST_VOTE", targetId: d });
  as(c, { type: "CAST_VOTE", targetId: d });
  as(d, { type: "CAST_VOTE", targetId: a });
  writeTv("elimination");
  while (state.phase !== "RESULTS") {
    if (state.phase === "ELIMINATION") tv({ type: "HOST_ADVANCE" });
    else if (state.phase === "CLUES" || state.phase === "TIE_BREAK") speakAll();
    else if (state.phase === "VOTING") voteOut(alive().find((p) => roleOf(p.id) !== "CIVILIAN")?.id as string);
    else throw new Error(`unexpected phase ${state.phase}`);
  }
  writeTv("results");
  writePlayer("results", LEA);

  // ---------------- Game 2
  tv({ type: "PLAY_AGAIN" });
  const resume = now;
  join(4);
  now = resume;
  tv({ type: "UPDATE_SETTINGS", patch: { blankCount: 1 } });
  tv({ type: "START" });
  const blank = state.players.find((p) => p.role === "BLANK");
  if (!blank) throw new Error("no blank");
  writePlayer("role_reveal_blank", blank.id);
  for (const p of state.players) if (phase() === "ROLE_REVEAL") as(p.id, { type: "READY" });
  speakAll();
  voteOut(blank.id);
  if (phase() !== "ELIMINATION") throw new Error(`expected ELIMINATION, got ${state.phase}`);
  tv({ type: "HOST_ADVANCE" });
  if (phase() !== "MR_WHITE_GUESS") throw new Error(`expected MR_WHITE_GUESS, got ${state.phase}`);
  writePlayer("mr_white_guess_guesser", blank.id);
  const civ = state.pair?.civilian;
  const wrong = ["Bicycle", "Umbrella", "Volcano"].find((w) => civ && !isGuessCorrect(w, civ)) as string;
  as(blank.id, { type: "SUBMIT_GUESS", text: wrong });
  writeTv("mr_white_guess");
  return files;
}
