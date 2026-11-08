// JAMAA-PLATFORM §2.8 generic leak checker: after a step, the TV view and every member's view contain no leaf equal to
// one of `game.secretsFor(state, viewer)`, `game.leakCheck` finds nothing, and no forbidden key appears anywhere.
// Benched members and spectators get the TV-equivalent game view. Run it on synthetic catalogs only (§2.2).
import { GAME_DEFS } from "../games/registry";
import type { RoomHarness } from "./room";

/** Room-level state-only keys that never appear in a view. */
export const ROOM_FORBIDDEN_KEYS: readonly string[] = ["rngState", "tvGames", "gameSettings", "settingsSchema", "matchScores", "disconnectedAt", "joinedAt", "memory"];

function walk(x: unknown, path: string[], onKey: (k: string, path: readonly string[]) => void, onLeaf: (v: unknown, path: readonly string[]) => void): void {
  if (Array.isArray(x)) {
    x.forEach((v, i) => {
      path.push(String(i));
      walk(v, path, onKey, onLeaf);
      path.pop();
    });
  } else if (x !== null && typeof x === "object") {
    for (const k of Object.keys(x)) {
      onKey(k, path);
      path.push(k);
      walk((x as Record<string, unknown>)[k], path, onKey, onLeaf);
      path.pop();
    }
  } else onLeaf(x, path);
}

export function findRoomLeaks(h: RoomHarness): string[] {
  const errs: string[] = [];
  const g = h.state.game;
  const def = g ? GAME_DEFS[g.id] : null;
  const forbidden = new Set([...ROOM_FORBIDDEN_KEYS, ...(def ? def.forbiddenKeys : [])]);
  const check = (label: string, view: unknown, viewer: string | null): void => {
    const secrets = new Set(g && def ? def.secretsFor(g.state, viewer) : []);
    walk(view, [], (k, path) => {
      // `settings` (setup and Mish Ana!'s public settings) is public by design; everything else is checked.
      if (forbidden.has(k)) errs.push(`${label}: forbidden key "${k}" at ${path.join(".")}`);
    }, (v, path) => {
      if (secrets.has(v)) errs.push(`${label}: secret at ${path.join(".")}`);
    });
    if (g && def) for (const e of def.leakCheck(g.state, viewer, view)) errs.push(`${label}: ${e}`);
  };
  check("tv", h.tvView(), null);
  check("spectator", h.playerView(null), null);
  for (const m of h.state.members) {
    const inGame = !m.benched && !m.left;
    check(`player ${m.id}`, h.playerView(m.id), inGame ? m.id : null);
  }
  return errs;
}
