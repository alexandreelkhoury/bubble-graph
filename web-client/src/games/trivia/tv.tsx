// GAME-TRIVIA §8.3 / §12, DESIGN-JAMAA §5.4 + §7.9 (TR-TV-01..06): Quiz Night's /tv screens, lazy-loaded as the
// `tv-mock-game-trivia` chunk inside the platform canvas (entrance, pause menu with Next / Void this question / End
// game, rules sheet, back hint, results bar with the cup). The TV only ever draws its own projection: no correct index
// before REVEAL and no player's choice before REVEAL exist in it (§8.1), and the characters are a function of it.
import "./tv.css";
import type { TvRoomView } from "@jamaa/shared/protocol/v2";
import { fmtNum, t, titleIn } from "../../i18n/t";
import type { MessageKey } from "../../i18n/t";
import { playAll } from "../../tv-mock/sound/player";
import { activePlayers, playersOf, triviaOfTv } from "./model";
import type { Player, Trivia, TriviaPub } from "./model";
import { viewCues } from "./cues";
import { Reveal } from "./tv/reveal";
import { Board, Results } from "./tv/board";
import { PodiumRow, QuestionCard, Stars, Studio, Tiles, TopBar, Tower, tk, topicLabel } from "./tv/parts";

/** TR-TV-01 Quiz intro: the quiz card scales in from the marquee, the stars fill one by one, domain and topic chips
 *  stagger in, "10 questions" (DESIGN-JAMAA §5.4). Characters stand behind their podiums. */
function QuizIntro({ tr, ps }: { tr: Trivia; ps: Player[] }) {
  const q = tr.pub.quiz;
  const more = Math.max(0, q.topicCount - q.featuredTopics.length);
  return (
    <>
      <section class="tqquiz" aria-label={titleIn(q.title)}>
        <div class="tqquiz__cover" aria-hidden="true"><span /><span /><span /></div>
        <h1 class="tqquiz__title">{titleIn(q.title)}</h1>
        <Stars n={q.stars} size={34} />
        <p class="tqquiz__chips">
          <span class="tqquiz__dom">{t(`content.domain.${q.domain}` as MessageKey)}</span>
          {q.featuredTopics.map((x, i) => <span key={x} class="tqquiz__top" style={{ "--i": i }}>{topicLabel(x)}</span>)}
          {more > 0 && <span class="tqquiz__top tqquiz__more num" style={{ "--i": q.featuredTopics.length }}>+{fmtNum(more)}</span>}
        </p>
        <p class="tqquiz__count tnum">{tk("quiz.questions", { count: tr.pub.total })}{tr.pub.rerun && <em>{tk("quiz.rerun")}</em>}</p>
      </section>
      <PodiumRow tr={tr} players={activePlayers(ps)} />
    </>
  );
}

/** TR-TV-02a/02 Read and Answer: the question card slams in; READ shows ghost tiles and the get-ready bar, ANSWER flips
 *  the tiles in A→D and runs the bulb ring; a podium lights up (white) when its player answered. */
function Question({ tr, ps, answer }: { tr: Trivia; ps: Player[]; answer: boolean }) {
  const pub = tr.pub;
  const answered = new Set([...pub.answeredIds, ...tr.doneIds]);
  return (
    <>
      <QuestionCard pub={pub} mode={answer ? "answer" : "read"} />
      <Tiles pub={pub} mode={answer ? "answer" : "ghost"} />
      <Tower players={ps} />
      <PodiumRow tr={tr} players={activePlayers(ps)} lit={answer ? (p) => answered.has(p.id) : undefined} />
      {answer && <p class="tqanswered tnum" aria-live="polite">{fmtNum(answered.size)} / {fmtNum(activePlayers(ps).filter((p) => !p.waiting).length)}</p>}
    </>
  );
}

/** TR-TV-05 Final intro: the studio light goes red-amber, a drum build, "×2" stamps onto the screen. */
function FinalIntro({ tr, ps }: { tr: Trivia; ps: Player[] }) {
  return (
    <>
      <section class="tqfinal">
        <p class="tqfinal__kicker">{tk("phase.finalIntro")}</p>
        <h1 class="tqfinal__title">{tk("final.title")}</h1>
        <p class="tqfinal__stamp" aria-hidden="true">{tk("final.stamp")}</p>
      </section>
      <PodiumRow tr={tr} players={activePlayers(ps)} />
    </>
  );
}

function Hold({ tr, ps }: { tr: Trivia; ps: Player[] }) {
  return (
    <>
      <section class="tqhold">
        <h1 class="tqhold__title">{tk("hold.title")}</h1>
        <p class="tqhold__body">{tk("hold.body")}</p>
      </section>
      <PodiumRow tr={tr} players={activePlayers(ps)} />
    </>
  );
}

export function Tv({ view }: { view: TvRoomView }) {
  const tr = triviaOfTv(view);
  if (!tr) return null;
  const pub = tr.pub;
  const ps = playersOf(view.room, pub);
  const heat = pub.phase === "FINAL_INTRO";
  let body;
  switch (pub.phase) {
    case "QUIZ_INTRO": body = <QuizIntro tr={tr} ps={ps} />; break;
    case "READ": body = <Question tr={tr} ps={ps} answer={false} />; break;
    case "ANSWER": body = <Question tr={tr} ps={ps} answer />; break;
    case "REVEAL": body = pub.reveal ? <Reveal tr={tr} ps={ps} /> : null; break;
    case "LEADERBOARD": body = <Board tr={tr} ps={ps} />; break;
    case "FINAL_INTRO": body = <FinalIntro tr={tr} ps={ps} />; break;
    case "HOLD": body = <Hold tr={tr} ps={ps} />; break;
    case "RESULTS": body = <Results tr={tr} ps={ps} />; break;
    default: body = null;
  }
  return (
    <div class={`tqtv tqtv--${pub.phase.toLowerCase().replace("_", "-")}${pub.isFinal ? " is-final" : ""}`} data-world="quiz-studio" data-phase={pub.phase}>
      <Studio coast={pub.quiz.domain === "lebanon"} heat={heat} dim={pub.phase === "LEADERBOARD" || pub.phase === "RESULTS"} />
      <TopBar tr={tr} code={view.room.roomCode} />
      {body}
    </div>
  );
}

export function screenKey(view: TvRoomView): string {
  const tr = triviaOfTv(view);
  return tr ? `${tr.n}:${tr.pub.phase}:${tr.pub.index}` : "none";
}

let last: TriviaPub | null = null;
/** Sound cues for each broadcast (phase changes, answer locks); timelines play their own marks. */
export function onTvView(_prev: TvRoomView | null, next: TvRoomView): void {
  const tr = triviaOfTv(next);
  if (!tr) { last = null; return; }
  playAll(viewCues(last, tr.pub));
  last = tr.pub;
}

/** The "◁ Back: menu & rules" hint stays on during the first question (platform §3.2 HUB-06). */
export function firstRound(view: TvRoomView): boolean {
  const tr = triviaOfTv(view);
  return !!tr && tr.pub.index === 0 && tr.pub.phase !== "RESULTS";
}
