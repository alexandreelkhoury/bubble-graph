// GAME-TRIVIA §8.3 / §8.4, DESIGN-JAMAA §5.4 + §7.9 (TR-PH-01..03): Quiz Night's phone screens, lazy-loaded as the
// `game-trivia` chunk (≤ 14 KB gz). The platform shell adds the top bar with ⓘ, coach marks, the flood, the results
// cup panel and the VIP buttons. Server-authoritative: the pad locks on the first tap, the verdict comes only from the
// public REVEAL; nothing on this phone shows which tile was picked except a 24 px glyph until REVEAL (§7, §8.4).
import "./phone.css";
import { useEffect, useRef, useState } from "preact/hooks";
import type { PlayerRoomView } from "@jamaa/shared/protocol/v2";
import { fmtNum, isolate, t, titleIn } from "../../i18n/t";
import type { MessageKey } from "../../i18n/t";
import { act } from "../../state/session";
import { announce, clockOffset } from "../../state/store";
import { now } from "../../components/Timer";
import { Character } from "../../components/Character";
import { Confetti } from "../../components/UI";
import { HAPTIC, haptic } from "../../lib/haptics";
import { reduced } from "../../lib/motion";
import {
  excerpt, flameLevel, gapAhead, leftMs, letterOf, playersOf, questionNumber, secs, sharedPlace, tokensOf, triviaOfPhone, verdictOf,
} from "./model";
import type { Player, Trivia, TriviaPub, Verdict } from "./model";
export { SetupExtra } from "./setup";
import { Bolt, Flame, Star, TOKEN_HEX, TOKEN_KEY, TokenChip, TokenShape } from "./tokens";
import { domainLabel, topicLabel } from "./vocab";

/** §8.4: taps are ignored for 250 ms after the pad appears (a tap meant for the previous screen). */
export const PAD_GUARD_MS = 250;
/** §5.1: the server grace subtracted from the answer time (the phone's own estimate uses the same rule). */
const GRACE_MS = 300;
const K = "game.trivia";
const tk = (k: string, p?: Record<string, string | number>): string => t(`${K}.${k}` as MessageKey, p);

