// Scripted scenario for the generated (G) fixtures (§10). Deterministic: seed 12345, test catalog, scripted clock.
import type { ColorId, Locale } from "../src/constants";
import { isGuessCorrect } from "../src/engine/normalize";
import { projectForPlayer, projectForTv } from "../src/projection/project";
import type { ViewAccess } from "../src/projection/project";
import { Game, SYS, TEST_CATALOG, TEST_FREE_CATALOG } from "../src/testing";

export const FIXTURE_SEED = 12345;
export const FIXTURE_T0 = 1_790_000_000_000;
/** The fixture room is a free room (PAYMENTS-SPEC §3.11): it plays the free test packs; the premium ones show as locked. */
const FREE_ACCESS: ViewAccess = { premium: false, fullCatalog: TEST_CATALOG, tvBusy: false };

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
  const g = new Game({ seed: FIXTURE_SEED, now: FIXTURE_T0, catalog: TEST_FREE_CATALOG, roomCode: "KXRT", joinUrl: "https://mish-ana.example.workers.dev/KXRT" });

  const write = (name: string, view: unknown): void => {
    const msg = { v: 1, t: "state", seq: g.state.version, serverNow: g.now, view };
    files.set(name, JSON.stringify(msg, null, 2) + "\n");
  };
  const writeTv = (phase: string): void => write(`s2c.state.tv.${phase}.json`, projectForTv(g.state, TEST_FREE_CATALOG, FREE_ACCESS));
  const writePlayer = (name: string, pid: string | null): void => write(`s2c.state.player.${name}.json`, projectForPlayer(g.state, TEST_FREE_CATALOG, pid, FREE_ACCESS));
  const join = (i: number): void => {
    const c = CAST[i];
    if (!c) throw new Error("cast");
    g.doAt({ type: "JOIN", by: SYS, playerId: c.id, name: c.name, color: c.color, locale: c.locale }, FIXTURE_T0 + i);
  };
  /** Current phase (a call, so TypeScript does not narrow it across dispatches). */
  const phase = () => g.state.phase;
  const vote = (voter: string, targetId: string): void => {
    g.p(voter, { type: "CAST_VOTE", targetId });
  };

  // ---------------- Game 1
  for (let i = 0; i < 4; i++) join(i);
  g.now = FIXTURE_T0 + 1000;
  g.tv({ type: "UPDATE_SETTINGS", patch: { roleMode: "custom", undercoverCount: 1, blankCount: 0 } });
  writeTv("lobby");
  writePlayer("lobby_spectator", null);
  writePlayer("lobby", LEA);
  g.tv({ type: "START" });
  writeTv("role_reveal");
  g.readyAll();
  writeTv("clues");
  g.speakAll();
  // Round 1 votes split 2–2 between seat 0 and seat 3.
  const [a, b, c, d] = g.ids() as [string, string, string, string];
  vote(a, d);
  vote(b, d);
  writePlayer("voting", LEA);
  vote(c, a);
  vote(d, a);
  writeTv("tie_break");
  g.speakAll();
  // Re-vote: unique maximum on seat 3.
  vote(a, d);
  vote(b, d);
  vote(c, d);
  vote(d, a);
  writeTv("elimination");
  while (phase() !== "RESULTS") {
    if (phase() === "ELIMINATION") g.tv({ type: "HOST_ADVANCE" });
    else if (phase() === "CLUES" || phase() === "TIE_BREAK") g.speakAll();
    else if (phase() === "VOTING") g.voteOut(g.alive().find((p) => p.role !== "CIVILIAN")?.id as string);
    else throw new Error(`unexpected phase ${phase()}`);
  }
  writeTv("results");
  writePlayer("results", LEA);

  // ---------------- Game 2
  g.tv({ type: "PLAY_AGAIN" });
  const resume = g.now;
  join(4);
  g.now = resume;
  g.tv({ type: "UPDATE_SETTINGS", patch: { blankCount: 1 } });
  g.tv({ type: "START" });
  const blank = g.byRole("BLANK")[0];
  if (!blank) throw new Error("no blank");
  writePlayer("role_reveal_blank", blank);
  g.readyAll();
  g.speakAll();
  g.voteOut(blank);
  if (phase() !== "ELIMINATION") throw new Error(`expected ELIMINATION, got ${phase()}`);
  g.tv({ type: "HOST_ADVANCE" });
  if (phase() !== "MR_WHITE_GUESS") throw new Error(`expected MR_WHITE_GUESS, got ${phase()}`);
  writePlayer("mr_white_guess_guesser", blank);
  const civ = g.state.pair?.civilian;
  const wrong = ["Bicycle", "Umbrella", "Volcano"].find((w) => civ && !isGuessCorrect(w, civ)) as string;
  g.p(blank, { type: "SUBMIT_GUESS", text: wrong });
  writeTv("mr_white_guess");
  return files;
}
