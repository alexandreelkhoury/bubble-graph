import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { TvView } from "@mishana/shared/protocol";
import lobbyMsg from "@mishana/shared/fixtures/s2c.state.tv.lobby.json";
import revealMsg from "@mishana/shared/fixtures/s2c.state.tv.role_reveal.json";
import cluesMsg from "@mishana/shared/fixtures/s2c.state.tv.clues.json";
import votingMsg from "@mishana/shared/fixtures/s2c.state.tv.voting.json";
import guessMsg from "@mishana/shared/fixtures/s2c.state.tv.mr_white_guess.json";
import resultsMsg from "@mishana/shared/fixtures/s2c.state.tv.results.json";
import tieMsg from "@mishana/shared/fixtures/s2c.state.tv.tie_break.json";
import {
  CUE_IDS, busOf, chipRate, cueFile, deadlineCue, joinRate, PENTATONIC, RateLimiter, timelineCues, turnRate, viewCues,
} from "../src/tv-mock/sound/cues";

const v = (m: { view: unknown }): TvView => structuredClone(m.view) as TvView;
const lobby = v(lobbyMsg), reveal = v(revealMsg), clues = v(cluesMsg), voting = v(votingMsg);
const guess = v(guessMsg), results = v(resultsMsg), tie = v(tieMsg);
const ids = (list: { cue: string }[]): string[] => list.map((c) => c.cue);

describe("sound cue files", () => {
  it("every cue has a generated OGG (tools/gen-sounds) and nothing else ships", () => {
    const files = readdirSync(resolve(__dirname, "../public/sounds")).filter((f) => f.endsWith(".ogg")).sort();
    expect(files).toEqual(CUE_IDS.map((c) => `${cueFile(c)}.ogg`).sort());
  });
  it("names files like Android res/raw and sorts cues into buses", () => {
    expect(cueFile("sting.winInfiltrators")).toBe("sting_win_infiltrators");
    expect(busOf("sting.mole")).toBe("sting");
    expect(busOf("ui.move")).toBe("ui");
    expect(busOf("sfx.tick")).toBe("sfx");
  });
});

describe("view → cues", () => {
  it("is silent on the first view", () => {
    expect(viewCues(null, lobby)).toEqual([]);
  });
  it("pops a join pitched by seat, a pluck on leave", () => {
    const less = { ...lobby, players: lobby.players.slice(0, 2) };
    const joined = viewCues(less, lobby);
    expect(ids(joined)).toEqual(["sfx.join", "sfx.join"]);
    expect(joined[0]!.rate).toBeCloseTo(joinRate(2));
    expect(joined[1]!.rate).not.toBeCloseTo(joined[0]!.rate!);
    expect(ids(viewCues(lobby, less))).toEqual(["sfx.leave"]);
  });
  it("deals the cards when a game starts", () => {
    expect(ids(viewCues(lobby, reveal))).toEqual(["sfx.flip"]);
  });
  it("ticks for each new 'Got it', then rises when everyone is ready, then the first speaker's snap + bell", () => {
    const one = { ...reveal, players: reveal.players.map((p, i) => ({ ...p, ready: i === 0 })) };
    expect(ids(viewCues(reveal, one))).toEqual(["sfx.ready"]);
    const start = viewCues(one, clues);
    expect(ids(start)).toEqual(["sfx.allReady", "sfx.turn"]);
    expect(start[1]!.delayMs).toBeGreaterThan(0);
  });
  it("snaps on each speaker change with a different pitch", () => {
    const next = { ...clues, currentSpeakerId: clues.speakingOrder[1]! };
    const c = viewCues(clues, next);
    expect(ids(c)).toEqual(["sfx.turn"]);
    expect(c[0]!.rate).toBeCloseTo(turnRate(1));
    expect(turnRate(1)).not.toBeCloseTo(turnRate(0));
    expect(viewCues(clues, clues)).toEqual([]);
  });
  it("flicks once per vote received (no identity)", () => {
    expect(ids(viewCues({ ...voting, votesCast: 0 }, voting))).toEqual(["sfx.voteCast", "sfx.voteCast"]);
    expect(viewCues(voting, voting)).toEqual([]);
  });
  it("stamps the tie, then the tie speaker's turn", () => {
    expect(ids(viewCues(voting, tie))).toEqual(["sfx.stamp", "sfx.turn"]);
  });
  it("plays the Blank's verdict", () => {
    const pending = { ...guess, guess: { ...guess.guess!, status: "PENDING" as const } };
    expect(ids(viewCues(pending, guess))).toEqual(["sting.wrong"]);
    expect(ids(viewCues(pending, { ...guess, guess: { ...guess.guess!, status: "CORRECT" } }))).toEqual(["sting.correct"]);
    expect(ids(viewCues(pending, { ...guess, guess: { ...guess.guess!, status: "TIMEOUT" } }))).toEqual(["sfx.timeUp"]);
  });
  it("plays the winners' sting on Results", () => {
    const before = { ...voting, gameNumber: results.gameNumber };
    expect(ids(viewCues(before, results))).toEqual(["sting.winCivilians"]);
    const inf = { ...results, result: { ...results.result!, winner: "BLANK" as const } };
    expect(ids(viewCues(before, inf))).toEqual(["sting.winInfiltrators"]);
  });
  it("plucks when a player forfeits mid-game", () => {
    const left = { ...clues, history: [...clues.history, { round: 1, eliminatedId: clues.players[0]!.id, role: "CIVILIAN" as const, cause: "LEAVE" as const }] };
    expect(ids(viewCues(clues, left))).toContain("sfx.leave");
  });
});

