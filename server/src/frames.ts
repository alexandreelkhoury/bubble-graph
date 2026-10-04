// Server → client wire frames (§6.3) and socket I/O that never throws. Pure: no room state.
import { PROTOCOL_VERSION } from "@mishana/shared/constants";
import type { ErrorCode, ErrorMsg, StateMsg, View, WelcomeMsg } from "@mishana/shared/protocol";
import { ERROR_INFO, errorMessageKey } from "@mishana/shared/protocol";

/** The subset of a socket the frames are written to (partyserver's Connection, or a test fake). */
export interface FrameSink {
  send(msg: string): void;
  close(code?: number, reason?: string): void;
}

/** Errors that end the socket (ERROR_INFO `fatal`), each with its own close code. */
export type FatalErrorCode = "UNSUPPORTED_VERSION" | "TV_AUTH_FAILED" | "ROOM_NOT_FOUND" | "ROOM_EXPIRED" | "KICKED" | "REPLACED";

export function errorFrame(code: ErrorCode, ref: string | null = null): string {
  return JSON.stringify({ v: PROTOCOL_VERSION, t: "error", code, messageKey: errorMessageKey(code), ref } satisfies ErrorMsg);
}

export function welcomeFrame(playerId: string, resumeToken: string, roomCode: string): string {
  return JSON.stringify({ v: PROTOCOL_VERSION, t: "welcome", playerId, resumeToken, roomCode } satisfies WelcomeMsg);
}

export function stateFrame(seq: number, serverNow: number, view: View): string {
  return JSON.stringify({ v: PROTOCOL_VERSION, t: "state", seq, serverNow, view } satisfies StateMsg);
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
