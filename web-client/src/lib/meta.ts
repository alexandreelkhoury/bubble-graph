// Lazy per-game metadata for the phone (JAMAA-PLATFORM §3.8 budget). `@jamaa/shared/games/<id>/meta` is a client-safe
// entry (§2.1); the phone loads each game's meta only for the games of its room, as its own `game-<id>-meta` chunk
// (counted with that game), instead of pulling GAME_META (all four games) into the core. The /tv mock keeps the
// static GAME_META. A unit test asserts these are exactly GAME_META's values.
import { signal } from "@preact/signals";
import type { GameId } from "@jamaa/shared/games/ids";
import type { GameMeta } from "@jamaa/shared/games/types";
import type * as MishanaMod from "@jamaa/shared/games/mishana/meta";

export type AnyMeta = GameMeta<Record<string, unknown>>;

/** The loaded metas, by id (components re-render when one lands). */
export const metas = signal<Partial<Record<GameId, AnyMeta>>>({});
/** Mish Ana!'s meta module (timer presets for its virtual "Timers" row), once loaded. */
export let mishanaMod: typeof MishanaMod | null = null;

const LOADERS: Record<GameId, () => Promise<AnyMeta>> = {
  mishana: () => import("@jamaa/shared/games/mishana/meta").then((m) => { mishanaMod = m; return m.MISHANA_META as unknown as AnyMeta; }),
  bluff: () => import("@jamaa/shared/games/bluff/meta").then((m) => m.BLUFF_META as unknown as AnyMeta),
  likely: () => import("@jamaa/shared/games/likely/meta").then((m) => m.LIKELY_META as unknown as AnyMeta),
  trivia: () => import("@jamaa/shared/games/trivia/meta").then((m) => m.TRIVIA_META as unknown as AnyMeta),
};
const pending = new Map<GameId, Promise<AnyMeta>>();

/** Loads a game's meta once; resolves with it. */
export function ensureMeta(id: GameId): Promise<AnyMeta> {
  const have = metas.peek()[id];
  if (have) return Promise.resolve(have);
  let p = pending.get(id);
  if (!p) {
    p = LOADERS[id]().then((m) => { metas.value = { ...metas.peek(), [id]: m }; pending.delete(id); return m; });
    pending.set(id, p);
  }
  return p;
}

/** The meta if loaded (reading subscribes the component); undefined until its chunk lands. */
export function metaOf(id: GameId): AnyMeta | undefined {
  return metas.value[id];
}

/** §3.4: each game's world (a fixed table; a unit test checks it against GAME_META). */
export const WORLD_OF: Record<GameId, string> = { mishana: "night-market", bluff: "hakawati-cafe", likely: "rooftop", trivia: "quiz-studio" };
