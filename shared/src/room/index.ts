// JAMAA-PLATFORM §2.1 `@jamaa/shared/room`: the platform room engine (types + reduceRoom). Server, sim and tests only.
export * from "./types";
export { createRoomState, createRoomHistory, reduceRoom, nextRoomWakeAt, roomGames, roomOutcome, rosterOf, gameAvailable, cupStars, normalizeLoaded, ROOM_SCHEMA, type LoadedRoom } from "./reduce";
export { assertRoomInvariants, RoomInvariantError } from "./invariants";
