// `@jamaa/shared/protocol/v2` (JAMAA-PLATFORM §2.5). Runtime exports pull in zod: clients `import type` only.
// P2 folds this into `@jamaa/shared/protocol` when the server switches and the v1 schemas are deleted.
export * from "./views";
export * from "./messages";
export * from "./http";
export { GameIdSchema, GameEnvelopeSchema, SetupExtrasSchema, GameIntentSchema, GameSettingsPatchSchema, type GameEnvelope, type SetupExtras } from "../../games/protocol";
