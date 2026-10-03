import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PING_FRAME, PONG_FRAME } from "../../src/constants";
import { CreateRoomRequest, CreateRoomResponse, Healthz, HttpError } from "../../src/protocol/http";
import { ClientMessageSchema, ServerMessageSchema } from "../../src/protocol/messages";
import { errorMessageKey } from "../../src/protocol/errors";
import { generateFixtures } from "../../scripts/fixture-scenario";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "fixtures");
const files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
const read = (f: string): string => readFileSync(join(dir, f), "utf8");

const VIEW_KEYS = [
  "kind", "roomCode", "joinUrl", "phase", "gameNumber", "round", "settings", "players", "hostPlayerId", "roleCounts", "canStart",
  "startBlocker", "speakingOrder", "currentSpeakerId", "revote", "tieCandidates", "deadline", "votesCast", "votesExpected",
  "lastVote", "eliminated", "guess", "result", "history", "availablePacks",
];

describe("fixtures (§10)", () => {
  it("the full file set exists", () => {
    const expected = [
      "c2s.hello.tv.json", "c2s.hello.player.json", "c2s.hello.player.resume.json", "c2s.join.json", "c2s.ping.json",
      ...["update_settings", "start", "host_advance", "host_override_guess", "kick", "play_again", "back_to_lobby", "ready", "clue_done", "cast_vote", "submit_guess", "leave"].map((a) => `c2s.action.${a}.json`),
      "s2c.welcome.json", "s2c.error.json", "s2c.pong.json", "s2c.state.tv.voting.json", "s2c.state.player.clues.json",
      ...["lobby", "role_reveal", "clues", "tie_break", "elimination", "mr_white_guess", "results"].map((p) => `s2c.state.tv.${p}.json`),
      ...["lobby_spectator", "lobby", "role_reveal_blank", "voting", "mr_white_guess_guesser", "results"].map((p) => `s2c.state.player.${p}.json`),
      "http.create_room.request.json", "http.create_room.response.json", "http.error.json", "http.healthz.json",
    ].sort();
    expect(files).toEqual(expected);
    for (const f of files) expect(read(f).endsWith("\n")).toBe(true);
  });

  it.each(files.filter((f) => f.startsWith("c2s.")))("%s parses with ClientMessageSchema", (f) => {
    const raw = read(f);
    if (f === "c2s.ping.json") {
      expect(raw).toBe(PING_FRAME + "\n");
      return;
    }
    expect(ClientMessageSchema.safeParse(JSON.parse(raw)).success).toBe(true);
  });

  it.each(files.filter((f) => f.startsWith("s2c.")))("%s parses with ServerMessageSchema", (f) => {
    const json = JSON.parse(read(f));
    const r = ServerMessageSchema.safeParse(json);
    if (!r.success) throw new Error(JSON.stringify(r.error.issues.slice(0, 3)));
    if (json.t === "state") {
      const keys = json.view.kind === "player" ? [...VIEW_KEYS, "me"] : VIEW_KEYS;
      expect(Object.keys(json.view)).toEqual(keys);
    }
    if (json.t === "error") expect(json.messageKey).toBe(errorMessageKey(json.code));
    if (f === "s2c.pong.json") expect(JSON.stringify(json)).toBe(PONG_FRAME);
  });

  it("http fixtures parse with the HTTP schemas", () => {
    expect(CreateRoomRequest.parse(JSON.parse(read("http.create_room.request.json")))).toEqual({ locale: "fr" });
    expect(CreateRoomResponse.safeParse(JSON.parse(read("http.create_room.response.json"))).success).toBe(true);
    expect(HttpError.safeParse(JSON.parse(read("http.error.json"))).success).toBe(true);
    expect(Healthz.safeParse(JSON.parse(read("http.healthz.json"))).success).toBe(true);
  });

  it("check:fixtures is clean (generated files are up to date)", () => {
    for (const [name, content] of generateFixtures()) expect(read(name), name).toBe(content);
  });

  it("schemas reject malformed client messages", () => {
    const bad = [
      { v: 1, t: "hello", role: "tv" },
      { v: 1, t: "hello", role: "tv", tvToken: "0123456789abcdef0123456789abcdef", extra: 1 },
      { v: 1, t: "join", name: "", color: "azure", locale: "fr" },
      { v: 1, t: "join", name: "x", color: "blue", locale: "fr" },
      { v: 1, t: "action", a: { type: "UPDATE_SETTINGS", patch: { bogus: 1 } } },
      { v: 1, t: "action", a: { type: "UPDATE_SETTINGS", patch: { points: { civilian: 1 } } } },
      { v: 1, t: "action", id: "bad id!", a: { type: "START" } },
      { v: 1, t: "action", a: { type: "CAST_VOTE", targetId: "nope" } },
      { v: 1, t: "action", a: { type: "SUBMIT_GUESS", text: "x".repeat(201) } },
      { v: 1, t: "action", a: { type: "START", extra: true } },
      { v: 2, t: "action", a: { type: "START" } },
    ];
    for (const b of bad) expect(ClientMessageSchema.safeParse(b).success, JSON.stringify(b)).toBe(false);
  });
});