describe("deadline cues", () => {
  it("ticks the last 5 s of a turn/vote/reveal timer, the last one higher, then the horn", () => {
    expect(deadlineCue("CLUE", 5100, 4990)).toBe("sfx.tick");
    expect(deadlineCue("VOTE", 2050, 1950)).toBe("sfx.tick");
    expect(deadlineCue("REVEAL", 1010, 990)).toBe("sfx.tickLast");
    expect(deadlineCue("CLUE", 80, 0)).toBe("sfx.timeUp");
    expect(deadlineCue("CLUE", 6100, 5900)).toBeNull();
    expect(deadlineCue("CLUE", 4900, 4800)).toBeNull();
  });
  it("beats a heartbeat on the Blank's guess: every 2 s from 10 s, then every second", () => {
    const beats = [];
    for (let ms = 12_000; ms > 0; ms -= 100) if (deadlineCue("GUESS", ms + 100, ms)) beats.push(ms);
    expect(beats).toEqual([10_000, 8_000, 6_000, 5_000, 4_000, 3_000, 2_000, 1_000]);
  });
  it("keeps holds silent and never plays a stale crossing (first sample, a jump, a reset)", () => {
    expect(deadlineCue("ELIMINATION", 3100, 2900)).toBeNull();
    expect(deadlineCue("VERDICT", 1100, 900)).toBeNull();
    expect(deadlineCue("CLUE", null, 900)).toBeNull();
    expect(deadlineCue("CLUE", 4000, 900)).toBeNull();
    expect(deadlineCue("CLUE", 900, 30_000)).toBeNull();
  });
});

describe("timeline + limiter", () => {
  const marks = [{ at: 0, cue: "sfx.drumroll" as const }, { at: 2400, cue: "sfx.stamp" as const }, { at: 4000, cue: "sfx.flip" as const }];
  it("plays a mark as the clock crosses it, once", () => {
    expect(ids(timelineCues(marks, -1, 0))).toEqual(["sfx.drumroll"]);
    expect(timelineCues(marks, 0, 16)).toEqual([]);
    expect(ids(timelineCues(marks, 2390, 2406))).toEqual(["sfx.stamp"]);
  });
  it("stays silent for marks a skip jumps over", () => {
    expect(timelineCues(marks, 100, 5000)).toEqual([]);
  });
  it("rate-limits the focus tick", () => {
    const r = new RateLimiter(70);
    expect([r.allow(0), r.allow(30), r.allow(70), r.allow(100), r.allow(141)]).toEqual([true, false, true, false, true]);
  });
  it("keeps pitch shifts inside SoundPool's 0.5–2× range", () => {
    for (let s = 0; s < 12; s++) expect(joinRate(s)).toBeGreaterThanOrEqual(0.5);
    for (let s = 0; s < 12; s++) expect(joinRate(s)).toBeLessThanOrEqual(2);
    for (let n = 1; n < 12; n++) expect(chipRate(n)).toBeLessThanOrEqual(2);
    expect(chipRate(2)).toBeGreaterThan(chipRate(1));
    expect(PENTATONIC).toHaveLength(11);
  });
});
