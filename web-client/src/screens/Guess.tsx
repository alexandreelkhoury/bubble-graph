// PH-11 Blank guess (guesser) and PH-12 watching the guess (everyone else, VIP may accept a WRONG guess once).
import { useEffect, useRef, useState } from "preact/hooks";
import { GUESS_MAX_CHARS } from "@mishana/shared/constants";
import type { Me, PlayerView } from "@mishana/shared/protocol";
import { dirOf, isolate, t } from "../i18n/t";
import { act } from "../state/session";
import { inlineError, resyncs } from "../state/store";
import { HAPTIC, haptic } from "../lib/haptics";
import { Avatar, avatarState, COLOR_BY_ID } from "../components/PlayerChip";
import { RoleEmblem } from "../components/Role";
import { TimerBar, useDeadlineSelect } from "../components/Timer";
import { Button, ConfirmSheet, Confetti, Heading, PALETTE } from "../components/UI";
import { Icon } from "../components/Icon";
import { byId } from "../lib/view";
import { phaseLine } from "./Clues";

/** DESIGN §13.5 #10: auto-submit a non-empty guess at deadline − 1 s. */
export const AUTO_SUBMIT_LEAD_MS = 1000;

/** Typed text per game, plus `<key>:sent` = the resync count when the guess was last sent. */
const typedByGame = new Map<string, string>();

function Verdict({ status, you, overridden, name }: { status: "CORRECT" | "WRONG" | "TIMEOUT"; you: boolean; overridden: boolean; name: string }) {
  const key = status === "CORRECT" ? (you ? "guess.correctYou" : "guess.correct") : status === "WRONG" ? (you ? "guess.wrongYou" : "guess.wrong") : "guess.timeout";
  return (
    <div class={`verdict verdict--${status.toLowerCase()}`} role="status">
      <span class="verdict__icon"><Icon name={status === "CORRECT" ? "check" : status === "WRONG" ? "x" : "timer"} size={40} /></span>
      <h1 class="display" tabIndex={-1}>{t(key)}</h1>
      {overridden && <p class="tag tag--accent">{t("guess.overridden")}</p>}
      <span class="sr-only">{name}</span>
    </div>
  );
}

