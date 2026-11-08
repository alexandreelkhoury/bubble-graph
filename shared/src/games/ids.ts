// JAMAA-PLATFORM §2.2: the registered games, in hub (registry) order. Zod-free.
export const GAME_IDS = ["mishana", "bluff", "likely", "trivia"] as const;
export type GameId = (typeof GAME_IDS)[number];

export function isGameId(v: unknown): v is GameId {
  return typeof v === "string" && (GAME_IDS as readonly string[]).includes(v);
}
