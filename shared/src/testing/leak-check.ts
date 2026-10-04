// Secret-leak checker (§5.4, §14.1). Used by projection/leak.test.ts and tools/sim.
import type { Catalog } from "../engine/catalog";
import type { GameState } from "../engine/types";
import { projectForPlayer, projectForTv } from "../projection/project";

// Enum-valued keys whose values can never be secret words (guards against accidental collisions with real words).
const ENUM_KEYS = new Set([
  "color", "phase", "kind", "status", "outcome", "cause", "role", "revealedRole", "winRule", "roleMode", "tieBreak",
  "wordLocale", "locale", "ageRating", "winner", "startBlocker",
]);
/** State-only keys that must never appear in any projected view (§5.4). */
export const FORBIDDEN_KEYS: readonly string[] = ["votes", "guessLog", "pair", "alt", "rngState", "usedPairKeys", "deadlineSeq", "disconnectedAt", "joinedAt"];

type Visit = (path: readonly string[], key: string, value: string) => void;

/** Single allocation-light walk: reports every object key (as `key` with value "") and every string leaf. */
function walk(x: unknown, path: string[], onKey: (key: string) => void, onLeaf: Visit): void {
  if (typeof x === "string") {
    onLeaf(path, path[path.length - 1] ?? "", x);
  } else if (Array.isArray(x)) {
    for (let i = 0; i < x.length; i++) {
      path.push(String(i));
      walk(x[i], path, onKey, onLeaf);
      path.pop();
    }
  } else if (x && typeof x === "object") {
    for (const k in x) {
      onKey(k);
      path.push(k);
      walk((x as Record<string, unknown>)[k], path, onKey, onLeaf);
      path.pop();
    }
  }
}

/** Returns a list of violations (empty = no leak). */
export function findLeaks(state: GameState, catalog: Catalog): string[] {
  const errs: string[] = [];
  const results = state.phase === "RESULTS";
  const pair = state.pair;
  const textual = new Set<string>();
  const alts = new Set<string>();
  if (pair) {
    for (const side of [pair.civilian, pair.undercover]) {
      textual.add(side.text);
      if (side.translit) textual.add(side.translit);
      for (const a of side.alt) alts.add(a);
    }
  }
  for (const t of textual) alts.delete(t);
  // Guess texts (correct guesses equal the civilian word; wrong ones are unique tokens) are secret until RESULTS.
  const guessTexts = new Set<string>();
  for (const g of [...state.guessLog, ...(state.guess ? [state.guess] : [])]) if (g.text) guessTexts.add(g.text);

  const check = (label: string, view: unknown, allowed: Set<string>, allowWordPath: (path: readonly string[]) => boolean): void => {
    const forbidden = new Set(FORBIDDEN_KEYS);
    walk(view, [], (k) => {
      if (forbidden.has(k)) errs.push(`${label}: forbidden key "${k}"`);
    }, (path, last, value) => {
      if (ENUM_KEYS.has(last)) return;
      if (alts.has(value)) errs.push(`${label}: alt word at ${path.join(".")}`);
      if (results) return;
      if ((textual.has(value) || guessTexts.has(value)) && !(allowed.has(value) && allowWordPath(path))) {
        errs.push(`${label}: secret at ${path.join(".")}`);
      }
    });
    const v = view as { guess: { text: string | null } | null; players: { id: string; alive: boolean; revealedRole: unknown }[]; result: unknown };
    if (!results && v.guess && v.guess.text !== null) errs.push(`${label}: guess.text before RESULTS`);
    if (!results && v.result !== null) errs.push(`${label}: result before RESULTS`);
    for (const p of v.players) if (p.alive && !results && p.revealedRole !== null) errs.push(`${label}: alive role revealed for ${p.id}`);
  };

  check("tv", projectForTv(state, catalog), new Set(), () => false);
  check("spectator", projectForPlayer(state, catalog, null), new Set(), () => false);
  const isMeWord = (path: readonly string[]): boolean => path[0] === "me" && path[1] === "word";
  for (const p of state.players) {
    const own = new Set<string>();
    if (p.word) {
      own.add(p.word.text);
      if (p.word.translit) own.add(p.word.translit);
    }
    const view = projectForPlayer(state, catalog, p.id);
    check(`player ${p.id}`, view, own, isMeWord);
    const me = view.me;
    if (me && !results && me.role !== null && !state.settings.revealRoles && p.alive) errs.push(`player ${p.id}: own role shown while alive`);
    if (me && me.myVote !== null && state.phase !== "VOTING") errs.push(`player ${p.id}: myVote outside VOTING`);
  }
  return errs;
}
