// Small pieces shared by Most Likely's phone and /tv screens.
import { useEffect, useRef } from "preact/hooks";
import { fmtNum, t, tSplit } from "../../i18n/t";
import type { MessageKey } from "../../i18n/t";
import { registerIcons } from "../../components/Icon";
import type { LikelyAward } from "./model";

/** Keys of this game (the i18n catalog types them; `k` keeps call sites short). */
export const k = (s: string): MessageKey => `game.likely.${s}` as MessageKey;

/** Icons only Most Likely draws (registered by its chunks). */
registerIcons({
  "lk-ballot": "M5 10h14v10H5zM8 10V4h8v6M10 7h4",
  "lk-speech": "M5.5 4h13A2.5 2.5 0 0 1 21 6.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-5 4v-4h.5A2.5 2.5 0 0 1 3 14.5v-8A2.5 2.5 0 0 1 5.5 4zM8 10.5h.01M12 10.5h.01M16 10.5h.01",
  "lk-users": "M9 4.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 1 0 0-7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 20a6.5 6.5 0 0 0-2.2-4.9",
  "lk-sparkle": "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z",
});

/**
 * "Who's most likely to / cry at a wedding?" from `card.question` (so each locale keeps its own punctuation: ¿…?, « ? »,
 * ؟): the lead-in on its own line, the prompt and the closing mark big.
 */
export function Question({ prompt, class: cls }: { prompt: string; class?: string }) {
  const [before, after] = tSplit(k("card.question"), "prompt", { prompt: "" });
  return (
    <p class={`lk-q${cls ? ` ${cls}` : ""}`}>
      <span class="lk-q__lead">{before.trim()}</span>
      <span class="lk-q__prompt" dir="auto">{prompt}{after.trimEnd()}</span>
    </p>
  );
}

/** The whole question as one plain string (aria labels, announcements). */
export function questionText(prompt: string): string {
  return t(k("card.question"), { prompt });
}

/** A number that ticks from `from` to `to` (driven by a parent's progress 0..1 through `data-*` or the `p` prop). */
export function Tick({ from, to, p }: { from: number; to: number; p: number }) {
  return <span class="tnum">{fmtNum(Math.round(from + (to - from) * Math.min(1, Math.max(0, p))))}</span>;
}

/** Focus the heading of a new phone screen once (screen readers land on it, like the platform Heading). */
export function useFocusOnMount<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => { ref.current?.focus({ preventScroll: true }); }, []);
  return ref;
}

/** The award's title and its one-line reason. */
export function awardText(a: LikelyAward): { title: string; line: string } {
  switch (a.kind) {
    case "signature": return { title: a.card?.award ?? "", line: a.card ? questionText(a.card.prompt) : "" };
    case "mystery": return { title: t(k("awards.mystery.title")), line: t(k("awards.mystery.line")) };
    case "star": return { title: t(k("awards.star.title")), line: t(k("awards.star.line")) };
    case "selfAware": return { title: t(k("awards.selfAware.title")), line: t(k("awards.selfAware.line")) };
    case "mindReader": return { title: t(k("awards.mindReader.title")), line: t(k("awards.mindReader.line")) };
  }
}

