// Adversarial fuzz: LEAVE, VIP/TV KICK, VIP/TV HOST_ADVANCE and overrides, churn, zero timers, all rule variants.
import { describe, expect, it } from "vitest";
import { COLORS } from "../../src/constants";
import { assertInvariants } from "../../src/engine/invariants";
import { createInitialState, reduce } from "../../src/engine/reduce";
import { createRng } from "../../src/engine/rng";
import { checkWinner } from "../../src/engine/win";
import { TEST_CATALOG } from "../support/test-catalog";
import type { Action, GameState, SettingsPatch } from "../../src/engine/types";

const SYS = { kind: "system" } as const, TV = { kind: "tv" } as const;
const P = (id: string) => ({ kind: "player", playerId: id }) as const;

describe("adversarial fuzz (1,500 games; seeds 336 and 983 hit the Blank-first and left-guesser bugs)", () => {
it("no invariant breaks, stuck games, Blank-first, score/winner mismatches or dead guess windows", { timeout: 300_000 }, () => {
  const issues = new Map<string, string>();
  const note = (k: string, v: string) => { if (!issues.has(k)) issues.set(k, v); };
  for (let seed = 1; seed <= 1500; seed++) {
    const rng = createRng(seed * 7919);
    const n = 3 + rng.int(10);
    let now = 1_790_000_000_000;
    let s: GameState = createInitialState({ roomCode: "FUZZ", joinUrl: "https://example.test/FUZZ", seed, wordLocale: "en" });
    const step = (a: Action) => {
      const prev = s;
      const r = reduce(prev, a, { now, catalog: TEST_CATALOG });
      try { assertInvariants(r.state); } catch (e) { note(String(e), `seed ${seed} after ${a.type} ${JSON.stringify(a.by)} phase ${prev.phase}`); }
      if (!r.ok && r.state !== prev) note("err-changed", `seed ${seed}`);
      if (r.ok && r.state !== prev && r.state.version !== prev.version + 1) note("version", `seed ${seed}`);
      // round-1 actual first speaker
      if (r.ok && r.state.phase === "CLUES" && r.state.round === 1 && prev.phase === "ROLE_REVEAL") {
        const sp = r.state.players.find((p) => p.id === r.state.speakingOrder[r.state.turnIdx]);
        if (sp?.role === "BLANK") note("blank-first-r1", `seed ${seed}`);
      }
      // results consistency
      if (r.ok && r.state.phase === "RESULTS" && prev.phase !== "RESULTS") {
        const res = r.state.result!;
        for (const p of r.state.players) {
          const before = prev.players.find((x) => x.id === p.id)!;
          if (p.score - before.score !== (res.pointsAwarded[p.id] ?? 0)) note("score-mismatch", `seed ${seed}`);
          if (p.left && res.winnerIds.includes(p.id)) note("left-winner", `seed ${seed}`);
        }
        if (res.winner !== "BLANK" && checkWinner(r.state) !== res.winner) note("winner-mismatch", `seed ${seed} ${res.winner} vs ${checkWinner(r.state)}`);
        if (res.winner === "BLANK" && res.winnerIds.length > 1) note("blank-multi", `seed ${seed}`);
      }
      if (r.ok && r.state.phase === "MR_WHITE_GUESS" && r.state.guess?.status === "PENDING") {
        const g = r.state.players.find((p) => p.id === r.state.guess!.playerId);
        if (g?.left) note("left-guesser-pending", `seed ${seed} deadline ${r.state.deadline?.durationMs}`);
      }
      s = r.state;
      return r;
    };
    for (let i = 0; i < n; i++) step({ type: "JOIN", by: SYS, playerId: "p_" + i.toString(16).padStart(24, "0"), name: "N" + i, color: COLORS[i]!.id, locale: "en" } as Action);
    const zero = rng.next() < 0.5;
    const patch: SettingsPatch = {
      winRule: rng.next() < 0.5 ? "official" : "parity", tieBreak: rng.next() < 0.5 ? "random" : "none",
      blankGuess: rng.next() < 0.8,
    };
    if (zero) Object.assign(patch, { clueSeconds: 0, voteSeconds: 0, revealSeconds: 0, guessSeconds: 0 });
    step({ type: "UPDATE_SETTINGS", by: TV, patch } as Action);
    if (!step({ type: "START", by: TV } as Action).ok) continue;
    for (let k = 0; k < 3000 && s.phase !== "LOBBY" && s.phase !== "RESULTS"; k++) {
      now += rng.int(5000);
      const ids = s.players.filter((p) => !p.left).map((p) => p.id);
      const any = ids[rng.int(ids.length)] ?? "p_x";
      const alive = s.players.filter((p) => p.alive && !p.left).map((p) => p.id);
      const tgt = (s.revote ? s.tieCandidates : alive)[rng.int(Math.max(1, (s.revote ? s.tieCandidates : alive).length))] ?? any;
      const host = s.hostPlayerId;
      const x = rng.next();
      let a: Action;
      if (x < 0.03) a = { type: "DISCONNECT", by: SYS, playerId: any };
      else if (x < 0.06) a = { type: "RECONNECT", by: SYS, playerId: any };
      else if (x < 0.075) a = { type: "LEAVE", by: P(any) };
      else if (x < 0.085) a = { type: "KICK", by: host && rng.next() < 0.5 ? P(host) : TV, playerId: any };
      else if (x < 0.15) a = { type: "HOST_ADVANCE", by: host && rng.next() < 0.5 ? P(host) : TV };
      else if (x < 0.2) a = { type: "TICK", by: SYS };
      else if (x < 0.22) { if (s.deadline) now = s.deadline.at; a = { type: "TICK", by: SYS }; }
      else if (x < 0.26) a = { type: "HOST_OVERRIDE_GUESS", by: host && rng.next() < 0.5 ? P(host) : TV, accept: rng.next() < 0.5 };
      else if (s.phase === "ROLE_REVEAL") a = { type: "READY", by: P(any) };
      else if (s.phase === "CLUES" || s.phase === "TIE_BREAK") a = { type: "CLUE_DONE", by: P(s.speakingOrder[s.turnIdx] ?? any) };
      else if (s.phase === "VOTING") a = { type: "CAST_VOTE", by: P(alive[rng.int(alive.length)] ?? any), targetId: tgt };
      else if (s.phase === "MR_WHITE_GUESS") a = { type: "SUBMIT_GUESS", by: P(s.guess!.playerId), text: rng.next() < 0.4 ? s.pair!.civilian.text : "nope" };
      else a = { type: "TICK", by: SYS };
      step(a);
    }
    if (s.phase !== "LOBBY" && s.phase !== "RESULTS") note("stuck", `seed ${seed} phase ${s.phase}`);
  }
  expect([...issues.entries()].map(([k, v]) => k + " :: " + v)).toEqual([]);
});
});
