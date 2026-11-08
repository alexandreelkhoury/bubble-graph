// JAMAA-PLATFORM §6.1 "the web game loader map": what each game's lazy phone and TV modules export. P creates this
// contract and a stub module for every game; each G lane replaces only the files inside web-client/src/games/<id>/.
import type { ComponentType } from "preact";
import type { PlayerRoomView, TvRoomView } from "@jamaa/shared/protocol/v2";

/** `games/<id>/phone.tsx` (the `game-<id>` chunk; counted in the phone budget, ≤ 14 KB gz). */
export interface PhoneGameModule {
  /** This phone's in-game screen; null when it has nothing to show (the shell then shows the benched view). */
  Phone: ComponentType<{ view: PlayerRoomView }>;
  /** A key that changes when the screen should reset (scroll to top). */
  screenKey(view: PlayerRoomView): string;
  /** One-shot effects of a view change (haptics, announcements). */
  onPhoneView?(prev: PlayerRoomView | null, next: PlayerRoomView): void;
  /** Whether this phone owes an action now: the ⓘ sheet's sticky "Your turn!" banner (§3.6). */
  needsMe?(view: PlayerRoomView): boolean;
}

/** `games/<id>/tv.tsx` (a `tv-mock-game-<id>` chunk: excluded from the phone budget). */
export interface TvGameModule {
  /** The game's TV screen inside the platform canvas (no focusable buttons in game, §3.2 HUB-06). */
  Tv: ComponentType<{ view: TvRoomView }>;
  /** A key that changes when the TV screen should remount (phase transitions). */
  screenKey(view: TvRoomView): string;
  /** Called on every TV view (sounds, one-shot effects). */
  onTvView?(prev: TvRoomView | null, next: TvRoomView): void;
  /** A host dialog the TV must answer now (e.g. Mish Ana!'s guess override): the rules sheet closes for it (§3.6). */
  hostDialogOpen?(view: TvRoomView): boolean;
}
