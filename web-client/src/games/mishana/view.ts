// JAMAA-PLATFORM §2.5 / §2.7: Mish Ana!'s screens were written against the v1 PublicView. In v2 the same data
// arrives split: the game fields in `game.public` / `game.me`, names, colours, seats, `connected` and `isHost` in
// `room.members`, and the room keys in `room`. `mishanaView()` recomposes the v1 shape (same keys, same order) so the
// existing screens port with a mechanical change of their data source. Zod-free: types only.
import type { GameEnvelope, PlayerRoomView, RoomPublic, TvRoomView } from "@jamaa/shared/protocol/v2";

type Env = Extract<GameEnvelope, { gameId: "mishana" }>;
export type MishanaPub = Env["public"];
export type Me = NonNullable<Env["me"]>;
type GamePlayer = MishanaPub["players"][number];

export type ColorId = RoomPublic["members"][number]["color"];
export type Role = NonNullable<GamePlayer["revealedRole"]>;
export type Settings = MishanaPub["settings"];
export type DeadlineView = NonNullable<MishanaPub["deadline"]>;
export type WordRef = NonNullable<Me["word"]>;

/** v1 PublicPlayer: the game fields plus the member fields. */
export interface PublicPlayer extends GamePlayer {
  name: string; color: ColorId; seat: number; connected: boolean; isHost: boolean;
}

/** The v1 PublicView keys the Mish Ana! screens read (room keys filled from `room`; setup-only keys neutral). */
export type PublicView = Omit<MishanaPub, "players"> & {
  roomCode: string; joinUrl: string; players: PublicPlayer[]; hostPlayerId: string | null;
  premium: boolean; tvBusy: boolean; wordLocales: RoomPublic["contentLocales"];
};
export type PlayerView = PublicView & { kind: "player"; me: Me | null };
export type TvView = PublicView & { kind: "tv" };

function players(room: RoomPublic, pub: MishanaPub): PublicPlayer[] {
  const byId = new Map(room.members.map((m) => [m.id, m]));
  const out: PublicPlayer[] = [];
  for (const p of pub.players) {
    const m = byId.get(p.id);
    // A player the room already removed (left, game over) keeps a neutral identity so the screens never crash.
    out.push({ ...p, name: m?.name ?? "", color: m?.color ?? "lilac", seat: m?.seat ?? 99, connected: m?.connected ?? false, isHost: m?.isHost ?? false });
  }
  return out.sort((a, b) => a.seat - b.seat);
}

function base(room: RoomPublic, pub: MishanaPub): PublicView {
  return {
    ...pub,
    roomCode: room.roomCode, joinUrl: room.joinUrl, players: players(room, pub), hostPlayerId: room.hostPlayerId,
    premium: room.premium, tvBusy: room.tvBusy, wordLocales: room.contentLocales,
  };
}

/** The phone's Mish Ana! view, or null when the room is not playing Mish Ana!. */
export function mishanaPlayerView(v: PlayerRoomView): PlayerView | null {
  const g = v.game;
  if (!g || g.gameId !== "mishana") return null;
  return { ...base(v.room, g.public), kind: "player", me: g.me };
}

/** The TV's Mish Ana! view, or null when the room is not playing Mish Ana!. */
export function mishanaTvView(v: TvRoomView): TvView | null {
  const g = v.game;
  if (!g || g.gameId !== "mishana") return null;
  return { ...base(v.room, g.public), kind: "tv" };
}
export type Phase = MishanaPub["phase"];