export function Guess({ view, me }: { view: PlayerView; me: Me | null }) {
  const g = view.guess;
  const guesser = byId(view, g?.playerId ?? null);
  const isGuesser = me !== null && g?.playerId === me.id;
  const gameKey = `${view.roomCode}:${view.gameNumber}:${view.round}`;
  const [text, setText] = useState(() => typedByGame.get(gameKey) ?? "");
  const [sent, setSent] = useState(() => typedByGame.has(gameKey + ":sent"));
  const [confirm, setConfirm] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const autoDue = useDeadlineSelect(view.deadline, (c) => c.ms <= AUTO_SUBMIT_LEAD_MS, false);
  const err = inlineError.value;

  const submit = (): void => {
    const v = text.trim();
    if (!v || sent) return;
    if (act({ type: "SUBMIT_GUESS", text: v })) {
      typedByGame.set(gameKey + ":sent", String(resyncs.value));
      setSent(true);
      inlineError.value = null;
      haptic(HAPTIC.guessSent);
    }
  };
  useEffect(() => { typedByGame.set(gameKey, text); }, [text]);
  useEffect(() => { if (err === "GUESS_INVALID") { setSent(false); typedByGame.delete(gameKey + ":sent"); } }, [err]);
  // Auto-submit at deadline − 1 s when the box has text.
  useEffect(() => {
    if (isGuesser && g?.status === "PENDING" && !sent && autoDue && view.deadline?.kind === "GUESS" && text.trim()) submit();
  }, [autoDue]);
  // Keep the input above the keyboard.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = (): void => input.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, []);
  useEffect(() => { if (g?.status === "CORRECT" && isGuesser) haptic(HAPTIC.win); }, [g?.status]);
  // A fresh state after a reconnect still says PENDING: the sent frame was lost with the socket. Resend it
  // (the server answers WRONG_PHASE if it did process it), or unlock the input when the resend can't go out.
  const resync = resyncs.value;
  useEffect(() => {
    const at = typedByGame.get(gameKey + ":sent");
    if (!isGuesser || g?.status !== "PENDING" || at === undefined || Number(at) >= resync) return;
    const v = text.trim();
    if (v && act({ type: "SUBMIT_GUESS", text: v })) {
      typedByGame.set(gameKey + ":sent", String(resync));
    } else {
      typedByGame.delete(gameKey + ":sent");
      setSent(false);
    }
  }, [resync, g?.status]);

  if (!g || !guesser) return <main class="screen"><Heading title={t("guess.title")} /></main>;
  const status = g.status;
  const myColor = me ? byId(view, me.id)?.color : undefined;

  if (isGuesser && status === "PENDING" && !sent) {
    return (
      <>
        <main class="screen screen--guess">
          {/* "Round 1 · Last chance" needs the full width: the bar gets its own row under it. */}
          <p class="eyebrow">{phaseLine(view)}</p>
          <TimerBar deadline={view.deadline} />
          <Heading title={t("guess.prompt")} />
          <input
            ref={input} class="input input--big" value={text} dir="auto" lang={view.settings.wordLocale} autoFocus
            autoCapitalize="off" autoCorrect="off" spellcheck={false} enterKeyHint="send" maxLength={GUESS_MAX_CHARS}
            placeholder={t("guess.placeholder")} aria-label={t("guess.prompt")} aria-invalid={err === "GUESS_INVALID"}
            onInput={(e) => setText(e.currentTarget.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          />
          {err === "GUESS_INVALID" ? <p class="inline-error" role="alert"><Icon name="info" size={18} />{t("error.guessInvalid")}</p> : <p class="hint">{t("guess.spelling")}</p>}
        </main>
        <footer class="actionbar">
          <Button disabled={!text.trim()} onClick={submit}>{t("guess.submit")}</Button>
        </footer>
      </>
    );
  }

  if (isGuesser) {
    return (
      <main class="screen screen--guess">
        <p class="eyebrow">{phaseLine(view)}</p>
        {status === "PENDING" ? (
          <div class="sentguess">
            <Heading title={t("guess.sent")} />
            {text.trim() && <p class="sentguess__text" dir={dirOf(view.settings.wordLocale)} lang={view.settings.wordLocale}>“{text.trim()}”</p>}
            <p class="hint hint--center"><Icon name="tv" size={18} />{t("vote.lookTv")}</p>
          </div>
        ) : (
          <>
            {status === "CORRECT" && <Confetti colors={myColor ? [COLOR_BY_ID[myColor].hex, PALETTE.text, PALETTE.accent] : undefined} />}
            <Verdict status={status} you overridden={g.overridden} name={guesser.name} />
            {text.trim() && <p class="sentguess__text" dir={dirOf(view.settings.wordLocale)} lang={view.settings.wordLocale}>“{text.trim()}”</p>}
          </>
        )}
        <TimerBar deadline={view.deadline} showSeconds={status === "PENDING"} />
      </main>
    );
  }

  const isVip = me !== null && view.hostPlayerId === me.id;
  const canAccept = isVip && status === "WRONG" && !g.overridden;
  return (
    <>
      <main class={`screen screen--watch${status === "PENDING" ? " is-dark" : ""}`}>
        <p class="eyebrow">{phaseLine(view)}</p>
        <div class="watch">
          <span class="watch__spot" aria-hidden="true" />
          {/* The verdict keeps one focal point (avatar + verdict): the spotlight card is for the wait only. */}
          {status === "PENDING" && <span class="watch__card"><RoleEmblem role="BLANK" size={72} /></span>}
          <Avatar color={guesser.color} size={status === "PENDING" ? 48 : 64} state={avatarState(guesser)} />
          {status === "PENDING" ? (
            <>
              <Heading title={t("guess.waiting", { name: isolate(guesser.name) })} />
              <p class="hint hint--center">{t("guess.silence")}</p>
            </>
          ) : (
            <Verdict status={status} you={false} overridden={g.overridden} name={guesser.name} />
          )}
        </div>
        <TimerBar deadline={view.deadline} showSeconds={status === "PENDING"} />
      </main>
      {canAccept && (
        <footer class="actionbar">
          <Button kind="secondary" onClick={() => setConfirm(true)}><Icon name="check" />{t("guess.accept")}</Button>
        </footer>
      )}
      <ConfirmSheet open={confirm} danger={false} title={t("guess.acceptConfirm", { name: isolate(guesser.name) })} confirm={t("guess.accept")}
        onConfirm={() => act({ type: "HOST_OVERRIDE_GUESS", accept: true })} onClose={() => setConfirm(false)} />
    </>
  );
}
