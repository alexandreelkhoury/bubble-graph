// /tv browser TV state (JAMAA-PLATFORM §3.2): room creation, the TV socket (protocol v2 hello with the games this build
// renders), the TvRoomView, and the local UI of the hub (focus, overlays, rules sheet, intro, transitions).
import { signal } from "@preact/signals";
import { HUB_FOCUS_DEBOUNCE_MS, PROTOCOL_VERSION } from "@jamaa/shared/constants";
import { GAME_IDS } from "@jamaa/shared/games/ids";
import type { GameId } from "@jamaa/shared/games/ids";
import { GAME_META } from "@jamaa/shared/games/meta";
import type { CreateRoomResponseBody, ErrorCode } from "@jamaa/shared/protocol";
import type { ErrorMsgV2, RoomIntentMsg, TvRoomView } from "@jamaa/shared/protocol/v2";
import { bindWake, CLOSE, Connection, partySocketFactory } from "../net/connection";
import type { ConnStatus } from "../net/connection";
import { createRoom } from "../net/api";
import { locale, t } from "../i18n/t";
import type { MessageKey } from "../i18n/t";
import { pushToast, resetClock, sampleClock } from "../state/store";
import { soundCue, soundReset } from "./sound/controller";
import { billing } from "./billing";
import type { StoreEntry } from "./billing/model";
import { billingEnabled } from "../lib/billingFlag";
import { recreatesRoomOnFatal } from "./roomLife";

export type TvUi =
  | { kind: "creating" }
  | { kind: "failed"; error: string }
  | { kind: "room"; room: CreateRoomResponseBody }
  | { kind: "fatal"; code: number; messageKey: MessageKey }
  /** "Close JAMAA" (hub Back confirm): the mock's stand-in for leaving the Android app. */
  | { kind: "closed" };

export const tvUi = signal<TvUi>({ kind: "creating" });
export const tvView = signal<TvRoomView | null>(null);
export const tvConn = signal<ConnStatus>("connecting");
/** HUB-06 pause menu (in game). */
export const tvPaused = signal(false);
/** The canvas scale (CSS px per dp), for pixel-snapping the QR modules. */
export const tvScale = signal(1);
/** Interface-language list (an overlay: Back closes it). */
export const tvLangOpen = signal(false);
/** The last error frame (its `ref` ties it to an action id). */
export const tvLastErrorMsg = signal<ErrorMsgV2 | null>(null);
/** Seconds the TV socket has been down (TV-13a/13b). */
export const tvDownSince = signal<number | null>(null);
/** HUB-08 Store overlay (outside a running game) and what opened it, or null when closed. */
export const tvShop = signal<StoreEntry | null>(null);
/** HUB-07 rules sheet: the game, and whether it was opened from the pause menu (then Back returns to the game). */
export const tvRules = signal<{ id: GameId; hub: boolean; fromPause: boolean } | null>(null);
/** Hub Settings overlay (sound, interface language, Calm animations, Show how-to again, About). */
export const tvHubSettings = signal(false);
/** "Tonight's cup" sheet (hub top-bar chip). */
export const tvCupOpen = signal(false);
/** HUB-03 pack picker sheet. */
export const tvPackPicker = signal(false);
/** HUB-03 "Advanced" sheet (Mish Ana!'s extra settings). */
export const tvAdvanced = signal(false);
/** The carousel's local focus (sent to the room as HUB_FOCUS after 300 ms of rest). */
export const tvFocusGame = signal<GameId | null>(null);
/** Games opened at least once this session (the portal plays 1 100 ms the first time, 700 ms afterwards). */
export const openedGames = new Set<GameId>();

let conn: Connection | null = null;
let unbindWake: (() => void) | null = null;
const FATAL_KEY: Record<number, MessageKey> = {
  [CLOSE.UNSUPPORTED_VERSION]: "error.unsupportedVersion", [CLOSE.TV_AUTH_FAILED]: "error.tvAuthFailed",
  [CLOSE.ROOM_NOT_FOUND]: "error.roomNotFound", [CLOSE.REPLACED]: "error.replaced", [CLOSE.ROOM_EXPIRED]: "error.roomExpired",
};
// TV_BUSY is never expected on the TV (the Store covers the screen), so it stays silent like the TV app (§4.3).
const SILENT: readonly ErrorCode[] = ["ROOM_EXPIRED", "REPLACED", "TV_AUTH_FAILED", "ROOM_NOT_FOUND", "UNSUPPORTED_VERSION", "TV_BUSY"];
/** §4.4: the TV's own wording for the two Pass errors (TV register, no "on the TV"). */
const TV_ERROR_KEY: Partial<Record<ErrorCode, MessageKey>> = { PREMIUM_REQUIRED: "pass.required", PACK_LOCKED: "tv.packLocked" };

