import * as z from "zod";
import { ROOM_CODE_REGEX } from "../constants";
import { ErrorCodeSchema, LocaleSchema, Token } from "./common";

export const CreateRoomRequest = z.strictObject({ locale: LocaleSchema.optional() });
export const CreateRoomResponse = z.object({ code: z.string().regex(ROOM_CODE_REGEX), tvToken: Token, joinUrl: z.string(), wsPath: z.string() });
export const HttpError = z.object({ error: ErrorCodeSchema });
export const Healthz = z.object({ ok: z.literal(true), app: z.string(), protocol: z.number().int() });

export type CreateRoomRequestBody = z.infer<typeof CreateRoomRequest>;
export type CreateRoomResponseBody = z.infer<typeof CreateRoomResponse>;
export type HttpErrorBody = z.infer<typeof HttpError>;
export type HealthzBody = z.infer<typeof Healthz>;
