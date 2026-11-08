// Per-game lint registry (JAMAA-PLATFORM §5.5). P creates every entry; each G lane replaces only its own module.
import type { GameId } from "../platform";
import type { GameLint } from "./types";
import { lint as bluff } from "./bluff";
import { lint as likely } from "./likely";
import { lint as mishana } from "./mishana";
import { lint as trivia } from "./trivia";

export const GAME_LINTS: { readonly [K in GameId]: GameLint } = { mishana, bluff, likely, trivia };
export type { GameLint, ParsedPack } from "./types";
