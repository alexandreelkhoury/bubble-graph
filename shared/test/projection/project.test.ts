import { describe, expect, it } from "vitest";
import { fullAccess, projectForPlayer, projectForTv, projectPublic } from "../../src/projection/project";
import { PlayerViewSchema, TvViewSchema } from "../../src/protocol/views";
import { inClues, lobby, P, pid, TEST_CATALOG } from "../../src/testing";

const KEYS = [
  "roomCode", "joinUrl", "phase", "gameNumber", "round", "settings", "players", "hostPlayerId", "roleCounts", "canStart",
  "startBlocker", "speakingOrder", "currentSpeakerId", "revote", "tieCandidates", "deadline", "votesCast", "votesExpected",
  "lastVote", "eliminated", "guess", "result", "history", "availablePacks", "premium", "lockedPacks", "tvBusy", "poolExhausted",
];
const FULL = fullAccess(TEST_CATALOG);

describe("projection (§5)", () => {
  it("key order of PublicView, PublicPlayer and Me", () => {
    const g = inClues(4);
    const tv = projectForTv(g.state, TEST_CATALOG, FULL);
    expect(Object.keys(tv)).toEqual(["kind", ...KEYS]);
    expect(Object.keys(tv.players[0]!)).toEqual(["id", "name", "color", "seat", "connected", "alive", "left", "isHost", "ready", "spoke", "hasVoted", "revealedRole", "score"]);
    const pv = projectForPlayer(g.state, TEST_CATALOG, pid(1), FULL);
    expect(Object.keys(pv)).toEqual(["kind", ...KEYS, "me"]);
    expect(Object.keys(pv.me!)).toEqual(["id", "word", "isBlank", "role", "myVote"]);
    TvViewSchema.parse(tv);
    PlayerViewSchema.parse(pv);
  });
  it("LOBBY: roleCounts computed, startBlocker order, availablePacks filtered", () => {
    const g = lobby(2);
    let v = projectPublic(g.state, TEST_CATALOG, FULL);
    expect(v.startBlocker).toBe("NOT_ENOUGH_PLAYERS");
    expect(v.roleCounts).toBeNull();
    expect(v.canStart).toBe(false);
    g.join(2);
    v = projectPublic(g.state, TEST_CATALOG, FULL);
    expect(v.roleCounts).toEqual({ civilian: 2, undercover: 0, blank: 1 });
    expect(v.canStart).toBe(true);
    expect(v.availablePacks.map((p) => p.id)).toEqual(["test-en-01", "test-en-prem-01"]);
    expect(v.availablePacks[0]).toEqual({ id: "test-en-01", locale: "en", title: { en: "Test pack", fr: "Paquet de test", ar: "حزمة اختبار" }, pairCount: 10, ageRating: "all", tier: "free" });
    g.tv({ type: "UPDATE_SETTINGS", patch: { familyFilter: false, difficulties: [3] } });
    v = projectPublic(g.state, TEST_CATALOG, FULL);
    expect(v.availablePacks.map((p) => [p.id, p.pairCount])).toEqual([["test-en-01", 2], ["test-en-prem-01", 0], ["test-en-teen-01", 0]]);
    g.tv({ type: "UPDATE_SETTINGS", patch: { roleMode: "custom", undercoverCount: 2 } });
    expect(projectPublic(g.state, TEST_CATALOG, FULL).startBlocker).toBe("INVALID_ROLE_CONFIG");
    g.tv({ type: "UPDATE_SETTINGS", patch: { roleMode: "auto", wordLocale: "fr", difficulties: [3] } });
    expect(projectPublic(g.state, TEST_CATALOG, FULL).startBlocker).toBe("NO_WORDS_AVAILABLE");
    g.tv({ type: "UPDATE_SETTINGS", patch: { wordLocale: "ar", difficulties: [1, 2, 3] } });
    expect(projectPublic(g.state, TEST_CATALOG, FULL).availablePacks.map((p) => p.locale)).toEqual(["ar-LB", "ar"]);
  });
  it("in-game: currentSpeakerId/speakingOrder, votes counts, me.word/role/myVote, revealRoles", () => {
    const g = inClues(4, { revealRoles: true });
    const v = projectForPlayer(g.state, TEST_CATALOG, pid(0), FULL);
    expect(v.currentSpeakerId).toBe(g.speaker());
    expect(v.speakingOrder).toEqual(g.state.speakingOrder);
    expect(v.me?.role).toBe(g.get(pid(0)).role);
    expect(v.availablePacks).toEqual([]);
    expect(v.canStart).toBe(false);
    expect(v.startBlocker).toBeNull();
    g.speakAll();
    g.p(pid(0), { type: "CAST_VOTE", targetId: pid(1) });
    g.do({ type: "DISCONNECT", by: { kind: "system" }, playerId: pid(3) });
    const w = projectForPlayer(g.state, TEST_CATALOG, pid(0), FULL);
    expect(w.speakingOrder).toEqual([]);
    expect(w.currentSpeakerId).toBeNull();
    expect(w.votesCast).toBe(1);
    expect(w.votesExpected).toBe(3);
    expect(w.me?.myVote).toBe(pid(1));
    expect(w.players.find((p) => p.id === pid(0))?.hasVoted).toBe(true);
    expect(projectForPlayer(g.state, TEST_CATALOG, pid(1), FULL).me?.myVote).toBeNull();
    expect(projectForPlayer(g.state, TEST_CATALOG, null, FULL).me).toBeNull();
    expect(projectForPlayer(g.state, TEST_CATALOG, pid(99), FULL).me).toBeNull();
    expect(g.err({ type: "READY", by: P(pid(0)) })).toBe("WRONG_PHASE");
  });
  it("LOBBY me: no word, not blank, no role", () => {
    const g = lobby(3);
    expect(projectForPlayer(g.state, TEST_CATALOG, pid(0), FULL).me).toEqual({ id: pid(0), word: null, isBlank: false, role: null, myVote: null });
  });
});
