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
import { soundCue, soundOnView, soundReset } from "./sound/controller";
import { billing } from "./billing";
import type { StoreEntry } from "./billing/model";
import { billingEnabled } from "../lib/billingFlag";
import { recreatesRoomOnFatal } from "./roomLife";

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
/** PAYMENTS-SPEC §4.4: the Store overlay (LOBBY only) and what opened it, or null when closed. */
export const tvShop = signal<StoreEntry | null>(null);

let conn: Connection | null = null;
let unbindWake: (() => void) | null = null;
const FATAL_KEY: Record<number, MessageKey> = {
  [CLOSE.UNSUPPORTED_VERSION]: "error.unsupportedVersion", [CLOSE.TV_AUTH_FAILED]: "error.tvAuthFailed",
  [CLOSE.ROOM_NOT_FOUND]: "error.roomNotFound", [CLOSE.REPLACED]: "error.replaced", [CLOSE.ROOM_EXPIRED]: "error.roomExpired",
};
// TV_BUSY is never expected on the TV (the Store covers the lobby), so it stays silent like the TV app (§4.3).
const SILENT: readonly ErrorCode[] = ["ROOM_EXPIRED", "REPLACED", "TV_AUTH_FAILED", "ROOM_NOT_FOUND", "UNSUPPORTED_VERSION", "TV_BUSY"];
/** §4.4: the TV's own wording for the two premium errors (TV register, no "on the TV"). */
const TV_ERROR_KEY: Partial<Record<ErrorCode, MessageKey>> = { PREMIUM_REQUIRED: "tv.premiumRequired", PACK_LOCKED: "tv.packLocked" };

/** Sends an action; returns its id (null when the socket is not OPEN). */
export function tvAct(a: ClientIntentMsg): string | null {
  return conn?.action(a) ?? null;
}

function closeLocalUi(): void {
  tvShop.value = null;
  billing.setStoreVisible(false);
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
  const billingOn = billingEnabled.value;
  const res = await createRoom(locale.value, billingOn ? billing.tokenForCreate() : null);
  // Let the splash breathe (≤ 800 ms) so the bang animation completes.
  const wait = Math.max(0, 700 - (Date.now() - started));
  if (wait) await new Promise((r) => setTimeout(r, wait));
  if (!res.ok) {
    tvUi.value = { kind: "failed", error: res.error };
    return;
  }
  const room = res.room;
  tvUi.value = { kind: "room", room };
  let freshOpen = false;
  conn = new Connection(partySocketFactory(room.code), {
    hello: () => ({ v: PROTOCOL_VERSION, t: "hello", role: "tv", tvToken: room.tvToken }),
    onState: (msg) => {
      sampleClock(msg.serverNow);
      if (msg.view.kind !== "tv") return;
      if (freshOpen) {
        freshOpen = false;
        queueMicrotask(() => billing.roomOpened()); // the queued token and the busy flag, once the hello is through
      }
      const prev = tvView.value;
      tvView.value = msg.view;
      soundOnView(prev, msg.view);
    },
    onWelcome: () => undefined,
    onError: (msg) => {
      tvLastErrorMsg.value = msg;
      if (SILENT.includes(msg.code)) return;
      // A dropped background `entitlement` / `storeOpen`: the billing client re-sends it, the user asked for nothing.
      if (msg.code === "RATE_LIMITED" && billing.wsRateLimited()) return;
      pushToast(t(TV_ERROR_KEY[msg.code] ?? (msg.messageKey as MessageKey)), "error");
      soundCue("sfx.error");
    },
    onStatus: (s) => {
      if (s === "open") freshOpen = true;
      tvConn.value = s;
      tvDownSince.value = s === "open" ? null : tvDownSince.value ?? Date.now();
    },
    onFatal: (code) => {
      if (recreatesRoomOnFatal(code, tvView.value)) {
        // TV-13e: the room expired or vanished between games → silently create a new room.
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
  if (!billingOn) return; // BILLING_ENABLED off: the billing client never links to the room (no entitlement / storeOpen)
  billing.attach({
    send: (m) => conn?.send(m) ?? false,
    canToast: () => {
      const v = tvView.value;
      return tvShop.value !== null || v?.phase === "LOBBY" || v?.phase === "RESULTS";
    },
    showToast: (x) => pushToast(t(x.key, x.params), x.tone, 4000),
  });
  billing.roomCreated(room.entitlement);
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
  billing.detach();
  unbindWake?.();
  unbindWake = null;
  soundReset();
  conn?.destroy();
  conn = null;
}
