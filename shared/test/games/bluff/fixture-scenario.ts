// GAME-BLUFF fixtures (JAMAA-PLATFORM §6.1 `shared/fixtures/v2/games/bluff/**`, §6.2 "lane A publishes the fixtures
// first"): one deterministic room (seed 12345, the demo catalog, a scripted clock) played hub → Bluff setup → a Short
// game through every phase, with a Spot on, a help request, a too-close probe, a host hide, a late joiner, a HOLD, the
// "No truth" final, AWARDS and RESULTS. Lanes B (web) and C (TV) decode these files; `fixtures.test.ts` keeps them current.
import type { ColorId, Locale } from "../../../src/constants";
import { contentCatalog, type ContentCatalog } from "../../../src/content/catalog";
import { GAME_DEFS } from "../../../src/games/registry";
import { ERRORS } from "../../../src/games/bluff/errors";
import type { BluffCatalog } from "../../../src/games/bluff/engine/catalog";
import type { BluffIntent, BluffState } from "../../../src/games/bluff/engine/state";
import { errorMessageKey } from "../../../src/protocol/errors";
import { bluffDemoCatalog } from "../../../src/testing/catalogs/bluff";
import { RoomHarness } from "../../../src/testing/room";
import { findRoomLeaks } from "../../../src/testing/room-leaks";
import { TEST_CATALOG, TEST_FREE_CATALOG } from "../../../src/testing/test-catalog";

export const BLUFF_FIXTURE_SEED = 12345;
export const BLUFF_FIXTURE_T0 = 1_790_000_000_000;

export const CAST: { name: string; color: ColorId; id: string; locale: Locale }[] = [
  { name: "Rami", color: "coral", id: "p_0a1b2c3d4e5f60718293a4b5", locale: "en" },
  { name: "Léa", color: "azure", id: "p_1b2c3d4e5f60718293a4b5c6", locale: "fr" },
  { name: "نور", color: "jade", id: "p_2c3d4e5f60718293a4b5c6d7", locale: "ar" },
  { name: "Sam", color: "lemon", id: "p_3d4e5f60718293a4b5c6d7e8", locale: "en" },
  { name: "Zoé", color: "grape", id: "p_4e5f60718293a4b5c6d7e8f9", locale: "fr" },
];
const [RAMI, LEA, NOUR, SAM, ZOE] = CAST.map((c) => c.id) as [string, string, string, string, string];

/** The room content with Bluff packs added (the platform ContentCatalog types Bluff as a stub until the P seam is
 *  regenerated: JAMAA-GAP, see the G2 report). */
export function withBluff(mishana: ContentCatalog["mishana"], bluff: BluffCatalog): ContentCatalog {
  return { ...contentCatalog(mishana), bluff } as unknown as ContentCatalog;
}

const json = (v: unknown): string => JSON.stringify(v, null, 2) + "\n";

