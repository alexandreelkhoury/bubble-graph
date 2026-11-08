// JAMAA-PLATFORM §2.5 HTTP: `POST /api/rooms` is unchanged (protocol/http.ts); healthz and config change.
import * as z from "zod";
import { GameIdSchema } from "../../games/protocol";

/** `GET /healthz` → `{ok:true, app:"jamaa", protocol:2}`. */
export const HealthzV2 = z.object({ ok: z.literal(true), app: z.literal("jamaa"), protocol: z.literal(2) });
/** `GET /api/config` → `{billing, games}`; `games` = GAMES_ENABLED ∩ registry enabled (the TV intersects with its own). */
export const ClientConfigV2 = z.object({ billing: z.boolean(), games: z.array(GameIdSchema) });

export type HealthzV2Body = z.infer<typeof HealthzV2>;
export type ClientConfigV2Body = z.infer<typeof ClientConfigV2>;
