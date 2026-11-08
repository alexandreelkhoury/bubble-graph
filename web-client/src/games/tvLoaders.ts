// The `/tv` mock's lazy game loader map: one `tv-mock-game-<id>` chunk per game. Touched only in P.
import type { GameId } from "@jamaa/shared/games/ids";
import type { TvGameModule } from "./types";

export const TV_GAMES: Record<GameId, () => Promise<TvGameModule>> = {
  mishana: () => import("./mishana/tv"),
  bluff: () => import("./bluff/tv"),
  likely: () => import("./likely/tv"),
  trivia: () => import("./trivia/tv"),
};
