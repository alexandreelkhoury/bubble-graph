// Server → client wire frames (§6.3, protocol v2: JAMAA-PLATFORM §2.5) and socket I/O that never throws. Pure.
import { PROTOCOL_VERSION } from "@jamaa/shared/constants";
import type { ErrorCode } from "@jamaa/shared/protocol";
import { ERROR_INFO, errorMessageKey } from "@jamaa/shared/protocol";
import type { ErrorMsgV2, RoomView, StateV2Msg, WelcomeV2Msg as WelcomeMsg } from "@jamaa/shared/protocol/v2";

/** The subset of a socket the frames are written to (partyserver's Connection, or a test fake). */
export interface FrameSink {
  send(msg: string): void;
  close(code?: number, reason?: string): void;
}

/** Errors that end the socket (ERROR_INFO `fatal`), each with its own close code. */
export type FatalErrorCode = "UNSUPPORTED_VERSION" | "TV_AUTH_FAILED" | "ROOM_NOT_FOUND" | "ROOM_EXPIRED" | "KICKED" | "REPLACED";

export function errorFrame(code: ErrorCode, ref: string | null = null): string {
  return JSON.stringify({ v: PROTOCOL_VERSION, t: "error", code, messageKey: errorMessageKey(code), ref } satisfies ErrorMsgV2);
}

export function welcomeFrame(playerId: string, resumeToken: string, roomCode: string): string {
  return JSON.stringify({ v: PROTOCOL_VERSION, t: "welcome", playerId, resumeToken, roomCode } satisfies WelcomeMsg);
}

export function stateFrame(seq: number, serverNow: number, view: RoomView): string {
  return JSON.stringify({ v: PROTOCOL_VERSION, t: "state", seq, serverNow, view } satisfies StateV2Msg);
}

export function safeSend(conn: FrameSink, msg: string): void {
  try {
    conn.send(msg);
  } catch {
    // The socket is closing; the close handler deals with it.
  }
}

export function safeClose(conn: FrameSink, code: number, reason = ""): void {
  try {
    conn.close(code, reason);
  } catch {
    // Already closed.
  }
}

/** Sends the fatal error, then closes with its close code (§6.4). Reason: "ROOM_EXPIRED" → "room expired". */
export function sendFatal(conn: FrameSink, code: FatalErrorCode): void {
  safeSend(conn, errorFrame(code));
  safeClose(conn, ERROR_INFO[code].closeCode as number, code.toLowerCase().replace(/_/g, " "));
}
