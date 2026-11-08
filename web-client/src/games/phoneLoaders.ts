// The phone's lazy game loader map (JAMAA-PLATFORM §3.8): one `game-<id>` chunk per game. Touched only in P.
import type { GameId } from "@jamaa/shared/games/ids";
import type { PhoneGameModule } from "./types";

export const PHONE_GAMES: Record<GameId, () => Promise<PhoneGameModule>> = {
  mishana: () => import("./mishana/phone"),
  bluff: () => import("./bluff/phone"),
  likely: () => import("./likely/phone"),
  trivia: () => import("./trivia/phone"),
};
