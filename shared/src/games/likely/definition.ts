// JAMAA-PLATFORM §2.1 / §6.1: Likely's server-only GameDefinition. STUB created in P (`enabled: false`); the G lane of
// this game replaces this file with the real engine, content and projections.
import { isBool, isStringArray, oneOf } from "../settings-util";
import { stubDefinition } from "../stub";
import { LIKELY_META } from "./meta";

export const definition = stubDefinition(LIKELY_META, { packIds: isStringArray(/^[a-z0-9-]{1,35}$/, 50), length: oneOf(["short", "normal", "long"]), showVoters: isBool }, (s) => s.packIds, () => ({ gameId: "likely" as const, available: 0 }));
export type LikelyDefinition = typeof definition;
