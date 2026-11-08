// JAMAA-PLATFORM §2.5 fixtures v2 (shared/fixtures/v2/): every file is generated from this deterministic scenario
// (seed 12345, test catalogs, scripted clock). TS and Kotlin both test against them.
import { PING_FRAME_V2, PONG_FRAME_V2 } from "../src/constants";
import type { ColorId, Locale } from "../src/constants";
import { GAME_IDS } from "../src/games/ids";
import type { GameId } from "../src/games/ids";
import { GAME_DEFS } from "../src/games/registry";
import { errorMessageKey } from "../src/protocol/errors";
import type { ErrorCode } from "../src/protocol/errors";
import { projectRoomForTv } from "../src/projection/room";
import { REACTIONS } from "../src/room/types";
import type { RoomIntent } from "../src/room/types";
import { ALL_TV_GAMES, RoomHarness } from "../src/testing/room";

export const FIXTURE_V2_SEED = 12345;
export const FIXTURE_V2_T0 = 1_790_000_000_000;
const TV_TOKEN = "0123456789abcdef0123456789abcdef";
const RESUME_TOKEN = "fedcba9876543210fedcba9876543210";
const ENTITLEMENT_TOKEN = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCIsImtpZCI6ImsxIn0.e30.c2ln";

const CAST: { name: string; color: ColorId; id: string; locale: Locale }[] = [
  { name: "Rami", color: "coral", id: "p_0a1b2c3d4e5f60718293a4b5", locale: "en" },
  { name: "Léa", color: "azure", id: "p_1b2c3d4e5f60718293a4b5c6", locale: "fr" },
  { name: "نور", color: "jade", id: "p_2c3d4e5f60718293a4b5c6d7", locale: "ar" },
  { name: "Sam", color: "lemon", id: "p_3d4e5f60718293a4b5c6d7e8", locale: "en" },
  { name: "Zoé", color: "grape", id: "p_4e5f60718293a4b5c6d7e8f9", locale: "fr" },
];
const RAMI = CAST[0]!.id;
const LEA = CAST[1]!.id;
const ZOE = CAST[4]!.id;

const json = (v: unknown): string => JSON.stringify(v, null, 2) + "\n";

