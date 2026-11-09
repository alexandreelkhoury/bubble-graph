// TR-TV-04 Leaderboard race (GAME-TRIVIA §12.4) and TR-TV-06 Results podium (§12.5), on the shared sampler: OK
// completes either (platform §3.10 E). The race: bars grow from the previous board to the new totals with rolling
// odometers, re-sort with a spring, the leader gets a crown, the biggest climber "+3 places!". The podium: steps rise,
// characters hop on 3-2-1, the winner holds the trophy, confetti, then the stat cards; then the platform's cup bar.
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { fmtNum, isolate } from "../../../i18n/t";
import { reduced } from "../../../lib/motion";
import { run } from "@jamaa/shared/motion";
import type { Run } from "@jamaa/shared/motion";
import { clearChoreo, resultsSettled, setChoreo } from "../../../tv-mock/tvPlatform";
import { play, stopAll } from "../../../tv-mock/sound/player";
import { timelineCues } from "../../../tv-mock/sound/cues";
import type { TimelineMark } from "../../../tv-mock/sound/cues";
import { Character } from "../../../components/Character";
import { Confetti } from "../../../components/UI";
import { ellipsizeName } from "../../../lib/names";
import type { Player, Trivia } from "../model";
import { biggestClimb, podiumOf, resultsStats, standings } from "../model";
import { BOARD_MARKS, PODIUM_MARKS } from "../cues";
import { BOARD_STEPS, PODIUM_STEPS } from "../layout";
import type { Step } from "@jamaa/shared/motion";
import { Bolt, Flame, TokenChip } from "../tokens";
import { Odo, tk } from "./parts";

type P = (id: string, i?: number) => number;

/** Runs `steps` once on mount (registered as the TV's running choreography so OK completes it), with sound marks. */
function useChoreo(steps: readonly Step[], marks: readonly TimelineMark[], frame: (p: P) => void, onDone: () => void, count = 1): void {
  useLayoutEffect(() => {
    if (reduced()) { frame(() => 1); onDone(); return; }
    let last = -1;
    const r: Run = run(steps, (p, t) => {
      frame(p);
      for (const m of timelineCues(marks, last, t)) play({ cue: m.cue, rate: m.rate });
      last = t;
    }, () => { clearChoreo(wrapped); onDone(); }, count);
    const wrapped: Run = { complete: () => { stopAll(); r.complete(); }, cancel: r.cancel, get running() { return r.running; } };
    setChoreo(wrapped);
    return () => { r.cancel(); clearChoreo(wrapped); };
  }, []);
}

