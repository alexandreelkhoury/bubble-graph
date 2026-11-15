// GAME-TRIVIA §9.1, DESIGN-JAMAA §2.3.1: the TV quiz shelf (two or more playable quizzes), full screen over the world
// stage. It opens on its own when the host enters Quiz Night's setup (owner request: choosing the quiz should feel like
// entering a game of its own), and again from the quiz card in the settings pane. A chip bar on top sorts the rows
// (by theme = one row per domain, or by difficulty = one row per star level) and filters by difficulty. D-pad = the TV
// mock's spatial focus; OK on a card selects it (the caller sends UPDATE_GAME_SETTINGS { quizId }, or opens the Pass
// store for a locked quiz with billing on) and closes the shelf; Back closes it without a change (tvDialogs'
// closeTopOverlay). Initial focus: the selected card.
import type { ComponentChildren } from "preact";
import { useState } from "preact/hooks";
import { Icon } from "../../components/Icon";
import { useInitialFocus } from "../../tv-mock/dpad";
import { Card, DomainIcon, domainLabel, QuizSummary, quizLocked, selectedQuiz, tk } from "./setup";
import type { QuizCard, TriviaSetup } from "./setup";
import { shelfView, starLevels } from "./setupModel";
import type { ShelfSort, ShelfStars } from "./setupModel";
import { Star } from "./tokens";

function Chip({ on, onPick, children, attr }: { on: boolean; onPick(): void; children: ComponentChildren; attr: Record<string, string> }) {
  return <button type="button" class={`tqq-chip${on ? " is-on" : ""}`} aria-pressed={on} onClick={onPick} {...attr}>{children}</button>;
}

export function QuizShelf({ setup, roomPremium, onPick }: { setup: TriviaSetup; roomPremium: boolean; onPick(q: QuizCard): void }) {
  const sel = selectedQuiz(setup)?.id ?? null;
  const first = useInitialFocus<HTMLButtonElement>();
  const [sort, setSort] = useState<ShelfSort>("theme");
  const [stars, setStars] = useState<ShelfStars>(0);
  const all = setup.extras.quizzes;
  const levels = starLevels(all);
  const rows = shelfView(all, sort, stars);
  const shown = rows.flatMap((r) => r.quizzes);
  const focusId = shown.find((q) => q.id === sel)?.id ?? shown[0]?.id ?? null;
  return (
    <div class="tvoverlay tqq-shelf" role="dialog" aria-modal="true" aria-label={tk("quiz.shelfTitle")} data-world="quiz-studio" data-quiz-shelf>
      <header class="tqq-shelf__head">
        <h2 class="tqq-shelf__title">{tk("quiz.shelfTitle")}</h2>
        <div class="tqq-shelf__bar">
          <div class="tqq-chips-group" role="group">
            <Chip on={sort === "theme"} onPick={() => setSort("theme")} attr={{ "data-sort": "theme" }}><Icon name="globe" size={16} />{tk("quiz.sortTheme")}</Chip>
            <Chip on={sort === "difficulty"} onPick={() => setSort("difficulty")} attr={{ "data-sort": "difficulty" }}><Star size={14} on />{tk("quiz.sortDifficulty")}</Chip>
          </div>
          {levels.length > 1 && (
            <div class="tqq-chips-group" role="group">
              <Chip on={stars === 0} onPick={() => setStars(0)} attr={{ "data-stars": "0" }}>{tk("quiz.all")}</Chip>
              {levels.map((n) => (
                <Chip key={n} on={stars === n} onPick={() => setStars(n)} attr={{ "data-stars": String(n) }}>{tk(`diff.${n}`)}</Chip>
              ))}
            </div>
          )}
        </div>
      </header>
      <div class="tqq-shelf__rows">
        {rows.length === 0 && <p class="tqq-shelf__none">{tk("quiz.none")}</p>}
        {rows.map((r) => {
          const label = r.kind === "domain" ? domainLabel(r.domain) : tk(`diff.${r.stars}`);
          return (
            <section key={r.key} class="tqq-shelf__row" aria-label={label}>
              <h3 class="tqq-shelf__domain">
                {r.kind === "domain" ? <DomainIcon domain={r.domain} size={20} /> : <span class="tqq-shelf__rowstars">{[1, 2, 3].map((i) => <Star key={i} size={14} on={i <= r.stars} />)}</span>}
                {label}
              </h3>
              <div class="tqq-shelf__cards" role="radiogroup" aria-label={label}>
                {r.quizzes.map((q) => (
                  <Card key={q.id} q={q} selected={q.id === sel} locked={quizLocked(q, roomPremium)} onPick={onPick} focusRef={q.id === focusId ? first : undefined} surface="tv" />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The settings pane's quiz card (always shown on Quiz Night's setup): the chosen quiz as the summary card, plus
 * "Change ›" when there is more than one quiz (OK opens the shelf). With one quiz it is not focusable (§9.1).
 */
export function QuizPick({ setup, canChange, onOpen, onKeyDown }: { setup: TriviaSetup; canChange: boolean; onOpen(): void; onKeyDown?(e: KeyboardEvent): void }) {
  if (!canChange) return <div class="tqq-pick"><QuizSummary setup={setup} surface="tv" /></div>;
  return (
    <button type="button" class="tqq-pick tqq-pick--btn" data-row="quiz" onClick={onOpen} onKeyDown={onKeyDown}>
      <QuizSummary setup={setup} surface="tv" />
      <span class="tqq-pick__change">{tk("quiz.change")}<Icon name="chevron-forward" size={18} class="flip-rtl" /></span>
    </button>
  );
}
