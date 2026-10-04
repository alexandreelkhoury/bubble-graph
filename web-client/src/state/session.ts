// Player session: wires the Connection to the store and derives one-shot UI effects from view changes.
import { PROTOCOL_VERSION } from "@mishana/shared/constants";
import type { ColorId } from "@mishana/shared/constants";
import type { ClientIntentMsg, ErrorCode, ErrorMsg, PlayerView } from "@mishana/shared/protocol";
import { bindWake, CLOSE, Connection, partySocketFactory } from "../net/connection";
import type { SocketFactory } from "../net/connection";
import { clearResume, loadResume, saveColor, saveName, saveResume } from "../lib/storage";
import { HAPTIC, haptic } from "../lib/haptics";
import { reacquireWakeLock, releaseWakeLock, requestWakeLock, wantWakeLock } from "../lib/wakelock";
import { isolate, locale, t } from "../i18n/t";
import { PHASE_KEY, ROLE_KEY } from "../lib/keys";
import { newForfeits } from "../lib/view";
import { premiumEndedStep } from "../lib/premium";
import type { MessageKey } from "../i18n/t";
import {
  announce, conn, fatalCode, fatalError, inlineError, joinPending, lastError, pushToast, resetClock, resuming, resyncs,
  sampleClock, view,
} from "./store";

/** Errors shown inline (PH-14), everything else is a toast. */
const INLINE_JOIN: readonly ErrorCode[] = ["NAME_INVALID", "NAME_TAKEN", "COLOR_TAKEN", "ROOM_FULL", "RATE_LIMITED", "ROOM_LOCKED"];
const SILENT: readonly ErrorCode[] = ["RESUME_INVALID", "KICKED", "REPLACED", "ROOM_EXPIRED", "ROOM_NOT_FOUND", "UNSUPPORTED_VERSION", "TV_AUTH_FAILED"];

let current: { code: string; conn: Connection; detach: () => void } | null = null;
let wasReconnecting = false;
let awaitingResync = false;
/** PAYMENTS-SPEC §5.1: a premium → free flip seen mid-game, shown to the VIP on the next LOBBY. */
let premiumEndedPending = false;

export function startSession(code: string, factory: SocketFactory = partySocketFactory(code)): void {
  if (current?.code === code) return;
  stopSession();
  view.value = null;
  fatalCode.value = null;
  fatalError.value = null;
  inlineError.value = null;
  lastError.value = null;
  joinPending.value = false;
  conn.value = "connecting";
  resetClock();
  wasReconnecting = false;
  awaitingResync = false;
  premiumEndedPending = false;
  const c = new Connection(factory, {
    hello: () => {
      const r = loadResume(code);
      resuming.value = r !== null;
      return r ? { v: PROTOCOL_VERSION, t: "hello", role: "player", resumeToken: r.resumeToken } : { v: PROTOCOL_VERSION, t: "hello", role: "player" };
    },
    onState: (msg) => {
      sampleClock(msg.serverNow);
      resuming.value = false;
      const next = msg.view.kind === "player" ? msg.view : null;
      if (!next) return;
      const prev = view.value;
      view.value = next;
      onViewChange(prev, next);
      if (awaitingResync) {
        awaitingResync = false;
        resyncs.value++;
      }
    },
    onWelcome: (msg) => {
      saveResume(code, msg.playerId, msg.resumeToken);
      joinPending.value = false;
      // A held seat wants the wake lock, also after a resume (no Join tap); browsers may need a gesture, so the
      // pointerdown listener below retries on the next tap.
      wantWakeLock();
      reacquireWakeLock();
      inlineError.value = null;
    },
    onError: (msg) => handleError(code, msg),
    onStatus: (s) => {
      conn.value = s;
      // A join frame may be lost with the socket: never leave the CTA stuck on "Joining…".
      if (s !== "open") joinPending.value = false;
      if (s === "reconnecting") wasReconnecting = true;
      if (s === "open" && wasReconnecting) {
        wasReconnecting = false;
        awaitingResync = true;
        pushToast(t("conn.back"), "success", 1600);
      }
    },
    onFatal: (closeCode) => {
      fatalCode.value = closeCode;
      releaseWakeLock();
      if (closeCode === CLOSE.KICKED) clearResume(code);
    },
  });
  const unbindWake = bindWake(c, reacquireWakeLock);
  const onTap = (): void => { if (view.value?.me) reacquireWakeLock(); };
  window.addEventListener("pointerdown", onTap, { passive: true });
  current = {
    code, conn: c, detach: () => {
      unbindWake();
      window.removeEventListener("pointerdown", onTap);
    },
  };
}

