// GAME-TAQRIBAN §8.3 on /tv (TQ-TV-01..05), lazy-loaded as the `tv-mock-game-taqriban` chunk inside the platform canvas
// (960 × 540). No focusable buttons in game: host actions are pause-menu items (Skip question, Next, Finish now). The
// TV draws only its projection: no answer and no guess exist in it before REVEAL (§8.1).
// The number-line reveal is the star (§8.3): the line draws, every guess drops onto it one by one (seat colour, name,
// value), a beat, the true answer's pin falls, the closest dots light up with the "Closest!" stamp, then the points.
import "./tv.css";
import { useEffect } from "preact/hooks";
import { soundMuted } from "../../tv-mock/sound/player";
import type { TvRoomView } from "@jamaa/shared/protocol/v2";
import { fmtNum, isolate, isolateLtr } from "../../i18n/t";
import { Character } from "../../components/Character";
import { useDeadline } from "../../components/Timer";
import { groupDigits, layoutLine, playersOf, ranked, shortNum, taqOfTv, tk, withUnit } from "./phone";
import type { Player, Taq, TaqPub } from "./model";

const LINE_X0 = 72, LINE_W = 816;
/** Reveal timeline (ms): guesses start, one every STEP, then a beat, then the answer pin, then the stamp. */
export const REVEAL_T = { lineIn: 300, firstDot: 700, step: 260, beat: 900, stamp: 700 } as const;
export const answerAt = (n: number): number => REVEAL_T.firstDot + REVEAL_T.step * Math.max(0, n - 1) + REVEAL_T.beat;

/** Taqriban's own cues (tools/gen-sounds → public/sounds/taqriban/taqriban_*.ogg), under the per-device mute. */
function sfx(cue: "drop" | "pin" | "closest", rate = 1): void {
  if (soundMuted.value || typeof Audio === "undefined") return;
  try {
    const a = new Audio(`${import.meta.env.BASE_URL}sounds/taqriban/taqriban_${cue}.ogg`);
    a.playbackRate = rate;
    void a.play().catch(() => undefined);
  } catch {
    /* sound is never required: every cue has a visual counterpart */
  }
}

/** The reveal's sound track, on the same timeline as the CSS delays (calm motion: only the pin). */
function useRevealSounds(n: number, key: string): void {
  useEffect(() => {
    const calm = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ids: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, f: () => void): void => { ids.push(setTimeout(f, calm ? 0 : ms)); };
    if (!calm) for (let i = 0; i < n; i++) at(REVEAL_T.firstDot + REVEAL_T.step * i, () => sfx("drop", Math.pow(2, Math.min(i, 9) / 12)));
    at(answerAt(n), () => sfx("pin"));
    if (n > 0) at(answerAt(n) + REVEAL_T.stamp, () => sfx("closest"));
    return () => ids.forEach(clearTimeout);
  }, [key]);
}

const qSize = (s: string): string => (s.length > 110 ? "s" : s.length > 70 ? "m" : "l");

function Top({ pub }: { pub: TaqPub }) {
  return (
    <header class="tqbtop">
      <span class="tqbtop__title">{tk("title")}</span>
      <span class="tqbtop__end">
        {pub.isFinal && <b class="tqbx2">×2</b>}
        <span class="tnum">{pub.isFinal ? tk("show.final") : tk("show.question", { n: fmtNum(pub.index + 1), total: fmtNum(pub.total) })}</span>
      </span>
    </header>
  );
}

