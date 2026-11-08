// JAMAA-PLATFORM §2.1 / §6.1: Bluff's server-only GameDefinition. STUB created in P (`enabled: false`); the G lane of
// this game replaces this file with the real engine, content and projections.
import { isStringArray, oneOf } from "../settings-util";
import { stubDefinition } from "../stub";
import { BLUFF_META } from "./meta";

export const definition = stubDefinition(BLUFF_META, { packIds: isStringArray(/^[a-z0-9-]{1,35}$/, 50), length: oneOf(["short", "normal", "long"]), pace: oneOf(["relaxed", "normal", "fast"]) }, (s) => s.packIds, () => ({ gameId: "bluff" as const, available: 0 }));
export type BluffDefinition = typeof definition;
