// GAME-LIKELY fixtures (JAMAA-PLATFORM §6.1 `shared/fixtures/v2/games/likely/**`, §6.2 "lane A publishes the fixtures
// first"): one deterministic room (seed 12345, the readable demo pack, a scripted clock) played hub → Likely setup → a
// Short public game through every phase (self-votes, a vote change, a host skip, Chaos, Unanimous, a tie, nobody voting,
// a late joiner with the "New" ribbon, a HOLD), AWARDS and RESULTS; then a REPLAY in Arabic with secret votes
// (percentages only, no points). Plus `layout.json`, the conga/jury-arc positions the TV mirrors in Kotlin.
// Lanes B (web) and C (TV) decode these files; `fixtures.test.ts` keeps them current.
import type { ColorId, Locale } from "../../../src/constants";
import { ERRORS } from "../../../src/games/likely/errors";
import type { LikelyIntent, LikelyState } from "../../../src/games/likely/engine/state";
import { LIKELY_STAGE, likelyConga, likelyCongaSide, likelyJuryArc, likelyRevealPositions } from "../../../src/games/likely/layout";
import { errorMessageKey } from "../../../src/protocol/errors";
import type { ErrorCode } from "../../../src/protocol/errors";
import { LIKELY_DEMO_CATALOG, withLikely } from "../../../src/testing/catalogs/likely";
import { RoomHarness } from "../../../src/testing/room";
import { TEST_CATALOG, TEST_FREE_CATALOG } from "../../../src/testing/test-catalog";
import { contentCatalog } from "../../../src/content/catalog";

export const LIKELY_FIXTURE_SEED = 12345;
export const LIKELY_FIXTURE_T0 = 1_790_000_000_000;

export const CAST: { name: string; color: ColorId; id: string; locale: Locale }[] = [
  { name: "Rami", color: "coral", id: "p_0a1b2c3d4e5f60718293a4b5", locale: "en" },
  { name: "Léa", color: "azure", id: "p_1b2c3d4e5f60718293a4b5c6", locale: "fr" },
  { name: "نور", color: "jade", id: "p_2c3d4e5f60718293a4b5c6d7", locale: "ar" },
  { name: "Sam", color: "lemon", id: "p_3d4e5f60718293a4b5c6d7e8", locale: "en" },
  { name: "Zoé", color: "grape", id: "p_4e5f60718293a4b5c6d7e8f9", locale: "fr" },
];
const [RAMI, LEA, NOUR, SAM, ZOE] = CAST.map((c) => c.id) as [string, string, string, string, string];

const json = (v: unknown): string => JSON.stringify(v, null, 2) + "\n";

/** The conga / jury-arc layout fixture (GAME-LIKELY §12.7): Kotlin asserts the same numbers. */
export function likelyLayoutFixture(): unknown {
  const arcs: Record<string, unknown> = {};
  for (let n = 1; n <= 12; n++) arcs[String(n)] = { ltr: likelyJuryArc(n), rtl: likelyJuryArc(n, true) };
  const arc12 = likelyJuryArc(12);
  const left = arc12[1] as { x: number; y: number };
  const right = arc12[10] as { x: number; y: number };
  const seatIds = Array.from({ length: 6 }, (_, i) => `p${i}`);
  const arc6 = likelyJuryArc(6);
  const ballots = [
    { voterId: "p0", targetId: "p2" }, { voterId: "p1", targetId: "p2" }, { voterId: "p2", targetId: "p2" },
    { voterId: "p3", targetId: "p5" }, { voterId: "p4", targetId: "p2" }, { voterId: "p5", targetId: "p0" },
  ];
  return {
    stage: LIKELY_STAGE,
    arcs,
    conga: {
      left: { target: left, side: likelyCongaSide(left), places: likelyConga(left, 11) },
      right: { target: right, side: likelyCongaSide(right), places: likelyConga(right, 11) },
    },
    reveal: { seatIds, arc: arc6, ballots, positions: likelyRevealPositions(arc6, seatIds, ballots) },
    revealRtl: { seatIds, arc: likelyJuryArc(6, true), ballots, positions: likelyRevealPositions(likelyJuryArc(6, true), seatIds, ballots) },
  };
}

