// Scripted Bluff driver for the G2 tests: a clock, `definition.reduce`, and after EVERY dispatch the engine invariants
// plus the leak oracles on the TV view and every player's view (synthetic token catalog, JAMAA-PLATFORM §2.2).
import { expect } from "vitest";
import type { Locale } from "../../../src/constants";
import { definition } from "../../../src/games/bluff/definition";
import type { BluffCatalog, BluffType } from "../../../src/games/bluff/engine/catalog";
import { slotKind } from "../../../src/games/bluff/engine/reduce";
import type { BluffIntent, BluffSettings, BluffState } from "../../../src/games/bluff/engine/state";
import type { ErrorCode } from "../../../src/protocol/errors";
import type { GameAction, GameActor, GameReduceResult, RosterEntry } from "../../../src/games/types";
import { BLUFF_GRACE, BLUFF_T0, findBluffLeaks } from "../../../src/testing/bots/bluff";
import { bluffPack, bluffTokenCatalog, bluffTokenItem } from "../../../src/testing/catalogs/bluff";

export const T0 = BLUFF_T0;
export const GRACE = BLUFF_GRACE;
export { bluffPack as pack, bluffTokenItem as item };

/** The synthetic catalog with all items free (tiers do not matter to engine tests; access is tested separately). */
export function synthCatalog(n: { sayings?: number; facts?: number; words?: number; finals?: number } = {}): BluffCatalog {
  const c = bluffTokenCatalog({ words: 0, ...n });
  return { packs: c.packs.filter((p) => p.items.length > 0).map((p) => ({ ...p, items: p.items.map((i) => ({ ...i, tier: "free" as const })) })) };
}

export const pid = (i: number): string => `p${i}`;
export const P = (playerId: string): GameActor => ({ kind: "player", playerId });
export const TV: GameActor = { kind: "tv" };

export interface GOpts { players?: number; seed?: number; settings?: Partial<BluffSettings>; cat?: BluffCatalog; locale?: Locale; host?: string | null; usedKeys?: string[]; ids?: string[] }

export class G {
  s: BluffState;
  now = T0;
  cat: BluffCatalog;
  host: string | null;
  checkLeaks = true;
  constructor(o: GOpts = {}) {
    this.cat = o.cat ?? synthCatalog();
    const ids = o.ids ?? Array.from({ length: o.players ?? 4 }, (_, i) => pid(i + 1));
    const roster: RosterEntry[] = ids.map((id, i) => ({ id, seat: i, locale: o.locale ?? "en", connected: true, carryScore: 0 }));
    const settings: BluffSettings = { packIds: [], length: "normal", pace: "normal", ...o.settings };
    const r = definition.start({ roster, settings, locale: o.locale ?? "en", memory: { usedKeys: o.usedKeys ?? [] }, seed: o.seed ?? 7, now: this.now, graceMs: GRACE, content: this.cat });
    if (!r.ok) throw new Error(`start failed: ${r.error}`);
    this.s = r.state;
    this.host = o.host === undefined ? (ids[0] ?? null) : o.host;
    this.after();
  }
  get ids(): string[] {
    return this.s.players.map((p) => p.id);
  }
  ctx() {
    return { now: this.now, content: this.cat, isHost: (a: GameActor) => a.kind === "tv" || a.playerId === this.host, hostPlayerId: this.host };
  }
  after(): void {
    definition.assertInvariants(this.s);
    if (this.checkLeaks) expect(findBluffLeaks(this.s, this.cat)).toEqual([]);
  }
  dispatch(a: GameAction<BluffIntent>): GameReduceResult<BluffState> {
    const before = this.s;
    const snap = JSON.stringify(before);
    const r = definition.reduce(before, a, this.ctx());
    if (JSON.stringify(before) !== snap) throw new Error("reduce mutated its input");
    if (!r.ok && r.state !== before) throw new Error("a failed reduce must return its input");
    for (const p of before.players) {
      const q = r.state.players.find((x) => x.id === p.id);
      if (q && q.score < p.score) throw new Error(`score went down for ${p.id}`);
    }
    this.s = r.state;
    this.after();
    return r;
  }
  do(i: BluffIntent, by: GameActor = TV): BluffState {
    const r = this.dispatch({ type: "INTENT", intent: i, by });
    if (!r.ok) throw new Error(`${i.type} by ${JSON.stringify(by)} failed: ${r.error} (phase ${this.s.phase})`);
    return r.state;
  }
  err(i: BluffIntent, by: GameActor = TV): ErrorCode {
    const r = this.dispatch({ type: "INTENT", intent: i, by });
    if (r.ok) throw new Error(`${i.type} unexpectedly ok`);
    return r.error;
  }
  tick(): void {
    if (this.s.deadline === null) throw new Error(`no deadline in ${this.s.phase}`);
    this.now = Math.max(this.now, this.s.deadline);
    this.dispatch({ type: "TICK" });
  }
  advance(ms: number): void {
    this.now += ms;
  }
  untilPhase(ph: BluffState["phase"], max = 60): void {
    for (let i = 0; i < max && this.s.phase !== ph; i++) this.tick();
    if (this.s.phase !== ph) throw new Error(`never reached ${ph}, at ${this.s.phase}`);
  }
  toWriting(kind: "saying" | "fact" | "noTruth"): void {
    for (let i = 0; i < 80; i++) {
      if (this.s.phase === "WRITING" && slotKind(this.s) === kind) return;
      this.tick();
    }
    throw new Error(`no ${kind} WRITING`);
  }
  promptId(): string {
    return (this.s.prompt as NonNullable<BluffState["prompt"]>).id;
  }
  submit(p: string, text: string): GameReduceResult<BluffState> {
    return this.dispatch({ type: "INTENT", intent: { type: "SUBMIT_LIE", text, promptId: this.promptId() }, by: P(p) });
  }
  allSubmit(except: string[] = []): void {
    for (const p of this.s.players) if (!except.includes(p.id) && p.connected && !p.left && !p.waiting && this.s.phase === "WRITING") this.submit(p.id, lieFor(p.id, this.s));
  }
  truth(): string {
    return (this.s.prompt as NonNullable<BluffState["prompt"]>).truthText as string;
  }
  optionOf(text: string): string {
    const o = this.s.options.find((x) => x.text === text);
    if (!o) throw new Error(`no option "${text}" among ${this.s.options.map((x) => x.text).join(" | ")}`);
    return o.id;
  }
  truthOption(): string {
    return (this.s.options.find((o) => o.kind === "truth") as { id: string }).id;
  }
  vote(p: string, optionId: string): void {
    this.do({ type: "VOTE", optionId }, P(p));
  }
  pub() {
    return definition.projectPublic(this.s, this.cat);
  }
  me(p: string) {
    return definition.projectMe(this.s, p, this.cat);
  }
  score(p: string): number {
    return (this.s.players.find((x) => x.id === p) as { score: number }).score;
  }
}

/** A unique, pronounceable-ish lie per (player, prompt, salt): never collides with another player's. */
export function lieFor(p: string, s: BluffState, salt = ""): string {
  const letters = "bcdfghjklmnpqrstvwxz";
  let h = 0;
  for (const ch of `${p}|${s.prompt?.id}|${salt}`) h = (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0;
  let w = "";
  for (let i = 0; i < 9; i++) {
    w += letters[h % letters.length];
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0;
  }
  return `Fib ${w}`;
}

export type { BluffType };
