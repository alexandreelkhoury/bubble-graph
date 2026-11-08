// JAMAA-PLATFORM §2.1 / §2.2: GAMES, every registered GameDefinition (server, sim and tests only: pulls the engines
// and zod). G2–G4 lanes only replace files inside their own games/<id>/ folder; this file is touched only in P.
import type { ContentAdapter } from "../content/types";
import { content as bluffContent } from "./bluff/content";
import { definition as bluff } from "./bluff/definition";
import type { GameId } from "./ids";
import { GAME_IDS } from "./ids";
import { content as likelyContent } from "./likely/content";
import { definition as likely } from "./likely/definition";
import { content as mishanaContent } from "./mishana/content";
import { definition as mishana } from "./mishana/definition";
import { content as triviaContent } from "./trivia/content";
import { definition as trivia } from "./trivia/definition";
import type { AnyGameDefinition } from "./types";

export const GAMES = { mishana, bluff, likely, trivia } as const;
export type GameDefinitionOf<K extends GameId> = (typeof GAMES)[K];

/** The registry as the room sees it: type parameters erased (each game's values stay inside its own slot). */
export const GAME_DEFS: { readonly [K in GameId]: AnyGameDefinition } = GAMES;

/** §5.2: each game's content adapter (games/<id>/content.ts). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const GAME_CONTENT: { readonly [K in GameId]: ContentAdapter<any, any> } = {
  mishana: mishanaContent, bluff: bluffContent, likely: likelyContent, trivia: triviaContent,
};

/** Registry-enabled games, in GAME_IDS order (stubs are `enabled: false`). */
export const REGISTRY_ENABLED: readonly GameId[] = GAME_IDS.filter((id) => GAMES[id].enabled);

export { GAME_IDS, isGameId, type GameId } from "./ids";
export { GAME_META } from "./meta";
