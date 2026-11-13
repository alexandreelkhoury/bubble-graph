// A renderer skin for the TV mock: /tv-pixi registers PixiJS versions of the hub and of some games here (the lazy
// `tv-mock-pixi` chunk, src/tv-pixi/skin.tsx); the plain /tv mock leaves it empty and draws everything in the DOM.
// Whatever a skin does not provide falls back to the DOM screens, so the whole app stays playable.
import type { ComponentType } from "preact";
import type { GameId } from "@jamaa/shared/games/ids";
import type { TvRoomView } from "@jamaa/shared/protocol/v2";

export interface TvSkin {
  Hub?: ComponentType<{ view: TvRoomView; portalOut?: boolean; onOpen(id: GameId, rect: DOMRect | null): void }>;
  games: Partial<Record<GameId, ComponentType<{ view: TvRoomView }>>>;
}
export const tvSkin: TvSkin = { games: {} };