export function stopSession(): void {
  if (!current) return;
  current.detach();
  current.conn.destroy();
  current = null;
  releaseWakeLock();
}

function handleError(code: string, msg: ErrorMsg): void {
  lastError.value = msg;
  fatalError.value = msg.code;
  if (msg.code === "RESUME_INVALID") {
    clearResume(code);
    resuming.value = false;
    return;
  }
  if (SILENT.includes(msg.code)) return;
  haptic(HAPTIC.error);
  const onJoin = view.value !== null && view.value.me === null;
  if ((onJoin && INLINE_JOIN.includes(msg.code)) || msg.code === "GUESS_INVALID") {
    joinPending.value = false;
    inlineError.value = msg.code;
    return;
  }
  joinPending.value = false;
  pushToast(t(msg.messageKey as MessageKey), "error");
}

/** Sends an action; a tap while not OPEN does nothing (the banner explains). */
export function act(a: ClientIntentMsg): boolean {
  return actId(a) !== null;
}

/** Like act(), but returns the action id (matched by an error's `ref`), or null when nothing was sent. */
export function actId(a: ClientIntentMsg): string | null {
  return current?.conn.action(a) ?? null;
}

export function join(name: string, color: ColorId): boolean {
  if (!current) return false;
  void requestWakeLock();
  inlineError.value = null;
  const ok = current.conn.send({ v: PROTOCOL_VERSION, t: "join", name, color, locale: locale.value });
  if (ok) {
    joinPending.value = true;
    saveName(name);
    saveColor(color);
  }
  return ok;
}

/** "Use it here" (4005): reconnect with the stored resume token. */
export function useHere(): void {
  if (!current) return;
  fatalCode.value = null;
  fatalError.value = null;
  current.conn.restart();
}

export function leave(): void {
  const c = current;
  if (!c) return;
  c.conn.action({ type: "LEAVE" });
  clearResume(c.code);
  // Give the frame a moment to flush before closing the socket.
  setTimeout(() => stopSession(), 150);
}

/** One-shot effects of a view change: haptics, toasts, live-region announcements. Pure on its inputs except for side effects. */
export function onViewChange(prev: PlayerView | null, next: PlayerView): void {
  const myId = next.me?.id ?? null;
  // Phase announcement.
  if (prev && prev.phase !== next.phase) announce(t(PHASE_KEY[next.phase]));
  // Locked join unlocks.
  if (prev && next.me === null && prev.phase !== "LOBBY" && next.phase === "LOBBY") {
    pushToast(t("join.unlocked"), "success");
    haptic(HAPTIC.unlocked);
  }
  if (!myId) return;
  // §5.1: the VIP phone only, once per flip (in LOBBY, or on the first LOBBY after the game).
  const ended = premiumEndedStep(premiumEndedPending, prev, next);
  premiumEndedPending = ended.pending;
  if (ended.show && next.hostPlayerId === myId) pushToast(t("lobby.premiumEndedPhone"), "info", 4000);
  const isTurn = (v: PlayerView | null): boolean => v?.currentSpeakerId === myId && (v.phase === "CLUES" || v.phase === "TIE_BREAK");
  if (isTurn(next) && !isTurn(prev)) {
    haptic(HAPTIC.yourTurn);
    announce(t("clues.yourTurn"), true);
  }
  // Next up: one turn before yours.
  const nextUp = (v: PlayerView | null): boolean => {
    if (!v || !(v.phase === "CLUES" || v.phase === "TIE_BREAK") || v.currentSpeakerId === null) return false;
    const i = v.speakingOrder.indexOf(v.currentSpeakerId);
    return i >= 0 && v.speakingOrder[i + 1] === myId;
  };
  if (nextUp(next) && !nextUp(prev)) haptic(HAPTIC.nextUp);
  const meP = next.players.find((p) => p.id === myId);
  const meWas = prev?.players.find((p) => p.id === myId);
  if (meP && meWas && meWas.alive && !meP.alive && next.phase !== "LOBBY") {
    haptic(HAPTIC.eliminated);
    announce(t("elim.you"), true);
  }
  // Forfeits (LEAVE/KICK in-game): toast with the revealed role.
  if (prev) for (const f of newForfeits(prev, next)) pushToast(t("elim.forfeit", { name: isolate(f.player.name), role: t(ROLE_KEY[f.role]) }));
  if (next.phase === "RESULTS" && prev?.phase !== "RESULTS" && next.result?.winnerIds.includes(myId)) haptic(HAPTIC.win);
}
