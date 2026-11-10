// GAME-TRIVIA §9 / §9.1, DESIGN-JAMAA §2.3.1: Quiz Night's setup pieces, built for the platform setup pane to mount
// (TV HUB-03 and the VIP phone). Lane B-in-G4 owns this folder only, so the platform seam that mounts them (the
// quizId row of lib/gameSettings, tv-mock/tvSetup, platform/SettingsList) is a SPEC-GAP for the platform owner.
// Neither in-game module (phone, tv) imports this file: it never weighs on the in-game chunks. The TV shelf lives in
// tvSetup.tsx (it uses the TV mock's focus helpers, which must stay out of the phone bundle).
//
//  - <QuizSummary>  one playable quiz: a non-focusable 300 × 96 dp card above the rows (nothing to open);
//  - <QuizList>     the VIP phone: the same cards as a vertical list (radio semantics);
//  - <SetupHint>    "7 questions · 15 s to answer" (+ "7 questions available" when the pool caps the length);
//  - quizRowValue() the row's value: the selected quiz's title, never "All packs" (null = extras.quiz).
import "./setup.css";
import type { Ref } from "preact";
import { fmtNum, t, titleIn } from "../../i18n/t";
import type { MessageKey } from "../../i18n/t";
import { Icon } from "../../components/Icon";
import { Star } from "./tokens";
import { moreTopics, quizLocked, quizRowValue as rowValue, selectedQuiz, setupHint } from "./setupModel";
import type { QuizCard, TriviaSetup } from "./setupModel";

export { isTriviaSetup, quizLocked, quizUi, selectedQuiz, shelfRows } from "./setupModel";
export type { QuizCard, TriviaSetup } from "./setupModel";

export const tk = (k: string, p?: Record<string, string | number>): string => t(`game.trivia.${k}` as MessageKey, p);
export const domainLabel = (d: string): string => t(`content.domain.${d}` as MessageKey);
const topicLabel = (x: string): string => t(`content.topic.${x}` as MessageKey);

/** The `quizId` row's value on TV and phone (the resolved quiz title). */
export const quizRowValue = (setup: TriviaSetup): string => rowValue(setup, (x) => titleIn(x));

/** The domain glyph: an arch for `lebanon`, a globe for every other domain (no national or religious symbols). */
export function DomainIcon({ domain, size }: { domain: string; size: number }) {
  if (domain !== "lebanon") return <Icon name="globe" size={size} />;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <path d="M4 20V11a8 8 0 0 1 16 0v9M8 20v-8a4 4 0 0 1 8 0v8M2.5 20h19" />
    </svg>
  );
}

function StarsLine({ n, size }: { n: number; size: number }) {
  return (
    <span class="tqq-stars">
      <span class="tqq-stars__row" role="img" aria-label={tk(`diff.${n}`)}>{[1, 2, 3].map((i) => <Star key={i} size={size} on={i <= n} />)}</span>
      <span class="tqq-stars__word">{tk(`diff.${n}`)}</span>
    </span>
  );
}

function Chips({ q }: { q: QuizCard }) {
  const more = moreTopics(q);
  return (
    <span class="tqq-chips">
      <span class="tqq-dom"><DomainIcon domain={q.domain} size={14} />{domainLabel(q.domain)}</span>
      {q.featuredTopics.map((x) => <span key={x} class="tqq-top">{topicLabel(x)}</span>)}
      {more > 0 && <span class="tqq-top num">+{fmtNum(more)}</span>}
    </span>
  );
}

/** Flat, palette-based cover art (no flags, no symbols): a coast and hills at sunset for Lebanon, a night globe else. */
function Cover({ domain }: { domain: string }) {
  return <span class={`tqq-cover tqq-cover--${domain === "lebanon" ? "coast" : "globe"}`} aria-hidden="true"><i /><i /><i /></span>;
}

/** DESIGN-JAMAA §2.3.1 one quiz: the non-interactive summary card above the rows (TV 300 × 96 dp; phone full width). */
export function QuizSummary({ setup, surface = "tv" }: { setup: TriviaSetup; surface?: "tv" | "phone" }) {
  const q = selectedQuiz(setup);
  if (!q) return null;
  return (
    <section class={`tqq-summary tqq-summary--${surface}`} aria-label={`${tk("settings.quiz")}: ${titleIn(q.title)}`} data-quiz-summary={q.id}>
      <Cover domain={q.domain} />
      <span class="tqq-summary__body">
        <bdi class="tqq-summary__title">{titleIn(q.title)}</bdi>
        <StarsLine n={q.stars} size={surface === "tv" ? 14 : 16} />
        <Chips q={q} />
      </span>
    </section>
  );
}

export function Card({ q, selected, locked, onPick, focusRef, surface }: {
  q: QuizCard; selected: boolean; locked: boolean; onPick(q: QuizCard): void; focusRef?: Ref<HTMLButtonElement> | undefined; surface: "tv" | "phone";
}) {
  return (
    <button type="button" ref={focusRef} class={`tqq-card tqq-card--${surface}${selected ? " is-selected" : ""}${locked ? " is-locked" : ""}`}
      role="radio" aria-checked={selected} data-quiz={q.id} data-default-focus={selected ? true : undefined} onClick={() => onPick(q)}>
      <Cover domain={q.domain} />
      {selected && <span class="tqq-card__check" aria-label={tk("quiz.selected")}><Icon name="check" size={18} /></span>}
      <bdi class="tqq-card__title">{titleIn(q.title)}</bdi>
      <StarsLine n={q.stars} size={surface === "tv" ? 18 : 16} />
      <Chips q={q} />
      <span class="tqq-card__foot">
        <span class="tnum">{tk("quiz.questions", { count: q.questionCount })}</span>
        {locked && <span class="tqq-lock"><Icon name="lock" size={14} />{tk("quiz.locked")}</span>}
      </span>
    </button>
  );
}

/** §9.1 the VIP phone: the same cards as a vertical list (or nothing: the summary card covers one quiz). */
export function QuizList({ setup, roomPremium, onPick }: { setup: TriviaSetup; roomPremium: boolean; onPick(q: QuizCard): void }) {
  const sel = selectedQuiz(setup)?.id ?? null;
  return (
    <div class="tqq-list" role="radiogroup" aria-label={tk("settings.quiz")}>
      {setup.extras.quizzes.map((q) => <Card key={q.id} q={q} selected={q.id === sel} locked={quizLocked(q, roomPremium)} onPick={onPick} surface="phone" />)}
    </div>
  );
}

/** §9: "7 questions · 15 s to answer", and "7 questions available" when the quiz's pool caps the chosen length. */
export function SetupHint({ setup }: { setup: TriviaSetup }) {
  const h = setupHint(setup);
  return (
    <p class="tqq-hint tnum" data-trivia-hint>
      <span>{tk("settings.lengthCount", { count: h.count })}</span>
      <span aria-hidden="true"> · </span>
      <span>{tk("settings.paceSeconds", { seconds: h.seconds })}</span>
      {h.capped && <em class="tqq-hint__cap">{tk("settings.available", { count: h.available })}</em>}
    </p>
  );
}