/** `<name>` (inside games/likely/) → file content. */
export function generateLikelyFixtures(): Map<string, string> {
  const files = new Map<string, string>();
  const put = (name: string, v: unknown): void => {
    files.set(name, json(v));
  };
  put("layout.json", likelyLayoutFixture());

  // ---------------- client → server: every Likely intent (GAME-LIKELY §13.1), wrapped as GAME {gameId, i}
  let ref = 0;
  const action = (name: string, i: LikelyIntent): void =>
    put(`c2s.action.game.likely.${name}.json`, { v: 2, t: "action", id: String(++ref), a: { type: "GAME", gameId: "likely", i } });
  action("vote", { type: "VOTE", cardId: "fam-001", targetId: LEA });
  action("vote.self", { type: "VOTE", cardId: "fam-001", targetId: RAMI });
  action("skip_card", { type: "SKIP_CARD", cardId: "fam-001" });
  action("host_advance", { type: "HOST_ADVANCE" });
  action("end_game", { type: "END_GAME" });
  put("c2s.action.update_game_settings.likely.json", { v: 2, t: "action", id: String(++ref), a: { type: "UPDATE_GAME_SETTINGS", gameId: "likely", patch: { length: "short", showVoters: false } } });

  // ---------------- server → client: Likely's own error codes, plus the platform codes its intents raise
  const codes: ErrorCode[] = [...ERRORS, "INVALID_TARGET"];
  for (const code of codes) put(`s2c.error.${code.toLowerCase()}.json`, { v: 2, t: "error", code, messageKey: errorMessageKey(code), ref: "3" });

  // ---------------- state views
  const content = withLikely(LIKELY_DEMO_CATALOG, contentCatalog(TEST_FREE_CATALOG));
  const full = withLikely(LIKELY_DEMO_CATALOG, contentCatalog(TEST_CATALOG));
  const h = new RoomHarness({
    seed: LIKELY_FIXTURE_SEED, now: LIKELY_FIXTURE_T0, roomCode: "KXRT", joinUrl: "https://play.example.workers.dev/KXRT",
    content, fullContent: full, enabledGames: ["mishana", "likely"],
  });
  const state = (name: string, view: unknown): void => put(`s2c.state.${name}.json`, { v: 2, t: "state", seq: h.state.version, serverNow: h.now, view });
  const tv = (name: string): void => state(`tv.${name}`, h.tvView());
  const player = (name: string, id: string | null): void => state(`player.${name}`, h.playerView(id));
  const g = (): LikelyState => (h.state.game as { state: LikelyState }).state;
  const as = (id: string, i: LikelyIntent): void => {
    h.p(id, { type: "GAME", gameId: "likely", i } as never);
    h.now += 400;
  };
  const tvDo = (i: LikelyIntent): void => {
    h.tv({ type: "GAME", gameId: "likely", i } as never);
    h.now += 400;
  };
  const until = (phase: LikelyState["phase"]): void => {
    for (let k = 0; k < 40 && g().phase !== phase; k++) h.tick(Math.max(0, (g().deadline ?? h.now) - h.now));
    if (g().phase !== phase) throw new Error(`fixture scenario: never reached ${phase} (at ${g().phase})`);
  };
  /** From CARD: open voting, cast the ballots, wait for the reveal. */
  const card = (ballots: [string, string][]): void => {
    until("VOTING");
    const cardId = (g().card as { cardId: string }).cardId;
    for (const [v, t] of ballots) as(v, { type: "VOTE", cardId, targetId: t });
    until("REVEAL");
  };

  for (let i = 0; i < 4; i++) {
    const c = CAST[i] as (typeof CAST)[number];
    h.now = LIKELY_FIXTURE_T0 + i;
    h.join(c.id, c.name, c.color, c.locale);
  }
  h.now = LIKELY_FIXTURE_T0 + 1000;
  h.focusedGameId = "likely";
  h.tv({ type: "OPEN_GAME", gameId: "likely" });
  tv("setup.likely");
  player("setup.likely.host", RAMI);
  h.now += 1000;
  h.tv({ type: "UPDATE_GAME_SETTINGS", gameId: "likely", patch: { length: "short" } } as never);
  h.now += 1000;
  h.tv({ type: "START_GAME" });

  // Card 1: CARD → VOTING (one vote changed, one self-vote) → REVEAL (public: ballots, coins).
  tv("playing.likely.card");
  player("playing.likely.card", LEA);
  until("VOTING");
  tv("playing.likely.voting");
  player("playing.likely.voting", LEA);
  const c1 = (g().card as { cardId: string }).cardId;
  as(LEA, { type: "VOTE", cardId: c1, targetId: SAM });
  as(LEA, { type: "VOTE", cardId: c1, targetId: RAMI });   // changed her mind
  as(RAMI, { type: "VOTE", cardId: c1, targetId: RAMI });  // honest
  player("playing.likely.voting.voted", LEA);
  tv("playing.likely.voting.some_voted");
  as(NOUR, { type: "VOTE", cardId: c1, targetId: RAMI });
  as(SAM, { type: "VOTE", cardId: c1, targetId: LEA });
  tv("playing.likely.voting.all_voted");               // early end: 1 s window
  until("REVEAL");
  tv("playing.likely.reveal");
  player("playing.likely.reveal", RAMI);
  player("playing.likely.reveal.lone", SAM);

  // Card 2: the host skips the card that lands badly, then a Chaos card.
  until("CARD");
  tvDo({ type: "SKIP_CARD", cardId: (g().card as { cardId: string }).cardId });
  tv("playing.likely.card.after_skip");
  card([[RAMI, LEA], [LEA, NOUR], [NOUR, SAM], [SAM, RAMI]]);
  tv("playing.likely.reveal.chaos");

  // Card 3: a late joiner watches; everyone else agrees (Unanimous).
  until("CARD");
  h.now += 200;
  h.join(ZOE, (CAST[4] as (typeof CAST)[number]).name, (CAST[4] as (typeof CAST)[number]).color, (CAST[4] as (typeof CAST)[number]).locale);
  player("playing.likely.waiting", ZOE);
  card([[RAMI, NOUR], [LEA, NOUR], [NOUR, NOUR], [SAM, NOUR]]);
  tv("playing.likely.reveal.unanimous");
  player("playing.likely.reveal.unanimous", NOUR);

  // Card 4: Zoé is in ("New" ribbon); a tie.
  until("CARD");
  tv("playing.likely.card.new");
  player("playing.likely.card.new", ZOE);
  card([[RAMI, SAM], [LEA, ZOE], [NOUR, SAM], [SAM, ZOE], [ZOE, RAMI]]);
  tv("playing.likely.reveal.tie");

  // Card 5: nobody votes.
  until("CARD");
  card([]);
  tv("playing.likely.reveal.none");

  // A HOLD at the next card start: three players drop.
  for (const id of [NOUR, SAM, ZOE]) h.sys({ type: "DISCONNECT", playerId: id });
  until("HOLD");
  tv("playing.likely.hold");
  player("playing.likely.hold", RAMI);
  for (const id of [NOUR, SAM, ZOE]) h.sys({ type: "RECONNECT", playerId: id });
  if (g().phase === "HOLD") h.tick(0);

  // Cards 6–8: Nour keeps topping ("AGAIN?!" on the third).
  for (let k = 0; k < 3; k++) {
    until("CARD");
    card([[RAMI, NOUR], [LEA, NOUR], [SAM, NOUR], [ZOE, LEA], [NOUR, RAMI]]);
  }
  tv("playing.likely.reveal.again");
  until("AWARDS");
  tv("playing.likely.awards");
  player("playing.likely.awards", NOUR);
  until("RESULTS");
  tv("playing.likely.results");
  player("playing.likely.results", LEA);
  player("playing.likely.results.host", RAMI);

  // REPLAY in Arabic with secret votes: percentages only, no points, no Mind Reader.
  h.tv({ type: "BACK_TO_SETUP" });
  h.now += 500;
  h.tv({ type: "SET_CONTENT_LOCALE", locale: "ar" });
  h.tv({ type: "UPDATE_GAME_SETTINGS", gameId: "likely", patch: { showVoters: false } } as never);
  tv("setup.likely.secret.ar");
  h.now += 500;
  h.tv({ type: "START_GAME" });
  tv("playing.likely.card.secret.ar");
  card([[RAMI, NOUR], [LEA, NOUR], [NOUR, LEA], [SAM, NOUR], [ZOE, RAMI]]);
  tv("playing.likely.reveal.secret.ar");
  player("playing.likely.reveal.secret.ar", LEA);
  player("playing.likely.reveal.secret.ar.top", NOUR);
  for (let k = 0; k < 7; k++) {
    until("CARD");
    card([[RAMI, SAM], [LEA, NOUR], [NOUR, NOUR], [SAM, ZOE], [ZOE, NOUR]]);
  }
  until("AWARDS");
  tv("playing.likely.awards.secret.ar");
  player("playing.likely.awards.secret.ar", ZOE);
  until("RESULTS");
  tv("playing.likely.results.secret.ar");
  player("playing.likely.results.secret.ar", SAM);
  return files;
}
