// PH-04 hold-to-reveal (DESIGN §6.2-A, §13.3): idle → pressing (150 ms) → revealed → idle.
// The word element is only mounted while revealed, so it never sits hidden in the DOM.
import { useEffect, useRef, useState } from "preact/hooks";
import type { JSX } from "preact";
import type { ColorId, Locale } from "@mishana/shared/constants";
import type { Role } from "@mishana/shared/engine";
import type { WordRef } from "@mishana/shared/engine";
import { HAPTIC, haptic } from "../lib/haptics";
import { dirOf, t } from "../i18n/t";
import { announce, assertiveMsg } from "../state/store";
import { Icon } from "./Icon";
import { RoleChip, RoleEmblem } from "./Role";
import { colorVars, LIGHT_GLYPH } from "./PlayerChip";

export const HOLD_THRESHOLD_MS = 150;
export const TAP_REVEAL_MS = 5000;

type HoldState = "idle" | "pressing" | "revealed";

export function useHoldReveal(onReveal?: () => void, onTapReveal?: () => void) {
  const [state, setState] = useState<HoldState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapMode = useRef(false);
  const clear = (): void => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  };
  const hide = (): void => {
    clear();
    tapMode.current = false;
    setState("idle");
  };
  const reveal = (): void => {
    setState("revealed");
    haptic(HAPTIC.reveal);
    onReveal?.();
  };
  useEffect(() => {
    const onHide = (): void => { if (document.visibilityState !== "visible") hide(); };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("blur", hide);
    return () => {
      clear();
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("blur", hide);
    };
  }, []);
  const end = (): void => { if (!tapMode.current) hide(); };
  const handlers = {
    onPointerDown: (e: JSX.TargetedPointerEvent<HTMLElement>) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      tapMode.current = false;
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      clear();
      setState("pressing");
      timer.current = setTimeout(() => { timer.current = null; reveal(); }, HOLD_THRESHOLD_MS);
    },
    onPointerUp: end,
    onPointerCancel: end,
    onPointerLeave: end,
    onLostPointerCapture: end,
    onBlur: end,
    onContextMenu: (e: Event) => e.preventDefault(),
    // Keyboard / screen-reader activation (detail === 0): show for 5 s.
    onClick: (e: JSX.TargetedMouseEvent<HTMLElement>) => { if (e.detail === 0) showFor5(); },
  };
  const showFor5 = (): void => {
    clear();
    tapMode.current = true;
    reveal();
    onTapReveal?.();
    timer.current = setTimeout(hide, TAP_REVEAL_MS);
  };
  return { state, revealed: state === "revealed", handlers, showFor5, hide };
}

export interface WordCardProps {
  word: WordRef | null;
  isBlank: boolean;
  role: Role | null;
  color: ColorId;
  wordLocale: Locale;
  seenOnce: boolean;
  onReveal(): void;
}

function WordText({ word, wordLocale, big = true }: { word: WordRef; wordLocale: Locale; big?: boolean }) {
  return (
    <span class={big ? "wordface__word" : "peek__word"} lang={wordLocale} dir={dirOf(wordLocale)}>
      <span class="wordface__text">{word.text}</span>
      {word.translit !== null && <span class="wordface__translit" dir="auto">{word.translit}</span>}
    </span>
  );
}

export function WordCard({ word, isBlank, role, color, wordLocale, seenOnce, onReveal }: WordCardProps) {
  // Screen-reader path only: announce the word, then clear the live region after 5 s.
  const h = useHoldReveal(onReveal, () => {
    announce(isBlank || !word ? t("reveal.youAreBlank") : word.text, true);
    setTimeout(() => { assertiveMsg.value = ""; }, TAP_REVEAL_MS);
  });
  // Every face is the player's own colour, the Blank's too: a white flash of screen light would out the Blank across
  // the sofa. Paper white stays for the public reveal (TV-09, results).
  const faceCls = `${LIGHT_GLYPH(color) ? "wordface--dark" : "wordface--color"}${isBlank ? " wordface--blank" : ""}`;
  return (
    <div class="wordcard-wrap">
      <button
        type="button"
        class={`wordcard${h.state === "pressing" ? " is-pressing" : ""}${h.revealed ? " is-revealed" : ""}`}
        style={colorVars(color)}
        aria-label={t("reveal.showFor5")}
        {...h.handlers}
      >
        <span class="wordcard__back" aria-hidden={h.revealed}>
          <span class="wordcard__pattern" />
          <Icon name="hand-press" size={56} class="wordcard__hand" />
          <span class="wordcard__label">{seenOnce ? t("reveal.firstTime") : t("reveal.holdToSee")}</span>
        </span>
        {h.revealed && (
          <span class={`wordface ${faceCls}`} aria-live="off">
            {isBlank || !word ? (
              <>
                <RoleEmblem role="BLANK" size={88} />
                <span class="wordface__blank-title">{t("reveal.youAreBlank")}</span>
                <span class="wordface__blank-body">{t("reveal.noWord")}<br />{t("reveal.blankBody")}</span>
              </>
            ) : (
              <>
                <WordText word={word} wordLocale={wordLocale} />
                {/* The twist, word for word the same for Civilians and Moles (it leaks nothing). Beginner mode names the
                    role on the card instead. */}
                {!role && <span class="wordface__twist">{t("reveal.twist")}</span>}
              </>
            )}
            {role && !isBlank && <RoleChip role={role} size={22} />}
            <span class="wordface__hint">{t("reveal.release")}</span>
          </span>
        )}
      </button>
      <button type="button" class="linkbtn" onClick={h.showFor5}>{t("reveal.tapAlt")}</button>
    </div>
  );
}

/**
 * PH-05/06/10 bottom "Hold to peek my word" button; the word, or the Blank's card and bluffing tip, shows in a bubble
 * above while held, never on the open screen. The label is the same for every role while alive (no tell); once out
 * (`out`, the role is public) the Blank's reads "Hold to see my card".
 */
export function PeekButton({ word, isBlank, wordLocale, onDark = false, out = false }: { word: WordRef | null; isBlank: boolean; wordLocale: Locale; onDark?: boolean; out?: boolean }) {
  const h = useHoldReveal();
  const blank = isBlank || !word;
  return (
    <div class="peek">
      {h.revealed && (
        <div class="peek__bubble" role="status">
          {blank || !word ? (
            <span class="peek__blankcard">
              <span class="peek__blank"><RoleEmblem role="BLANK" size={28} />{t("reveal.noWord")}</span>
              {isBlank && <span class="peek__tip">{t("clues.blankBody")}</span>}
            </span>
          ) : (
            <WordText word={word} wordLocale={wordLocale} big={false} />
          )}
        </div>
      )}
      <button type="button" class={`btn btn--secondary btn--peek${onDark ? " btn--on-color" : ""}${h.revealed ? " is-held" : ""}`} aria-label={t("reveal.showFor5")} {...h.handlers}>
        <Icon name={h.revealed ? "eye-off" : "eye"} />
        <span>{t(blank && out ? "clues.peekRole" : "clues.peek")}</span>
      </button>
    </div>
  );
}