/** §2.5: the games and view versions this build renders (the /tv mock is always current). */
export function tvGames(): { id: GameId; v: number }[] {
  return GAME_IDS.map((id) => ({ id, v: GAME_META[id].VIEW_VERSION }));
}

/** Sends an action; returns its id (null when the socket is not OPEN). */
export function tvAct(a: RoomIntentMsg): string | null {
  return conn?.action(a) ?? null;
}

let focusTimer: ReturnType<typeof setTimeout> | null = null;
/** Carousel focus moved: local at once, HUB_FOCUS after HUB_FOCUS_DEBOUNCE_MS of rest (§2.5). */
export function focusGame(id: GameId): void {
  tvFocusGame.value = id;
  if (focusTimer) clearTimeout(focusTimer);
  focusTimer = setTimeout(() => {
    focusTimer = null;
    const v = tvView.value;
    if (v && v.room.phase === "HUB" && v.room.focusedGameId !== id) tvAct({ type: "HUB_FOCUS", gameId: id });
  }, HUB_FOCUS_DEBOUNCE_MS);
}

function closeLocalUi(): void {
  tvShop.value = null;
  billing.setStoreVisible(false);
  tvPaused.value = false;
  tvLangOpen.value = false;
  tvRules.value = null;
  tvHubSettings.value = false;
  tvCupOpen.value = false;
  tvPackPicker.value = false;
  tvAdvanced.value = false;
}

/** The game is running (no outcome yet): the Store and billing toasts wait. */
export function inRunningGame(v: TvRoomView | null): boolean {
  return v !== null && v.room.phase === "PLAYING" && !(v.game?.over ?? false);
}

export async function tvCreateRoom(): Promise<void> {
  tvStop();
  tvView.value = null;
  closeLocalUi();
  tvFocusGame.value = null;
  openedGames.clear();
  tvUi.value = { kind: "creating" };
  resetClock();
  const started = Date.now();
  const billingOn = billingEnabled.value;
  const res = await createRoom(locale.value, billingOn ? billing.tokenForCreate() : null);
  // HUB-01: the wordmark builds in (≤ 1.2 s) while the room is created.
  const wait = Math.max(0, 1200 - (Date.now() - started));
  if (wait) await new Promise((r) => setTimeout(r, wait));
  if (!res.ok) {
    tvUi.value = { kind: "failed", error: res.error };
    return;
  }
  const room = res.room;
  tvUi.value = { kind: "room", room };
  let freshOpen = false;
  conn = new Connection(partySocketFactory(room.code), {
    hello: () => ({ v: PROTOCOL_VERSION, t: "hello", role: "tv", tvToken: room.tvToken, games: tvGames() }),
    onState: (msg) => {
      sampleClock(msg.serverNow);
      if (msg.view.kind !== "tv") return;
      if (freshOpen) {
        freshOpen = false;
        queueMicrotask(() => billing.roomOpened()); // the queued token and the busy flag, once the hello is through
      }
      const next = msg.view;
      const prev = tvView.value;
      // Leaving SETUP closes setup-only sheets; leaving the game closes the pause menu.
      if (next.room.phase !== "SETUP") { tvPackPicker.value = false; tvAdvanced.value = false; }
      if (next.room.phase !== "PLAYING" || next.game?.over) tvPaused.value = false;
      if (next.room.phase !== "HUB") { tvCupOpen.value = false; tvHubSettings.value = false; }
      if (tvFocusGame.value === null || (prev?.room.phase !== "HUB" && next.room.phase === "HUB")) tvFocusGame.value = next.room.focusedGameId;
      tvView.value = next;
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
        // TV-13e: the room expired or vanished outside a running game → silently create a new room.
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
    canToast: () => tvShop.value !== null || !inRunningGame(tvView.value),
    showToast: (x) => pushToast(t(x.key, x.params), x.tone, 4000),
  });
  billing.roomCreated(room.entitlement);
}

export function tvWake(): void { conn?.wake(); }

/** "Close JAMAA": drop the socket and show the remote-friendly "closed" splash. */
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
