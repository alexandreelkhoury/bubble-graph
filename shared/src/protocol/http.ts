import * as z from "zod";
import { ENTITLEMENT_TOKEN_MAX_CHARS, ROOM_CODE_REGEX } from "../constants";
import { ErrorCodeSchema, LocaleSchema, Token } from "./common";

/** PAYMENTS-SPEC §3.11: what `createRoom` made of the request's entitlement token. "INVALID" → the TV refreshes its token. */
export const ENTITLEMENT_STATUSES = ["NONE", "OK", "INVALID"] as const;
export type EntitlementStatus = (typeof ENTITLEMENT_STATUSES)[number];
export const CreateRoomRequest = z.strictObject({ locale: LocaleSchema.optional(), entitlement: z.string().max(ENTITLEMENT_TOKEN_MAX_CHARS).optional() });
export const CreateRoomResponse = z.object({
  code: z.string().regex(ROOM_CODE_REGEX), tvToken: Token, joinUrl: z.string(), wsPath: z.string(),
  entitlement: z.enum(ENTITLEMENT_STATUSES),
});
export const HttpError = z.object({ error: ErrorCodeSchema });
export const Healthz = z.object({ ok: z.literal(true), app: z.string(), protocol: z.number().int() });

export type CreateRoomRequestBody = z.infer<typeof CreateRoomRequest>;
export type CreateRoomResponseBody = z.infer<typeof CreateRoomResponse>;
export type HttpErrorBody = z.infer<typeof HttpError>;
export type HealthzBody = z.infer<typeof Healthz>;