function Ring({ pub }: { pub: TaqPub }) {
  const d = useDeadline(pub.deadline !== null && pub.durationMs ? { kind: "VOTE", at: pub.deadline, durationMs: pub.durationMs } : null);
  if (!d) return null;
  const r = 26, c = 2 * Math.PI * r;
  return (
    <div class={`tqbring${d.secs <= 5 ? " is-low" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 64 64" width="64" height="64"><circle cx="32" cy="32" r={r} class="tqbring__bg" />
        <circle cx="32" cy="32" r={r} class="tqbring__fg" style={{ strokeDasharray: c, strokeDashoffset: c * (1 - d.frac) }} /></svg>
      <b class="num">{d.secs}</b>
    </div>
  );
}

/** The cast at the bottom; `lit` marks who has guessed (never what). */
function Cast({ ps, lit }: { ps: Player[]; lit?: ReadonlySet<string> }) {
  const live = ps.filter((p) => !p.row.left);
  const size = live.length > 8 ? 56 : 80;
  return (
    <div class="tqbcast">
      {live.map((p) => (
        <div key={p.id} class={`tqbcast__p${lit?.has(p.id) ? " is-lit" : ""}${p.connected ? "" : " is-away"}`}>
          <Character color={p.color} size={size} expression={lit?.has(p.id) ? "happy" : p.connected ? "think" : "away"} />
          <span class="tqbcast__name" dir="auto">{p.name}</span>
          {lit?.has(p.id) && <i class="tqbcast__ok" aria-hidden="true">✓</i>}
        </div>
      ))}
    </div>
  );
}

/** TQ-TV-01 Question: the card, the unit, the ring, who has guessed. */
function Question({ tq, ps }: { tq: Taq; ps: Player[] }) {
  const pub = tq.pub;
  const q = pub.question;
  const lit = new Set(pub.answeredIds);
  const playing = ps.filter((p) => !p.row.left && !pub.waitingIds.includes(p.id)).length;
  return (
    <>
      <Top pub={pub} />
      <section class={`tqbcard tqbcard--${qSize(q?.text ?? "")}`} key={q?.id}>
        <h1 dir="auto">{q?.text}</h1>
        {q?.unit && <p class="tqbcard__unit" dir="auto">{q.unit}</p>}
      </section>
      <div class="tqbstatus"><Ring pub={pub} /><span class="tnum">{tk("show.guessed")} <b class="num" dir="ltr">{fmtNum(lit.size)}/{fmtNum(playing)}</b></span></div>
      <Cast ps={ps} lit={lit} />
    </>
  );
}

/** TQ-TV-02 Reveal: the number line. */
function Reveal({ tq, ps }: { tq: Taq; ps: Player[] }) {
  const pub = tq.pub;
  const r = pub.reveal!;
  const unit = pub.question?.unit ?? "";
  const byId = new Map(ps.map((p) => [p.id, p]));
  const line = layoutLine(r.answer, r.guesses, r.logLine);
  const order = [...line.dots].sort((a, b) => (byId.get(a.id)?.seat ?? 0) - (byId.get(b.id)?.seat ?? 0));
  const dropAt = new Map(order.map((d, i) => [d.id, REVEAL_T.firstDot + REVEAL_T.step * i]));
  const tAns = answerAt(order.length);
  const tStamp = tAns + REVEAL_T.stamp;
  const wild = r.wildId ? r.guesses.find((g) => g.id === r.wildId) : undefined;
  useRevealSounds(order.length, `${tq.n}:${pub.index}`);
  const px = (x: number): number => LINE_X0 + x * LINE_W;
  const ms = (n: number) => ({ "--d": `${n}ms` });
  return (
    <>
      <Top pub={pub} />
      <section class="tqbrq"><p dir="auto">{pub.question?.text}</p></section>
      <div class="tqbline" style={ms(REVEAL_T.lineIn)}>
        <i class="tqbline__axis" />
        {line.ticks.map((t) => <span key={t.x} class="tqbline__tick" style={{ left: `${px(t.x)}px` }}><b class="num" dir="ltr">{t.label}</b></span>)}
        {r.logLine && <em class="tqbline__log">{tk("show.logScale")}</em>}
        {line.dots.map((d) => {
          const p = byId.get(d.id);
          const g = r.guesses.find((x) => x.id === d.id)!;
          const win = r.closestIds.includes(d.id);
          return (
            <div key={d.id} class={`tqbdot${win ? " is-win" : ""}${g.bullseye ? " is-bull" : ""}`}
              style={{ left: `${px(d.x)}px`, "--lane": d.lane, "--c": p ? `var(--player-${p.color})` : "#888", ...ms(dropAt.get(d.id) ?? 0), "--w": `${tStamp}ms` }}>
              <span class="tqbdot__tag"><span class="tqbdot__name" dir="auto">{p?.name ?? ""}</span><b class="num" dir="ltr">{shortNum(g.value)}</b></span>
              <span class="tqbdot__stem" />
              <span class="tqbdot__head">{p && <Character color={p.color} size={30} expression={win ? "cheer" : "think"} />}</span>
              {win && <b class="tqbdot__pts num" dir="ltr">+{fmtNum(g.points)}</b>}
            </div>
          );
        })}
        <div class="tqbpin" style={{ left: `${px(line.answerX)}px`, ...ms(tAns) }}>
          <span class="tqbpin__flag"><small>{tk("show.answer")}</small><b class="num" dir="ltr">{groupDigits(r.answer)}</b><em dir="auto">{withUnit(shortNum(r.answer) !== groupDigits(r.answer) ? isolate(shortNum(r.answer)) : "", unit).trim()}</em></span>
          <span class="tqbpin__needle" />
        </div>
      </div>
      <div class="tqbverdict" style={ms(tStamp)}>
        {r.guesses.length === 0 ? <b class="tqbstamp">{tk("show.nobody")}</b> : (
          <>
            <b class="tqbstamp">{r.closestIds.length > 1 ? tk("show.tie") : tk("show.closest")}</b>
            <span class="tqbverdict__who" dir="auto">{r.closestIds.map((id) => byId.get(id)?.name ?? "").join(" · ")}</span>
            {r.bullseyeIds.length > 0 && <b class="tqbstamp tqbstamp--bull">{tk("show.bullseye")}</b>}
          </>
        )}
      </div>
      {wild && <p class="tqbwild" style={ms(tStamp + 700)} dir="auto">{tk("show.wayOff", { name: isolate(byId.get(wild.id)?.name ?? ""), value: isolateLtr(withUnit(shortNum(wild.value), unit)) })}</p>}
      <p class="tqbsource" dir="auto">{tk("show.source", { source: r.source })}</p>
    </>
  );
}

/** TQ-TV-03/05 Standings and results: rows grow from the previous board to now. */
function Board({ tq, ps, results }: { tq: Taq; ps: Player[]; results: boolean }) {
  const rows = ranked(ps);
  const max = Math.max(1, ...rows.map((p) => p.row.score));
  const top = rows.filter((p) => p.row.rank === 1 && p.row.score > 0);
  const compact = rows.length > 8;
  return (
    <>
      {!results && <Top pub={tq.pub} />}
      <h1 class={`tqbboard__title${results ? " is-results" : ""}`}>
        {results ? (top.length === 1 ? tk("show.results.winner", { name: isolate(top[0]!.name) }) : top.length > 1 ? tk("show.results.tie") : tk("show.results.title")) : tk("show.standings")}
      </h1>
      <ol class={`tqbboard${compact ? " is-compact" : ""}`}>
        {rows.map((p, i) => (
          <li key={p.id} class={p.row.rank === 1 && p.row.score > 0 ? "is-top" : ""} style={{ "--i": i, "--from": p.row.scoreBefore / max, "--to": p.row.score / max, "--c": `var(--player-${p.color})` }}>
            <span class="tqbboard__rank num" dir="ltr">{fmtNum(p.row.rank ?? 0)}</span>
            <Character color={p.color} size={compact ? 30 : 40} expression={p.row.rank === 1 && p.row.score > 0 ? "cheer" : "idle"} crown={results && p.row.rank === 1 && p.row.score > 0} />
            <span class="tqbboard__name" dir="auto">{p.name}</span>
            <span class="tqbboard__bar"><i /></span>
            <span class="tqbboard__won tnum">{tk("show.won", { n: fmtNum(p.row.closest) })}</span>
            <b class="tqbboard__score num" dir="ltr">{fmtNum(p.row.score)}</b>
          </li>
        ))}
      </ol>
      {results && tq.pub.endedEarly && <p class="tqbsource">{tk("show.endedEarly")}</p>}
    </>
  );
}

function Center({ title, body, cls }: { title: string; body?: string; cls?: string }) {
  return (
    <section class={`tqbcenter ${cls ?? ""}`}>
      <h1>{title}</h1>
      {body && <p>{body}</p>}
    </section>
  );
}

export function Tv({ view }: { view: TvRoomView }) {
  const tq = taqOfTv(view);
  if (!tq) return null;
  const ps = playersOf(view.room, tq.pub);
  const ph = tq.pub.phase;
  return (
    <div class={`tqbtv tqbtv--${ph.toLowerCase()}${tq.pub.isFinal ? " is-final" : ""}`} data-world="observatory" data-phase={ph}>
      <div class="tqbsky" aria-hidden="true"><i /><i /><i /></div>
      {ph === "QUESTION" && <Question tq={tq} ps={ps} />}
      {ph === "REVEAL" && tq.pub.reveal && <Reveal tq={tq} ps={ps} />}
      {(ph === "LEADERBOARD" || ph === "RESULTS") && <Board tq={tq} ps={ps} results={ph === "RESULTS"} />}
      {ph === "FINAL_INTRO" && <Center title={tk("show.finalIntro.title")} body={tk("show.finalIntro.body")} cls="tqbcenter--final" />}
      {ph === "HOLD" && <><Center title={tk("show.hold")} /><Cast ps={ps} /></>}
    </div>
  );
}

export function screenKey(view: TvRoomView): string {
  const tq = taqOfTv(view);
  return tq ? `${tq.n}:${tq.pub.phase}:${tq.pub.index}:${tq.pub.question?.id ?? ""}` : "none";
}

/** Round 1 = the first question: the "◁ Back: menu & rules" hint stays on. */
export function firstRound(view: TvRoomView): boolean {
  const tq = taqOfTv(view);
  return !!tq && tq.pub.index === 0 && (tq.pub.phase === "QUESTION" || tq.pub.phase === "REVEAL");
}
