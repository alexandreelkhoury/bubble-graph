// JAMAA-PLATFORM §2.1: GAME_META, the ONLY games entry point for clients. Zod-free and engine-free.
import type { GameId } from "./ids";
import { BLUFF_META, type BluffSettings } from "./bluff/meta";
import { LIKELY_META, type LikelySettings } from "./likely/meta";
import { MISHANA_META, type MishanaSettings } from "./mishana/meta";
import { TRIVIA_META, type TriviaSettings } from "./trivia/meta";
import type { GameMeta } from "./types";

export { GAME_IDS, isGameId, type GameId } from "./ids";

/** Each game's Settings type, by id (RoomState.gameSettings, §2.3). */
export interface SettingsById { mishana: MishanaSettings; bluff: BluffSettings; likely: LikelySettings; trivia: TriviaSettings }
export type SettingsOf<K extends GameId> = SettingsById[K];

export const GAME_META: { readonly [K in GameId]: GameMeta<SettingsOf<K>> } = {
  mishana: MISHANA_META,
  bluff: BLUFF_META,
  likely: LIKELY_META,
  trivia: TRIVIA_META,
};
