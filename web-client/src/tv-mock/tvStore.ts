// TV-mock state: room creation, the TV socket (hello tv), the TvView and local UI (pause, dialogs, settings).
import { signal } from "@preact/signals";
import type { ClientIntentMsg, CreateRoomResponseBody, ErrorCode, TvView } from "@mishana/shared/protocol";
import { Connection, partySocketFactory } from "../net/connection";
import type { ConnStatus } from "../net/connection";
import { createRoom } from "../net/api";
import { locale, t } from "../i18n/t";
import type { MessageKey } from "../i18n/t";
import { pushToast, resetClock, sampleClock } from "../state/store";

export type TvUi =
  | { kind: "creating" }
  | { kind: "failed"; error: string }
  | { kind: "room"; room: CreateRoomResponseBody }
  | { kind: "fatal"; code: number; messageKey: MessageKey };

export const tvUi = signal<TvUi>({ kind: "creating" });
export const tvView = signal<TvView | null>(null);
export const tvConn = signal<ConnStatus>("connecting");
export const tvPaused = signal(false);
export const tvScreen = signal<"main" | "settings">("main");
export const tvLastError = signal<ErrorCode | null>(null);
/** Seconds the TV socket has been down (for TV-13a/13b). */
export const tvDownSince = signal<number | null>(null);

let conn: Connection | null = null;
const FATAL_KEY: Record<number, MessageKey> = {
  4002: "error.unsupportedVersion", 4003: "error.tvAuthFailed", 4004: "error.roomNotFound", 4005: "error.replaced", 4010: "error.roomExpired",
};

export function tvSend(a: ClientIntentMsg): boolean {
  return conn?.action(a) != null;
}

export async function tvCreateRoom(): Promise<void> {
  conn?.destroy();
  conn = null;
  tvView.value = null;
  tvPaused.value = false;
  tvScreen.value = "main";
  tvUi.value = { kind: "creating" };
  resetClock();
  const started = Date.now();
  const res = await createRoom(locale.value);
  // Let the splash breathe (≤ 800 ms) so the bang animation completes.
  const wait = Math.max(0, 700 - (Date.now() - started));
  if (wait) await new Promise((r) => setTimeout(r, wait));
  if (!res.ok) {
    tvUi.value = { kind: "failed", error: res.error };
    return;
  }
  const room = res.room;
  tvUi.value = { kind: "room", room };
  conn = new Connection(partySocketFactory(room.code), {
    hello: () => JSON.stringify({ v: 1, t: "hello", role: "tv", tvToken: room.tvToken }),
    onState: (msg) => {
      sampleClock(msg.serverNow);
      if (msg.view.kind === "tv") tvView.value = msg.view;
    },
    onWelcome: () => undefined,
    onError: (msg) => {
      tvLastError.value = msg.code;
      const silent: ErrorCode[] = ["ROOM_EXPIRED", "REPLACED", "TV_AUTH_FAILED", "ROOM_NOT_FOUND", "UNSUPPORTED_VERSION"];
      if (!silent.includes(msg.code)) pushToast(t(msg.messageKey as MessageKey), "error");
    },
    onStatus: (s) => {
      tvConn.value = s;
      tvDownSince.value = s === "open" ? null : tvDownSince.value ?? Date.now();
    },
    onFatal: (code) => {
      const v = tvView.value;
      if (code === 4010 && (!v || (v.phase === "LOBBY" && v.players.length === 0))) {
        // TV-13e: an empty lobby expired → silently create a new room.
        void tvCreateRoom().then(() => {
          const u = tvUi.value;
          if (u.kind === "room") pushToast(t("tv.newCode", { code: u.room.code }), "info", 4000);
        });
        return;
      }
      tvUi.value = { kind: "fatal", code, messageKey: FATAL_KEY[code] ?? "error.internal" };
    },
  });
}

export function tvWake(): void { conn?.wake(); }
export function tvStop(): void {
  conn?.destroy();
  conn = null;
}