/** Returns `v2/<name>` → file content (pretty-printed, trailing newline). */
export function generateFixturesV2(): Map<string, string> {
  const files = new Map<string, string>();
  const put = (name: string, v: unknown): void => {
    files.set(`v2/${name}`, json(v));
  };

  // ---------------- client → server
  put("c2s.hello.tv.json", { v: 2, t: "hello", role: "tv", tvToken: TV_TOKEN, games: ALL_TV_GAMES });
  put("c2s.hello.tv.mishana-only.json", { v: 2, t: "hello", role: "tv", tvToken: TV_TOKEN, games: [{ id: "mishana", v: GAME_DEFS.mishana.meta.VIEW_VERSION }] });
  put("c2s.hello.player.json", { v: 2, t: "hello", role: "player" });
  put("c2s.hello.player.resume.json", { v: 2, t: "hello", role: "player", resumeToken: RESUME_TOKEN });
  put("c2s.join.json", { v: 2, t: "join", name: "Léa", color: "azure", locale: "fr" });
  put("c2s.entitlement.json", { v: 2, t: "entitlement", token: ENTITLEMENT_TOKEN });
  put("c2s.storeOpen.json", { v: 2, t: "storeOpen", open: true });
  files.set("v2/c2s.ping.json", PING_FRAME_V2 + "\n");
  let ref = 0;
  const action = (name: string, a: RoomIntent): void => put(`c2s.action.${name}.json`, { v: 2, t: "action", id: String(++ref), a });
  action("hub_focus", { type: "HUB_FOCUS", gameId: "mishana" });
  action("open_game", { type: "OPEN_GAME", gameId: "mishana" });
  action("close_game", { type: "CLOSE_GAME" });
  action("set_content_locale", { type: "SET_CONTENT_LOCALE", locale: "ar" });
  action("update_game_settings", { type: "UPDATE_GAME_SETTINGS", gameId: "mishana", patch: { roleMode: "custom", undercoverCount: 1, blankCount: 1 } });
  action("start_game", { type: "START_GAME" });
  action("game.mishana.ready", { type: "GAME", gameId: "mishana", i: { type: "READY" } });
  action("game.mishana.clue_done", { type: "GAME", gameId: "mishana", i: { type: "CLUE_DONE" } });
  action("game.mishana.cast_vote", { type: "GAME", gameId: "mishana", i: { type: "CAST_VOTE", targetId: CAST[3]!.id } });
  action("game.mishana.submit_guess", { type: "GAME", gameId: "mishana", i: { type: "SUBMIT_GUESS", text: "Bicycle" } });
  action("game.mishana.host_override_guess", { type: "GAME", gameId: "mishana", i: { type: "HOST_OVERRIDE_GUESS", accept: true } });
  action("game.mishana.host_advance", { type: "GAME", gameId: "mishana", i: { type: "HOST_ADVANCE" } });
  action("replay", { type: "REPLAY" });
  action("back_to_setup", { type: "BACK_TO_SETUP" });
  action("back_to_hub", { type: "BACK_TO_HUB" });
  action("abort_game", { type: "ABORT_GAME" });
  for (const kind of REACTIONS) action(`react.${kind}`, { type: "REACT", kind });
  action("kick", { type: "KICK", playerId: CAST[3]!.id });
  action("leave", { type: "LEAVE" });

  // ---------------- server → client (non-state)
  put("s2c.welcome.json", { v: 2, t: "welcome", playerId: LEA, resumeToken: RESUME_TOKEN, roomCode: "KXRT" });
  files.set("v2/s2c.pong.json", PONG_FRAME_V2 + "\n");
  const error = (name: string, code: ErrorCode, r: string | null): void => put(`s2c.error.${name}.json`, { v: 2, t: "error", code, messageKey: errorMessageKey(code), ref: r });
  error("game_unavailable", "GAME_UNAVAILABLE", "2");
  error("wrong_game", "WRONG_GAME", "7");
  error("not_in_game", "NOT_IN_GAME", "9");
  error("reaction_too_fast", "REACTION_TOO_FAST", "12");
  error("unsupported_version", "UNSUPPORTED_VERSION", null);

  // ---------------- HTTP
  put("http.healthz.json", { ok: true, app: "jamaa", protocol: 2 });
  put("http.config.json", { billing: true, games: ["mishana"] });
  put("http.config.billing_off.json", { billing: false, games: ["mishana"] });

  // ---------------- state views (a free room: free test packs playable, premium ones locked)
  const h = new RoomHarness({ seed: FIXTURE_V2_SEED, now: FIXTURE_V2_T0, roomCode: "KXRT", joinUrl: "https://play.example.workers.dev/KXRT" });
  const state = (name: string, view: unknown): void => put(`s2c.state.${name}.json`, { v: 2, t: "state", seq: h.state.version, serverNow: h.now, view });
  const tv = (name: string): void => state(`tv.${name}`, h.tvView());
  const player = (name: string, id: string | null): void => state(`player.${name}`, h.playerView(id));

  tv("hub.empty");
  for (let i = 0; i < 4; i++) {
    const c = CAST[i]!;
    h.now = FIXTURE_V2_T0 + i;
    h.join(c.id, c.name, c.color, c.locale);
  }
  h.now = FIXTURE_V2_T0 + 1000;
  h.focusedGameId = "mishana";
  tv("hub");
  player("hub", LEA);
  player("hub.host", RAMI);
  player("hub.spectator", null);

  // Each stub game's SETUP extras, projected from a SETUP state for that game (stubs cannot be opened: enabled:false).
  for (const id of GAME_IDS.filter((g): g is Exclude<GameId, "mishana"> => g !== "mishana")) {
    const ctx = { ...h.viewCtx(), enabledGames: GAME_IDS };
    const s = { ...h.state, phase: "SETUP" as const, setupGameId: id };
    put(`s2c.state.tv.setup.${id}.json`, { v: 2, t: "state", seq: h.state.version, serverNow: h.now, view: projectRoomForTv(s, ctx) });
  }

  h.tv({ type: "OPEN_GAME", gameId: "mishana" });
  h.now += 1000;
  h.tv({ type: "UPDATE_GAME_SETTINGS", gameId: "mishana", patch: { roleMode: "custom", undercoverCount: 1, blankCount: 0 } });
  tv("setup.mishana");
  player("setup.mishana", LEA);
  player("setup.mishana.host", RAMI);

  h.now += 1000;
  h.tv({ type: "START_GAME" });
  tv("playing.mishana.role_reveal");
  player("playing.mishana.role_reveal", LEA);
  // A late joiner while PLAYING: benched (Mish Ana! has no `join`), sees the public game view, dealt in at REPLAY.
  h.now += 1000;
  h.join(ZOE, CAST[4]!.name, CAST[4]!.color, CAST[4]!.locale);
  player("playing.mishana.benched", ZOE);

  const seen = new Set<string>();
  h.playMishanaToResults("Zzyzx", (phase) => {
    if (seen.has(phase)) return;
    seen.add(phase);
    if (phase === "CLUES") {
      tv("playing.mishana.clues");
      player("playing.mishana.clues", LEA);
    } else if (phase === "VOTING") {
      tv("playing.mishana.voting");
      player("playing.mishana.voting", LEA);
    } else if (phase === "ELIMINATION") {
      tv("playing.mishana.elimination");
    }
  });
  tv("playing.mishana.results");
  player("playing.mishana.results", LEA);

  h.now += 1000;
  h.tv({ type: "REPLAY" });
  tv("playing.mishana.replay");
  h.now += 1000;
  h.tv({ type: "ABORT_GAME" });
  tv("setup.mishana.after_abort");
  h.now += 1000;
  h.tv({ type: "BACK_TO_HUB" });
  tv("hub.cup");
  // A reaction, as every phone sees it.
  h.now += 1000;
  h.p(LEA, { type: "REACT", kind: "laugh" });
  player("hub.reaction", RAMI);
  return files;
}
