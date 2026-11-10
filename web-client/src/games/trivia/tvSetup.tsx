// GAME-TRIVIA §9.1, DESIGN-JAMAA §2.3.1: the TV quiz shelf (two or more playable quizzes), full screen over the world
// stage: one row per domain, 240 × 320 dp cards. D-pad = the TV mock's spatial focus; OK selects (the caller sends
// UPDATE_GAME_SETTINGS { quizId }, or opens the Pass store for a locked quiz with billing on) and closes the shelf;
// Back (Escape / Backspace / GoBack) closes it without a change. Initial focus: the selected card. Mounted by the
// platform setup pane (SPEC-GAP: the seam is outside lane B-in-G4).
import { useEffect } from "preact/hooks";
import { useInitialFocus } from "../../tv-mock/dpad";
import { Card, DomainIcon, domainLabel, quizLocked, selectedQuiz, shelfRows, tk } from "./setup";
import type { QuizCard, TriviaSetup } from "./setup";

export function QuizShelf({ setup, roomPremium, onPick, onClose }: { setup: TriviaSetup; roomPremium: boolean; onPick(q: QuizCard): void; onClose(): void }) {
  const sel = selectedQuiz(setup)?.id ?? null;
  const first = useInitialFocus<HTMLButtonElement>();
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== "Escape" && e.key !== "Backspace" && e.key !== "GoBack" && e.key !== "BrowserBack") return;
      e.preventDefault();
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);
  const rows = shelfRows(setup.extras.quizzes);
  const focusId = sel ?? setup.extras.quizzes[0]?.id ?? null;
  return (
    <div class="tqq-shelf" role="dialog" aria-modal="true" aria-label={tk("quiz.shelfTitle")} data-world="quiz-studio">
      <h2 class="tqq-shelf__title">{tk("quiz.shelfTitle")}</h2>
      <div class="tqq-shelf__rows">
        {rows.map((r) => (
          <section key={r.domain} class="tqq-shelf__row" aria-label={domainLabel(r.domain)}>
            <h3 class="tqq-shelf__domain"><DomainIcon domain={r.domain} size={20} />{domainLabel(r.domain)}</h3>
            <div class="tqq-shelf__cards" role="radiogroup" aria-label={domainLabel(r.domain)}>
              {r.quizzes.map((q) => (
                <Card key={q.id} q={q} selected={q.id === sel} locked={quizLocked(q, roomPremium)} onPick={onPick} focusRef={q.id === focusId ? first : undefined} surface="tv" />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