export function Board({ tr, ps }: { tr: Trivia; ps: Player[] }) {
  const root = useRef<HTMLDivElement>(null);
  const before = useRef(standings(ps, true)).current;
  const after = standings(ps);
  const [grown, setGrown] = useState(reduced());
  const [done, setDone] = useState(reduced());
  const n = before.length;
  const rowH = n <= 8 ? 44 : 30, gap = n <= 8 ? 8 : 4;
  const max = Math.max(1, ...ps.map((p) => p.row.score));
  const climb = biggestClimb(ps);
  const leader = after[0];
  useChoreo(BOARD_STEPS, BOARD_MARKS, (p) => {
    const el = root.current;
    if (!el) return;
    if (p("grow") > 0) setGrown(true);
    el.style.setProperty("--p-crown", String(p("crown")));
    el.style.setProperty("--p-climb", String(p("climb")));
    const s = p("sort");
    el.querySelectorAll<HTMLElement>(".tqlb__row").forEach((row, i) => {
      const j = after.findIndex((x) => x.id === before[i]?.id);
      row.style.transform = `translateY(${(j - i) * (rowH + gap) * s}px)`;
    });
  }, () => setDone(true));
  return (
    <div ref={root} class={`tqlb${done ? " is-done" : ""}${n > 8 ? " is-compact" : ""}`}>
      <h1 class="tqlb__title">{tk("leaderboard.title")}</h1>
      <ol class="tqlb__rows" style={{ height: `${n * (rowH + gap)}px` }}>
        {before.map((p, i) => {
          const w = (grown ? p.row.score : p.row.scoreBefore) / max;
          const isLeader = leader?.id === p.id && p.row.score > 0;
          return (
            <li key={p.id} class={`tqlb__row${p.row.left ? " is-left" : ""}${isLeader ? " is-leader" : ""}`} style={{ top: `${i * (rowH + gap)}px`, height: `${rowH}px`, "--c": `var(--player-${p.color})` }}>
              <span class="tqlb__rank tnum">{p.row.left ? "–" : fmtNum((done ? p.row.rank : p.row.rankBefore ?? p.row.rank) ?? 0)}</span>
              <span class="tqlb__who">
                <Character color={p.color} size={n <= 8 ? 40 : 26} expression={isLeader && done ? "cheer" : p.connected ? "idle" : "away"} crown={isLeader && done} />
                <span class="tqlb__name"><bdi>{ellipsizeName(p.name, 14)}</bdi>{p.isNew && <em>{tk("pad.newRibbon")}</em>}</span>
              </span>
              <span class="tqlb__track"><span class="tqlb__bar" style={{ transform: `scaleX(${Math.max(0.015, w)})` }} />
                {p.row.streak >= 3 && <span class="tqlb__fire"><Flame size={n <= 8 ? 18 : 12} />{fmtNum(p.row.streak)}</span>}
              </span>
              <span class="tqlb__score"><Odo value={grown ? p.row.score : p.row.scoreBefore} /></span>
              {climb?.id === p.id && <span class="tqlb__climb">{tk("leaderboard.climb", { count: climb.places })}</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Steps 2-1-3 left to right (mirrored in RTL by the flex direction), heights 96 / 130 / 70 dp. */
const STEP_H: Record<1 | 2 | 3, number> = { 1: 130, 2: 96, 3: 70 };

export function Results({ tr, ps }: { tr: Trivia; ps: Player[] }) {
  const root = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<{ confetti: boolean; done: boolean }>({ confetti: false, done: reduced() });
  const steps = podiumOf(ps);
  const stats = resultsStats(ps);
  const order: (1 | 2 | 3)[] = [2, 1, 3];
  useEffect(() => () => { resultsSettled.value = false; }, []);
  useChoreo(PODIUM_STEPS, PODIUM_MARKS, (p) => {
    const el = root.current;
    if (!el) return;
    el.style.setProperty("--p-steps", String(p("steps")));
    el.style.setProperty("--p-hop3", String(p("hop3")));
    el.style.setProperty("--p-hop2", String(p("hop2")));
    el.style.setProperty("--p-hop1", String(p("hop1")));
    el.style.setProperty("--p-trophy", String(p("trophy")));
    el.querySelectorAll<HTMLElement>(".tqres__stat").forEach((c, i) => c.style.setProperty("--p", String(p("stats", i))));
    if (p("hop1") >= 1) setPhase((s) => (s.confetti ? s : { ...s, confetti: true }));
  }, () => { setPhase({ confetti: true, done: true }); resultsSettled.value = true; }, 3);
  return (
    <div ref={root} class={`tqres${phase.done ? " is-done" : ""}`}>
      <h1 class="tqres__title">{tk("results.title")}</h1>
      <ul class="tqres__stats">
        {stats.map((s) => (
          <li key={s.key} class={`tqres__stat tqres__stat--${s.key}`}>
            <span class="tqres__icon">{s.key === "fastest" ? <Bolt size={26} /> : s.key === "streak" ? <Flame size={20} /> : <TokenChip id="true" size={26} />}</span>
            <span>{s.key === "fastest" ? tk("results.fastestCount", { name: isolate(s.name), count: s.count })
              : s.key === "streak" ? tk("results.longestStreak", { name: isolate(s.name), count: s.count })
                : tk("results.mostCorrect", { name: isolate(s.name), count: s.count })}</span>
          </li>
        ))}
      </ul>
      <div class="tqres__podium">
        {order.map((step) => {
          const st = steps.find((x) => x.step === step);
          const list = st?.players ?? [];
          const size = Math.min(step === 1 ? 96 : 76, Math.floor(170 / Math.max(1, list.length)));
          return (
            <div key={step} class={`tqres__col tqres__col--${step}`} style={{ "--h": `${STEP_H[step]}px`, "--hop": `var(--p-hop${step}, 1)` }}>
              <div class="tqres__cast">
                {list.map((p) => (
                  <span key={p.id} class="tqres__actor">
                    <Character color={p.color} size={size} expression={step === 1 ? "cheer" : "happy"} crown={step === 1} />
                    {step === 1 && <span class="tqres__trophy" aria-hidden="true"><Trophy /></span>}
                  </span>
                ))}
              </div>
              <div class="tqres__step">
                <b class="tqres__place num">{fmtNum(step)}</b>
                {list.map((p) => <span key={p.id} class="tqres__name"><bdi>{ellipsizeName(p.name, 12)}</bdi> <span class="num">{fmtNum(p.row.score)}</span></span>)}
              </div>
            </div>
          );
        })}
      </div>
      {phase.confetti && <Confetti colors={["#FFC94D", "#FFD84D", "#478CFF", "#1FA88A", "#FF4F9A", "#FFF7EC"]} count={48} />}
    </div>
  );
}

function Trophy() {
  return (
    <svg viewBox="0 0 32 32" width="40" height="40">
      <path d="M9 4h14v7a7 7 0 01-14 0z" fill="#FFC94D" stroke="#120A1F" stroke-width="1.2" />
      <path d="M9 7H5c0 4 2 6 5 6M23 7h4c0 4-2 6-5 6" fill="none" stroke="#FFC94D" stroke-width="2" />
      <path d="M14 18h4v5h-4z" fill="#E9A23B" /><rect x="10" y="23" width="12" height="4" rx="1.5" fill="#FFC94D" stroke="#120A1F" stroke-width="1.2" />
      <path d="M13 7.5v4" stroke="#FFF7EC" stroke-width="1.6" stroke-linecap="round" opacity=".7" />
    </svg>
  );
}
