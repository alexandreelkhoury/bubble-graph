// Content registry (JAMAA-PLATFORM §5.1). Each game lists its packs in content/<game id>/index.ts (owned by that game's
// lane D); this file only gathers them. Packs are raw JSON here: consumers validate them (server, sim, tests, content-lint).
import { PACKS as bluff } from "./bluff/index";
import { PACKS as likely } from "./likely/index";
import { PACKS as mishana } from "./mishana/index";
import { PACKS as trivia } from "./trivia/index";

export const CONTENT: { readonly mishana: readonly unknown[]; readonly bluff: readonly unknown[]; readonly likely: readonly unknown[]; readonly trivia: readonly unknown[] } = {
  mishana,
  bluff,
  likely,
  trivia,
};

/** Mish Ana!'s word packs. Kept for the existing consumers until they read `CONTENT.mishana`. */
export const PACKS: readonly unknown[] = CONTENT.mishana;
