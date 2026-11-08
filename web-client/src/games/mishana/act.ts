// Mish Ana!'s in-game intents travel inside the room intent `GAME {gameId: "mishana", i}` (JAMAA-PLATFORM §2.5).
import type { RoomIntentMsg } from "@jamaa/shared/protocol/v2";

export type MishanaIntent = Extract<RoomIntentMsg, { type: "GAME"; gameId: "mishana" }>["i"];

export function gameIntent(i: MishanaIntent): RoomIntentMsg {
  return { type: "GAME", gameId: "mishana", i };
}