function useCountUp(from: number, to: number, delayMs: number, durMs = 600): number {
  const [v, setV] = useState(reduced() ? to : from);
  useEffect(() => {
    if (reduced() || from === to) { setV(to); return; }
    let raf = 0;
    const t0 = performance.now() + delayMs;
    const tick = (n: number): void => {
      const p = Math.min(1, Math.max(0, (n - t0) / durMs));
      setV(Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [from, to]);
  return v;
}

function useLeft(pub: TriviaPub): { ms: number; frac: number } {
  const ms = leftMs(pub.deadline, now.value, clockOffset.value);
  return { ms, frac: pub.durationMs ? Math.min(1, ms / pub.durationMs) : 0 };
}

function Bar({ pub, fill = false }: { pub: TriviaPub; fill?: boolean }) {
  const { ms, frac } = useLeft(pub);
  const tone = !fill && ms <= 5000 ? " is-low" : "";
  return (
    <div class={`tq-bar${fill ? " tq-bar--fill" : ""}${tone}`} role={fill ? undefined : "timer"} aria-label={fill ? undefined : `${Math.ceil(ms / 1000)}`}>
      <span style={{ transform: `scaleX(${fill ? 1 - frac : frac})` }} />
    </div>
  );
}

function Stars({ n, size = 22 }: { n: number; size?: number }) {
  return <span class="tq-stars" role="img" aria-label={tk(`diff.${n}`)}>{[1, 2, 3].map((i) => <Star key={i} size={size} on={i <= n} />)}</span>;
}

function Eyebrow({ pub }: { pub: TriviaPub }) {
  const q = questionNumber(pub);
  return <p class="eyebrow tq-eyebrow"><span class="tnum">{tk("read.questionOf", { index: q.index, total: q.total })}</span>{pub.isFinal && <b class="tq-x2">{tk("final.stamp")}</b>}</p>;
}

/** QUIZ_INTRO: "Get ready! Quiz: Lebanon ★★". */
function Intro({ tr, me }: { tr: Trivia; me: Player | null }) {
  const pub = tr.pub;
  return (
    <main class="screen tq tq-intro">
      {me && <Character color={me.color} size={96} expression="happy" class="tq-intro__me" />}
      <h1 class="h1" tabIndex={-1}>{tk("intro.getReady", { title: isolate(titleIn(pub.quiz.title)) })}</h1>
      <p class="tq-intro__meta"><Stars n={pub.quiz.stars} /><span>{tk(`diff.${pub.quiz.stars}`)}</span></p>
      <p class="tq-intro__chips">
        <span class="tq-chipdom">{domainLabel(pub.quiz.domain)}</span>
        {pub.quiz.featuredTopics.map((x) => <span key={x} class="tq-chiptop">{topicLabel(x)}</span>)}
      </p>
      <p class="sub tnum">{tk("quiz.questions", { count: pub.total })}</p>
      {pub.rerun && <p class="tq-rerun">{tk("quiz.rerun")}</p>}
    </main>
  );
}

/** READ: "Look at the TV!" + the question in small text (accessibility) + the get-ready bar. */
function Read({ tr }: { tr: Trivia }) {
  const pub = tr.pub;
  return (
    <main class="screen tq tq-read">
      <Eyebrow pub={pub} />
      <div class="tq-read__tv" aria-hidden="true"><span /><i /></div>
      <h1 class="display" tabIndex={-1}>{tk("read.look")}</h1>
      {pub.question && <p class="tq-read__q" dir="auto">{pub.question.text}</p>}
      <Bar pub={pub} fill />
    </main>
  );
}

/** ANSWER: the pad (§8.4). Tap = lock; all tiles fade equally; "Locked in! 3.2 s"; the pick shows as a 24 px glyph. */
function Pad({ tr }: { tr: Trivia }) {
  const pub = tr.pub;
  const type = pub.question?.type ?? "mc4";
  const tokens = tokensOf(type);
  const shownAt = useRef(performance.now());
  const [local, setLocal] = useState<{ choice: number; ms: number } | null>(null);
  // A tap the pad could not take (inside the 250 ms guard, or the socket is reconnecting) gives a light press-shake
  // instead of nothing, so a player never wonders whether it counted.
  const [nudge, setNudge] = useState(0);
  const serverChoice = tr.me?.myChoice ?? null;
  const choice = serverChoice ?? local?.choice ?? null;
  const locked = choice !== null;
  const lockMs = tr.me?.myTimeMs ?? local?.ms ?? null;
  const { ms } = useLeft(pub);
  const timeUp = !locked && pub.deadline !== null && ms <= 0;
  useEffect(() => { shownAt.current = performance.now(); }, [pub.index]);
  const pick = (i: number): void => {
    if (locked || timeUp) return;
    if (performance.now() - shownAt.current < PAD_GUARD_MS || !act({ type: "GAME", gameId: "trivia", i: { type: "ANSWER", choice: i } })) {
      setNudge((n) => n + 1);
      return;
    }
    // The phone's own estimate until the server's `myTimeMs` arrives (same rule as §5.1: receipt − open − grace).
    const open = (pub.deadline ?? 0) - (pub.durationMs ?? 0);
    const est = Math.max(0, Date.now() + clockOffset.value - open - GRACE_MS);
    setLocal({ choice: i, ms: est });
    haptic(HAPTIC.voteLocked);
    announce(tk("pad.locked", { seconds: secs(est) }), true);
  };
  return (
    <main class={`tq tq-pad tq-pad--${type}${locked ? " is-locked" : ""}`} data-nudge={nudge || undefined}>
      <div class="tq-pad__head">
        <p class="tq-pad__q"><b class="num">{fmtNum(questionNumber(pub).index)} / {fmtNum(pub.total)}</b>{pub.isFinal && <b class="tq-x2">{tk("final.stamp")}</b>}
          <span dir="auto">{pub.question ? excerpt(pub.question.text, 60) : ""}</span>
          {/* §8.4: the pick shows only as a 24 px monochrome line glyph at the END of this row (no token colour, never
              beside the lock check, so from 2 m it reads neither as the choice nor as a verdict), until REVEAL. */}
          {locked && <span class="tq-pad__pick" role="img" aria-label={`${tk("pad.yourPick")}: ${t(TOKEN_KEY[tokens[choice] ?? "a"])}`}><TokenShape id={tokens[choice] ?? "a"} size={24} outline /></span>}</p>
        {locked ? (
          <p class="tq-pad__locked" role="status">
            <span class="tq-pad__check" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" /></svg></span>
            <span class="tnum">{tk("pad.locked", { seconds: lockMs === null ? "…" : secs(lockMs) })}</span>
          </p>
        ) : timeUp ? <p class="tq-pad__locked">{tk("pad.tooLate")}</p> : <Bar pub={pub} />}
      </div>
      <div key={`g${nudge}`} class={`tq-pad__grid${nudge ? " is-nudged" : ""}`} role="group" aria-label={pub.question?.text ?? ""}>
        {tokens.map((id, i) => {
          const letter = letterOf(id);
          return (
            <button key={id} type="button" class={`tq-tile tq-tile--${id}`} style={{ "--tile": TOKEN_HEX[id] }} disabled={locked || timeUp}
              aria-label={`${letter ?? ""} ${t(TOKEN_KEY[id])}: ${pub.options[i] ?? ""}`}
              onPointerDown={(e) => { if (e.isPrimary) pick(i); }} onClick={() => pick(i)}>
              {letter && <span class="tq-tile__letter">{letter}</span>}
              <TokenShape id={id} size={64} class="tq-tile__shape" />
              <span class="tq-tile__text" dir="auto">{id === "false" ? <span class="tq-tile__strip">{pub.options[i] || tk("tf.false")}</span> : (pub.options[i] || (id === "true" ? tk("tf.true") : ""))}</span>
            </button>
          );
        })}
      </div>
    </main>
  );
}

/** Joined mid-game: plays from the next question (§6 late joiner). */
function Waiting() {
  return (
    <main class="screen tq tq-wait">
      <span class="tq-wait__icon" aria-hidden="true"><TokenShape id="a" size={40} color="#FFC94D" /></span>
      <h1 class="h1" tabIndex={-1}>{tk("pad.waiting")}</h1>
      <p class="sub">{tk("read.look")}</p>
    </main>
  );
}

/** REVEAL (TR-PH-03): the full-screen verdict + own rank, and the score counter the coin flies into. */
function VerdictScreen({ tr, me, v }: { tr: Trivia; me: Player | null; v: Verdict }) {
  const pub = tr.pub;
  const r = pub.reveal!;
  const type = pub.question?.type ?? "mc4";
  const tokens = tokensOf(type);
  const before = me?.row.scoreBefore ?? 0, after = me?.row.score ?? 0;
  const score = useCountUp(before, after, 650);
  if (v.kind === "waiting") return <Waiting />;
  const right = r.correct;
  const answer = (
    <div class="tq-answer" style={{ "--tile": TOKEN_HEX[tokens[right] ?? "a"] }}>
      <TokenChip id={tokens[right] ?? "a"} size={36} />
      <span dir="auto">{pub.options[right] ?? ""}</span>
      <svg class="tq-answer__ok" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" /></svg>
    </div>
  );
  const rank = "rank" in v && v.rank !== null ? v.rank : null;
  return (
    <main class={`screen tq tq-verdict tq-verdict--${v.kind}`}>
      <Eyebrow pub={pub} />
      {v.kind === "correct" && (
        <>
          <div class="tq-verdict__hero">
            {me && <span class="tq-verdict__me">{v.onFire && <Flame size={72} level={flameLevel(v.streak)} />}<Character color={me.color} size={96} expression="cheer" /></span>}
            <h1 class="display" tabIndex={-1}>{tk("reveal.correct", { points: fmtNum(v.points) })}</h1>
            <p class="tq-verdict__chips">
              {v.final && <span class="tq-x2 tq-x2--big">{tk("final.stamp")}</span>}
              {v.streakBonus > 0 && <span class="tq-bonus tnum">{tk("reveal.streakBonus", { points: fmtNum(v.streakBonus) })}</span>}
              {v.fastest && me && <span class="tq-fast"><Bolt size={20} />{tk("reveal.fastest", { name: isolate(me.name) })}</span>}
            </p>
          </div>
          <div class="tq-score" aria-hidden="true">
            {!reduced() && <i class="tq-coin" style={{ background: me ? `var(--player-${me.color})` : undefined }} />}
            <b class="tnum num">{fmtNum(score)}</b>
          </div>
          {v.onFire && <p class="tq-fire"><Flame size={22} />{tk("streak", { count: v.streak })}</p>}
        </>
      )}
      {v.kind === "wrong" && (
        <div class="tq-verdict__hero">
          {me && <Character color={me.color} size={96} expression="sad" />}
          <h1 class="display" tabIndex={-1}>{tk("reveal.wrong")}</h1>
          {answer}
        </div>
      )}
      {v.kind === "none" && (
        <div class="tq-verdict__hero">
          {me && <Character color={me.color} size={96} expression="shock" />}
          <h1 class="display" tabIndex={-1}>{r.tooSlow ? tk("reveal.tooSlow") : tk("reveal.noAnswer")}</h1>
          {answer}
        </div>
      )}
      {v.kind === "voided" && (
        <div class="tq-verdict__hero">
          <h1 class="h1" tabIndex={-1}>{tk("pause.voided")}</h1>
        </div>
      )}
      {r.stumped && !r.tooSlow && v.kind !== "voided" && <p class="tq-banner">{tk("reveal.stumped")}</p>}
      {r.genius && <p class="tq-banner tq-banner--good">{tk("reveal.genius")}</p>}
      {rank !== null && v.kind !== "voided" && <p class="tq-rank tnum">{tk("reveal.yourRank", { rank: fmtNum(rank) })}</p>}
      {r.explain && <aside class="tq-explain"><b>{tk("reveal.didYouKnow")}</b><span dir="auto">{r.explain}</span></aside>}
    </main>
  );
}

/** LEADERBOARD: own rank, points, gap to the player ahead ("120 behind Maya"), climb. */
function Standing({ tr, me, ps }: { tr: Trivia; me: Player; ps: Player[] }) {
  const gap = gapAhead(ps, me.id);
  const score = useCountUp(me.row.scoreBefore, me.row.score, 200, 1200);
  const climb = me.row.rankBefore !== null && me.row.rank !== null ? me.row.rankBefore - me.row.rank : 0;
  return (
    <main class="screen tq tq-standing">
      <p class="eyebrow">{tk("leaderboard.title")}</p>
      <div class="tq-standing__hero">
        <Character color={me.color} size={96} expression={me.row.rank === 1 ? "cheer" : climb > 0 ? "happy" : "idle"} crown={me.row.rank === 1 && me.row.score > 0} />
        <p class="tq-standing__rank tnum"><span>#</span>{fmtNum(me.row.rank ?? 0)}</p>
      </div>
      <p class="tq-standing__pts tnum num">{tk("results.points", { points: fmtNum(score) })}</p>
      {climb > 0 && <p class="tq-climb">{tk("leaderboard.climb", { count: climb })}</p>}
      {gap && (gap.leading
        ? <p class="h1 tq-lead" tabIndex={-1}>{tk("leaderboard.leading")}</p>
        : <p class="h1" tabIndex={-1}>{tk("leaderboard.behind", { points: fmtNum(gap.points), name: isolate(gap.name) })}</p>)}
      {me.row.streak >= 3 && <p class="tq-fire"><Flame size={22} />{tk("streak", { count: me.row.streak })}</p>}
      <p class="sub">{tr.pub.index + 1 < tr.pub.total ? tk("read.look") : ""}</p>
    </main>
  );
}

function Final() {
  return (
    <main class="screen tq tq-final">
      <p class="tq-final__stamp" aria-hidden="true">{tk("final.stamp")}</p>
      <h1 class="display" tabIndex={-1}>{tk("final.phone")}</h1>
      <p class="sub">{tk("read.look")}</p>
    </main>
  );
}

function Hold() {
  return (
    <main class="screen tq tq-wait">
      <h1 class="h1" tabIndex={-1}>{tk("hold.title")}</h1>
      <p class="sub">{tk("hold.body")}</p>
    </main>
  );
}

/** RESULTS: place, points, correct count, best streak (the platform adds the cup and the VIP buttons under it). */
function MyResult({ me, ps }: { me: Player; ps: Player[] }) {
  const r = me.row;
  const win = r.rank === 1;
  return (
    <main class={`screen tq tq-result${win ? " is-win" : ""}`}>
      {win && <Confetti colors={["#FFC94D", "#478CFF", "#1FA88A", "#FF4F9A", "#FFF7EC"]} />}
      <p class="eyebrow">{tk("results.title")}</p>
      <div class="tq-result__hero">
        <Character color={me.color} size={112} expression={win ? "cheer" : r.rank !== null && r.rank <= 3 ? "happy" : "idle"} crown={win} />
        <p class="tq-result__place tnum"><span>#</span>{fmtNum(r.rank ?? 0)}</p>
      </div>
      <h1 class="h1" tabIndex={-1}>{tk("results.place", { rank: fmtNum(r.rank ?? 0) })}{sharedPlace(ps, me.id) ? ` · ${tk("results.shared")}` : ""}</h1>
      <ul class="tq-result__stats">
        <li class="tq-result__pts tnum">{tk("results.points", { points: fmtNum(r.score) })}</li>
        <li><TokenChip id="true" size={22} /><span class="tnum">{tk("results.correctCount", { count: r.correct })}</span></li>
        <li><Flame size={18} /><span class="tnum">{tk("results.bestStreak", { count: fmtNum(r.bestStreak) })}</span></li>
      </ul>
    </main>
  );
}

export function Phone({ view }: { view: PlayerRoomView }) {
  const tr = triviaOfPhone(view);
  if (!tr) return null;
  const myId = view.me?.id ?? null;
  const ps = playersOf(view.room, tr.pub);
  const me = ps.find((p) => p.id === myId) ?? null;
  const waiting = !!tr.me?.waitingForNext;
  switch (tr.pub.phase) {
    case "QUIZ_INTRO": return <Intro tr={tr} me={me} />;
    case "READ": return waiting ? <Waiting /> : <Read tr={tr} />;
    case "ANSWER": return waiting || !me ? <Waiting /> : <Pad key={tr.pub.index} tr={tr} />;
    case "REVEAL": {
      const v = verdictOf(tr.pub, tr.me, myId);
      return v ? <VerdictScreen tr={tr} me={me} v={v} /> : <Waiting />;
    }
    case "LEADERBOARD": return me ? <Standing tr={tr} me={me} ps={ps} /> : <Waiting />;
    case "FINAL_INTRO": return <Final />;
    case "HOLD": return <Hold />;
    case "RESULTS": return me ? <MyResult me={me} ps={ps} /> : null;
    default: return null;
  }
}

export function screenKey(view: PlayerRoomView): string {
  const tr = triviaOfPhone(view);
  return tr ? `${tr.n}:${tr.pub.phase}:${tr.pub.index}` : "none";
}

const PHASE_KEY: Record<TriviaPub["phase"], string> = {
  QUIZ_INTRO: "phase.quizIntro", READ: "phase.read", ANSWER: "phase.answer", REVEAL: "phase.reveal",
  LEADERBOARD: "phase.leaderboard", FINAL_INTRO: "phase.finalIntro", HOLD: "phase.hold", RESULTS: "phase.results",
};

/** Haptics and announcements: the verdict buzzes only once the public REVEAL arrives (never earlier: no tells). */
export function onPhoneView(prev: PlayerRoomView | null, next: PlayerRoomView): void {
  const n = triviaOfPhone(next);
  if (!n) return;
  const p = prev ? triviaOfPhone(prev) : null;
  if (p && p.pub.phase === n.pub.phase && p.pub.index === n.pub.index) return;
  announce(tk(PHASE_KEY[n.pub.phase]));
  const myId = next.me?.id ?? null;
  if (n.pub.phase === "ANSWER" && !n.me?.waitingForNext && n.me?.myChoice === null) haptic(HAPTIC.nextUp);
  if (n.pub.phase === "REVEAL") {
    const v = verdictOf(n.pub, n.me, myId);
    if (v?.kind === "correct") { haptic([20, 40, 20]); announce(tk("reveal.correct", { points: v.total }), true); }
    else if (v?.kind === "wrong" || v?.kind === "none") haptic(40);
  }
  if (n.pub.phase === "RESULTS" && myId && n.pub.scores.find((s) => s.playerId === myId)?.rank === 1) haptic(HAPTIC.win);
}

/** The ⓘ sheet's "Your turn!" banner: this phone owes an answer. */
export function needsMe(view: PlayerRoomView): boolean {
  const tr = triviaOfPhone(view);
  const myId = view.me?.id;
  if (!tr || !myId || tr.pub.phase !== "ANSWER" || tr.me?.waitingForNext) return false;
  return tr.me?.myChoice === null && !tr.pub.answeredIds.includes(myId);
}

/** Coach marks: the first question only. */
export function firstRound(view: PlayerRoomView): boolean {
  const tr = triviaOfPhone(view);
  return !tr || tr.pub.index === 0;
}
