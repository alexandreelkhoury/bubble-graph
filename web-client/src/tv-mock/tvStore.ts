// TV-mock state: room creation, the TV socket (hello tv), the TvView and local UI (pause, dialogs, settings).
import { signal } from "@preact/signals";
import { PROTOCOL_VERSION } from "@mishana/shared/constants";
import type { ClientIntentMsg, CreateRoomResponseBody, ErrorCode, ErrorMsg, TvView } from "@mishana/shared/protocol";
import { bindWake, CLOSE, Connection, partySocketFactory } from "../net/connection";
import type { ConnStatus } from "../net/connection";
import { createRoom } from "../net/api";
import { locale, t } from "../i18n/t";
import type { MessageKey } from "../i18n/t";
import { pushToast, resetClock, sampleClock } from "../state/store";

export type TvUi =
  | { kind: "creating" }
  | { kind: "failed"; error: string }
  | { kind: "room"; room: CreateRoomResponseBody }
  | { kind: "fatal"; code: number; messageKey: MessageKey }
  /** Exit (pause menu, or Back in the lobby): the mock's stand-in for leaving the Android app. */
  | { kind: "closed" };

export const tvUi = signal<TvUi>({ kind: "creating" });
export const tvView = signal<TvView | null>(null);
export const tvConn = signal<ConnStatus>("connecting");
export const tvPaused = signal(false);
/** TV-12 page: the menu itself, or its "Players…" sub-page (Back returns to the menu). */
export const tvPausePage = signal<"menu" | "players">("menu");
export const tvScreen = signal<"main" | "settings">("main");
/** The canvas scale (CSS px per dp), for pixel-snapping the QR modules. */
export const tvScale = signal(1);
/** TV-02 language list (an overlay: Back closes it). */
export const tvLangOpen = signal(false);
/** The last error frame (its `ref` ties it to an action id). */
export const tvLastErrorMsg = signal<ErrorMsg | null>(null);
/** Seconds the TV socket has been down (for TV-13a/13b). */
export const tvDownSince = signal<number | null>(null);

let conn: Connection | null = null;
let unbindWake: (() => void) | null = null;
const FATAL_KEY: Record<number, MessageKey> = {
  [CLOSE.UNSUPPORTED_VERSION]: "error.unsupportedVersion", [CLOSE.TV_AUTH_FAILED]: "error.tvAuthFailed",
  [CLOSE.ROOM_NOT_FOUND]: "error.roomNotFound", [CLOSE.REPLACED]: "error.replaced", [CLOSE.ROOM_EXPIRED]: "error.roomExpired",
};
const SILENT: readonly ErrorCode[] = ["ROOM_EXPIRED", "REPLACED", "TV_AUTH_FAILED", "ROOM_NOT_FOUND", "UNSUPPORTED_VERSION"];

/** Sends an action; returns its id (null when the socket is not OPEN). */
export function tvAct(a: ClientIntentMsg): string | null {
  return conn?.action(a) ?? null;
}

function closeLocalUi(): void {
  tvPaused.value = false;
  tvPausePage.value = "menu";
  tvLangOpen.value = false;
  tvScreen.value = "main";
}

export async function tvCreateRoom(): Promise<void> {
  tvStop();
  tvView.value = null;
  closeLocalUi();
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
    hello: () => ({ v: PROTOCOL_VERSION, t: "hello", role: "tv", tvToken: room.tvToken }),
    onState: (msg) => {
      sampleClock(msg.serverNow);
      if (msg.view.kind === "tv") tvView.value = msg.view;
    },
    onWelcome: () => undefined,
    onError: (msg) => {
      tvLastErrorMsg.value = msg;
      if (!SILENT.includes(msg.code)) pushToast(t(msg.messageKey as MessageKey), "error");
    },
    onStatus: (s) => {
      tvConn.value = s;
      tvDownSince.value = s === "open" ? null : tvDownSince.value ?? Date.now();
    },
    onFatal: (code) => {
      const v = tvView.value;
      if (code === CLOSE.ROOM_EXPIRED && (!v || (v.phase === "LOBBY" && v.players.length === 0))) {
        // TV-13e: an empty lobby expired → silently create a new room.
        void tvCreateRoom().then(() => {
          const u = tvUi.value;
          if (u.kind === "room") pushToast(t("tv.newCode", { code: u.room.code }), "info", 4000);
        });
        return;
      }
      closeLocalUi();
      tvUi.value = { kind: "fatal", code, messageKey: FATAL_KEY[code] ?? "error.internal" };
    },
  });
  unbindWake = bindWake(conn);
}

export function tvWake(): void { conn?.wake(); }

/** Exit the app (DESIGN TV-02 Back, TV-12 Exit): drop the socket and show the remote-friendly "closed" splash. */
export function tvExit(): void {
  tvStop();
  closeLocalUi();
  tvView.value = null;
  tvUi.value = { kind: "closed" };
}
export function tvStop(): void {
  unbindWake?.();
  unbindWake = null;
  conn?.destroy();
  conn = null;
}