/** `games/bluff/<name>` → file content. */
export function generateBluffFixtures(): Map<string, string> {
  const files = new Map<string, string>();
  const put = (name: string, v: unknown): void => {
    files.set(name, json(v));
  };

  // ---------------- client → server: every Bluff intent (GAME-BLUFF §13.1), wrapped as GAME {gameId, i}
  let ref = 0;
  const action = (name: string, i: BluffIntent): void =>
    put(`c2s.action.game.bluff.${name}.json`, { v: 2, t: "action", id: String(++ref), a: { type: "GAME", gameId: "bluff", i } });
  action("submit_lie", { type: "SUBMIT_LIE", text: "is a very tired camel", promptId: "3fa2b0c1" });
  action("request_help", { type: "REQUEST_HELP", promptId: "3fa2b0c1" });
  action("vote", { type: "VOTE", optionId: "9c01d2e3" });
  action("like.on", { type: "LIKE", optionId: "9c01d2e3", on: true });
  action("like.off", { type: "LIKE", optionId: "9c01d2e3", on: false });
  action("skip_prompt", { type: "SKIP_PROMPT", promptId: "3fa2b0c1" });
  action("hide_option", { type: "HIDE_OPTION", optionId: "9c01d2e3" });
  action("host_advance", { type: "HOST_ADVANCE" });
  action("end_game", { type: "END_GAME" });
  put("c2s.action.update_game_settings.bluff.json", { v: 2, t: "action", id: String(++ref), a: { type: "UPDATE_GAME_SETTINGS", gameId: "bluff", patch: { length: "short", pace: "relaxed" } } });

  // ---------------- server → client: every Bluff error code (never fatal)
  for (const code of ERRORS) put(`s2c.error.${code.toLowerCase()}.json`, { v: 2, t: "error", code, messageKey: errorMessageKey(code), ref: "4" });

  // ---------------- state views
  const content = withBluff(TEST_FREE_CATALOG, bluffDemoCatalog());
  const full = withBluff(TEST_CATALOG, bluffDemoCatalog());
  const h = new RoomHarness({
    seed: BLUFF_FIXTURE_SEED, now: BLUFF_FIXTURE_T0, roomCode: "KXRT", joinUrl: "https://play.example.workers.dev/KXRT",
    content, fullContent: full, enabledGames: ["mishana", "bluff"],
  });
  const state = (name: string, view: unknown): void => {
    const leaks = findRoomLeaks(h);
    if (leaks.length > 0) throw new Error(`fixture ${name} leaks: ${leaks.join("; ")}`);
    stateRaw(name, view);
  };
  const stateRaw = (name: string, view: unknown): void => put(`s2c.state.${name}.json`, { v: 2, t: "state", seq: h.state.version, serverNow: h.now, view });
  const tv = (name: string): void => state(`tv.${name}`, h.tvView());
  const player = (name: string, id: string | null): void => state(`player.${name}`, h.playerView(id));
  const g = (): BluffState => (h.state.game as { state: BluffState }).state;
  const as = (id: string, i: BluffIntent): void => {
    h.p(id, { type: "GAME", gameId: "bluff", i } as never);
    h.now += 700;
  };
  const tvDo = (i: BluffIntent): void => {
    h.tv({ type: "GAME", gameId: "bluff", i } as never);
    h.now += 700;
  };
  const until = (phase: BluffState["phase"]): void => {
    for (let k = 0; k < 30 && g().phase !== phase; k++) h.tick(Math.max(0, (g().deadline ?? h.now) - h.now));
    if (g().phase !== phase) throw new Error(`fixture scenario: never reached ${phase} (at ${g().phase})`);
  };
  const optionBy = (pred: (o: BluffState["options"][number]) => boolean): string => {
    const o = g().options.find(pred);
    if (!o) throw new Error("fixture scenario: option not found");
    return o.id;
  };

  for (let i = 0; i < 4; i++) {
    const c = CAST[i] as (typeof CAST)[number];
    h.now = BLUFF_FIXTURE_T0 + i;
    h.join(c.id, c.name, c.color, c.locale);
  }
  h.now = BLUFF_FIXTURE_T0 + 1000;
  h.focusedGameId = "bluff";
  h.tv({ type: "OPEN_GAME", gameId: "bluff" });
  tv("setup.bluff");
  player("setup.bluff.host", RAMI);
  h.now += 1000;
  h.tv({ type: "UPDATE_GAME_SETTINGS", gameId: "bluff", patch: { length: "short" } } as never);
  h.now += 1000;
  h.tv({ type: "START_GAME" });

  // Round 1 ("Finish the saying"): AR proverb in an EN room.
  tv("playing.bluff.round_intro");
  player("playing.bluff.round_intro", LEA);
  until("WRITING");
  tv("playing.bluff.writing");
  player("playing.bluff.writing", LEA);
  const r1 = g().prompt as NonNullable<BluffState["prompt"]>;
  as(RAMI, { type: "SUBMIT_LIE", text: r1.truthText as string, promptId: r1.id });     // Spot on
  player("playing.bluff.writing.spot_on", RAMI);
  as(SAM, { type: "REQUEST_HELP", promptId: r1.id });
  player("playing.bluff.writing.help", SAM);
  as(LEA, { type: "SUBMIT_LIE", text: "becomes a philosopher", promptId: r1.id });
  player("playing.bluff.writing.locked", LEA);
  tv("playing.bluff.writing.submitted");
  // A late joiner watches until the next WRITING.
  h.join(ZOE, CAST[4]!.name, CAST[4]!.color, CAST[4]!.locale);
  player("playing.bluff.waiting", ZOE);
  as(NOUR, { type: "SUBMIT_LIE", text: "sleeps like a baby", promptId: r1.id });
  as(SAM, { type: "SUBMIT_LIE", text: g().help[SAM] as string, promptId: r1.id });        // the helped lie, as offered
  tv("playing.bluff.voting");
  player("playing.bluff.voting", LEA);
  player("playing.bluff.voting.spot_on", RAMI);
  as(LEA, { type: "VOTE", optionId: optionBy((o) => o.kind === "truth") });
  as(NOUR, { type: "VOTE", optionId: optionBy((o) => o.authors.includes(LEA)) });
  as(NOUR, { type: "LIKE", optionId: optionBy((o) => o.authors.includes(SAM)), on: true });
  player("playing.bluff.voting.voted", NOUR);
  as(SAM, { type: "VOTE", optionId: optionBy((o) => o.authors.includes(LEA)) });
  until("REVEAL");
  tv("playing.bluff.reveal");
  player("playing.bluff.reveal", LEA);
  until("SCORES");
  tv("playing.bluff.scores");
  player("playing.bluff.scores", SAM);

  // A HOLD at the next prompt start: three players drop.
  for (const id of [NOUR, SAM, ZOE]) h.sys({ type: "DISCONNECT", playerId: id });
  until("HOLD");
  tv("playing.bluff.hold");
  player("playing.bluff.hold", RAMI);
  for (const id of [NOUR, SAM, ZOE]) h.sys({ type: "RECONNECT", playerId: id });
  if (g().phase === "HOLD") h.tick(0);
  until("WRITING");
  // Second saying: everyone writes (Zoé is now in, "New" ribbon), then the host hides a card.
  const r1b = g().prompt as NonNullable<BluffState["prompt"]>;
  for (const [id, t] of [[RAMI, "goes back for seconds"], [LEA, "forgets the umbrella"], [NOUR, "phones his mother"], [SAM, "takes the long road"], [ZOE, "waves at the neighbours"]] as const) {
    as(id, { type: "SUBMIT_LIE", text: t, promptId: r1b.id });
  }
  until("VOTING");
  tvDo({ type: "HIDE_OPTION", optionId: optionBy((o) => o.authors.includes(SAM)) });
  tv("playing.bluff.voting.after_hide");
  until("REVEAL");
  tv("playing.bluff.reveal.nobody_voted");
  until("ROUND_INTRO");
  tv("playing.bluff.round_intro.fact");

  // Round 2 ("Impossible but true", ×2): a too-close probe.
  until("WRITING");
  const r2 = g().prompt as NonNullable<BluffState["prompt"]>;
  as(LEA, { type: "SUBMIT_LIE", text: r2.truthText as string, promptId: r2.id });
  player("playing.bluff.writing.too_close", LEA);
  as(LEA, { type: "SUBMIT_LIE", text: "seven and a half", promptId: r2.id });
  for (const [id, t] of [[RAMI, "spirals"], [NOUR, "tiny pyramids"], [SAM, "question marks"], [ZOE, "little moons"]] as const) {
    as(id, { type: "SUBMIT_LIE", text: t, promptId: r2.id });
  }
  for (const id of [RAMI, NOUR, SAM, ZOE, LEA]) {
    const o = g().options.find((x) => !x.authors.includes(id) && (id === LEA ? x.kind === "truth" : x.kind !== "truth"));
    if (o) as(id, { type: "VOTE", optionId: o.id });
  }
  until("REVEAL");
  tv("playing.bluff.reveal.fact");
  // Skip the rest of round 2 with the host remote.
  for (let k = 0; k < 40 && !(g().phase === "ROUND_INTRO" && g().plan[g().promptIndex] === "noTruth"); k++) {
    // (Braces matter: an unbraced `else` here used to bind to the inner `if`, so the loop never ticked and the
    // "final" fixtures were really round-2 fact frames.)
    const cast = [RAMI, LEA, NOUR, SAM, ZOE];
    if (g().phase === "WRITING") {
      for (const id of cast) {
        const text = `${["Odd", "Brave", "Sleepy", "Green", "Loud"][k % 5]} ${["socks", "kettles", "pigeons", "tractors", "violins"][cast.indexOf(id)]}`;
        if (g().phase === "WRITING") as(id, { type: "SUBMIT_LIE", text, promptId: (g().prompt as { id: string }).id });
      }
    } else if (g().phase === "VOTING" && Object.keys(g().votes).length === 0) {
      // Round 2, second prompt: every vote lands on a player lie, so the truth goes unfound ("Nobody saw that coming!").
      const rami = optionBy((o) => o.authors.includes(RAMI));
      for (const id of [LEA, NOUR, SAM]) as(id, { type: "VOTE", optionId: rami });
      for (const id of [RAMI, ZOE]) as(id, { type: "VOTE", optionId: optionBy((o) => o.authors.includes(LEA)) });
      as(SAM, { type: "LIKE", optionId: optionBy((o) => o.authors.includes(NOUR)), on: true });   // +10: Nour and Sam share 3rd
    } else {
      h.tick(Math.max(0, (g().deadline ?? h.now) - h.now));
      if (g().phase === "REVEAL" && !g().reveal?.final) {
        tv("playing.bluff.reveal.nobody_found");
        player("playing.bluff.reveal.nobody_found", LEA);
      }
    }
  }
  if (!(g().phase === "ROUND_INTRO" && g().plan[g().promptIndex] === "noTruth")) throw new Error(`fixture scenario: no final ROUND_INTRO (at ${g().phase} ${g().promptIndex})`);

  // The final ("No truth").
  tv("playing.bluff.round_intro.final");
  until("WRITING");
  tv("playing.bluff.writing.final");
  const fin = g().prompt as NonNullable<BluffState["prompt"]>;
  for (const [id, t] of [[RAMI, "Where is the rest of the fish?"], [LEA, "Your chair is warm. Move."], [NOUR, "I forgive you for the bath"], [SAM, "Open the door"], [ZOE, "Meow means meow"]] as const) {
    as(id, { type: "SUBMIT_LIE", text: t, promptId: fin.id });
  }
  tv("playing.bluff.voting.final");
  player("playing.bluff.voting.final", NOUR);
  const rami = optionBy((o) => o.authors.includes(RAMI));
  for (const id of [LEA, NOUR, SAM]) as(id, { type: "VOTE", optionId: rami });
  as(RAMI, { type: "VOTE", optionId: optionBy((o) => o.authors.includes(LEA)) });
  as(ZOE, { type: "VOTE", optionId: optionBy((o) => o.authors.includes(LEA)) });
  as(SAM, { type: "LIKE", optionId: rami, on: true });            // a like on the crowned answer (+20 in the final)
  until("REVEAL");
  tv("playing.bluff.reveal.final");
  player("playing.bluff.reveal.final", RAMI);
  until("AWARDS");
  tv("playing.bluff.awards");
  player("playing.bluff.awards", RAMI);
  until("RESULTS");
  tv("playing.bluff.results");
  player("playing.bluff.results", LEA);
  player("playing.bluff.results.host", RAMI);

  // The engine-level golden: the final scores of this seeded game.
  put("golden.scores.json", { scores: g().players.map((p) => ({ playerId: p.id, score: p.score })), cup: h.state.cup.stars, viewVersion: GAME_DEFS.bluff.meta.VIEW_VERSION });
  return files;
}
