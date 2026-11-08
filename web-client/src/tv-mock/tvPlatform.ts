// JAMAA-PLATFORM §3.10 E, the TV input rule (binding on every /tv screen):
//  1. while a choreography runs, OK only completes it and is consumed; D-pad input is ignored until it ends;
//  2. every screen reached through a transition ignores OK and D-pad for INPUT_GUARD_MS after it becomes interactive;
//  3. key-repeat never activates a button (it may only move focus).
// Plus the per-device TV prefs of the hub (intro seen, per game) and the results hand-off signal.
import { signal } from "@preact/signals";
import { INPUT_GUARD_MS } from "@jamaa/shared/constants";
import type { GameId } from "@jamaa/shared/games/ids";
import { BRAND } from "@jamaa/shared/brand";
import type { Run } from "../motion/runner";
import { readRaw, removeRaw, writeRaw } from "../lib/storage";

/** True once the game's own results screen has settled (e.g. Mish Ana!'s stage 2): the platform bar may appear. */
export const resultsSettled = signal(false);
/** A choreography is running (portal, entrance, cup): read by screens that must not take focus yet. */
export const choreoActive = signal(false);

let current: Run | null = null;
let guardUntil = 0;
const now = (): number => (typeof performance !== "undefined" ? performance.now() : Date.now());

/** Registers the running choreography (OK completes it). Pass null when it ends. */
export function setChoreo(r: Run | null): void {
  current = r;
  choreoActive.value = r !== null;
}

/** Rule 2: ignore OK and D-pad for `ms` from now. */
export function armGuard(ms: number = INPUT_GUARD_MS): void {
  guardUntil = Math.max(guardUntil, now() + ms);
}
export function guarded(t: number = now()): boolean {
  return t < guardUntil;
}

const OK_KEYS = new Set(["Enter", " ", "NumpadEnter"]);
const ARROWS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);
export type KeyVerdict = "pass" | "complete" | "swallow";

/** The rule as a pure decision (unit-tested): what to do with a key given the choreography and guard state. */
export function keyVerdict(e: { key: string; repeat: boolean }, running: boolean, isGuarded: boolean): KeyVerdict {
  const ok = OK_KEYS.has(e.key);
  if (running) return ok && !e.repeat ? "complete" : ok || ARROWS.has(e.key) ? "swallow" : "pass";
  if (isGuarded && (ok || ARROWS.has(e.key))) return "swallow";
  if (ok && e.repeat) return "swallow";
  return "pass";
}

/** Capture-phase keydown handler for the canvas window; true when the key was consumed. */
export function applyInputRule(e: KeyboardEvent): boolean {
  if ((e.target as HTMLElement | null)?.tagName === "INPUT") return false;
  const v = keyVerdict(e, current !== null, guarded());
  if (v === "pass") return false;
  e.preventDefault();
  e.stopImmediatePropagation();
  if (v === "complete") current?.complete();
  return true;
}

/** HUB-03: the first-time intro is per TV (`intro_seen_<gameId>`; the /tv mock keeps it in its own key). */
const introKey = (id: GameId): string => `${BRAND.storagePrefix}:tv:introSeen:${id}`;
export function tvIntroSeen(id: GameId): boolean { return readRaw(introKey(id)) === "1"; }
export function markTvIntroSeen(id: GameId): void { writeRaw(introKey(id), "1"); }
export function clearTvIntroFlags(ids: readonly GameId[]): void { for (const id of ids) removeRaw(introKey(id)); }
