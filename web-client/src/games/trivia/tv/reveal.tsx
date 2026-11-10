// TR-TV-03 Reveal (GAME-TRIVIA §12.3, DESIGN-JAMAA §5.4): Time! → wrong tiles out, the right one glows and its shape
// spins → characters jump from their podiums onto the tile they chose → a bolt strikes the fastest finger → one coin
// per correct player flies into the tower with "+870 +200" → the tower re-sorts (FLIP) and the odometers roll →
// optional "Did you know?". One run of the shared sampler (`@jamaa/shared/motion`): OK completes it (platform §3.10 E),
// the server's REVEAL timer runs regardless. Calm/reduced motion: the end state at once, with a crossfade.
import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { fmtNum, isolate, listOf } from "../../../i18n/t";
import { reduced } from "../../../lib/motion";
import { run } from "@jamaa/shared/motion";
import type { Run } from "@jamaa/shared/motion";
import { useInGameOk } from "../../../tv-mock/tvParts";
import { play, stopAll } from "../../../tv-mock/sound/player";
import { timelineCues } from "../../../tv-mock/sound/cues";
import { Confetti } from "../../../components/UI";
import { COLOR_BY_ID } from "../../../components/PlayerChip";
import type { Player, Trivia } from "../model";
import { activePlayers, standings } from "../model";
import { Bolt } from "../tokens";
import { revealMarks } from "../cues";
import {
  CARD_Y, CROWD_CHAR, EXPLAIN_AT_MS, PODIUM_CHAR, REVEAL_STEPS, TILE_Y, cardRect, coinPoint, crowdSlot, hopPoint, podiumSlots, tileRect, towerRowH, towerScorePoint, verdictBand,
} from "../layout";
import type { Pt } from "../layout";
import { Actor, PodiumRow, QuestionCard, Tiles, Tower, box, isRtl, tk } from "./parts";

interface Jumper { p: Player; home: Pt; to: Pt; choice: number }
interface Coin { p: Player; from: Pt; to: Pt; label: string; final: boolean; fire: boolean }

/** The reveal's static plan: who jumps where, which coins fly where, the tower before/after (pure of the view). */
export function revealPlan(tr: Trivia, ps: Player[], rtl: boolean): { jumpers: Jumper[]; coins: Coin[]; before: Player[]; after: Player[] } {
  const pub = tr.pub, r = pub.reveal!;
  const type = pub.question?.type ?? "mc4";
  const active = activePlayers(ps);
  const slots = podiumSlots(active.length, rtl);
  const before = standings(ps, true), after = standings(ps);
  const byTile = new Map<number, Player[]>();
  for (const p of active) {
    const c = r.choices.find((x) => x.id === p.id);
    if (c && c.choice !== null) byTile.set(c.choice, [...(byTile.get(c.choice) ?? []), p]);
  }
  const jumpers: Jumper[] = [];
  for (const [choice, list] of byTile) {
    list.forEach((p, k) => {
      const i = active.indexOf(p);
      jumpers.push({ p, home: slots[i]!, to: crowdSlot(tileRect(choice, type, rtl), k, list.length), choice });
    });
  }
  jumpers.sort((a, b) => a.p.seat - b.p.seat);
  const coins: Coin[] = [];
  if (!r.voided) {
    for (const j of jumpers) {
      const c = r.choices.find((x) => x.id === j.p.id)!;
      if (!c.correct || c.points + c.streakBonus <= 0) continue;
      const idx = before.findIndex((x) => x.id === j.p.id);
      coins.push({
        p: j.p, from: j.to, to: towerScorePoint(idx, rtl, before.length),
        label: `+${fmtNum(c.points)}${c.streakBonus > 0 ? ` +${fmtNum(c.streakBonus)}` : ""}`, final: pub.isFinal, fire: j.p.row.streak >= 3,
      });
    }
  }
  return { jumpers, coins, before, after };
}

export function Reveal({ tr, ps }: { tr: Trivia; ps: Player[] }) {
  const pub = tr.pub, r = pub.reveal!;
  const rtl = isRtl();
  const root = useRef<HTMLDivElement>(null);
  const runRef = useRef<Run | null>(null);
  const plan = useRef(revealPlan(tr, ps, rtl)).current;
  const [stage, setStage] = useState<{ counted: boolean; done: boolean; explain: boolean }>(() => ({ counted: reduced(), done: reduced(), explain: reduced() }));
  const active = activePlayers(ps);
  const jumping = new Set(plan.jumpers.map((j) => j.p.id));
  const fastest = new Set(r.fastestIds);
  const leaderChanged = (plan.before[0]?.id ?? null) !== (plan.after[0]?.id ?? null) && (plan.after[0]?.row.score ?? 0) > 0;

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const actors = [...el.querySelectorAll<HTMLElement>(".tqrv__actor")];
    const coins = [...el.querySelectorAll<HTMLElement>(".tqcoin")];
    const rows = new Map([...el.querySelectorAll<HTMLElement>(".tqrow")].map((x, i) => [plan.before[i]?.id ?? "", x]));
    const { h, gap } = towerRowH(plan.before.length);
    const marks = revealMarks(r, plan.coins.length, leaderChanged);
    let lastT = -1;
    let counted = false;
    const frame = (p: (id: string, i?: number) => number, tMs: number): void => {
      el.style.setProperty("--p-time", String(p("time")));
      el.style.setProperty("--p-out", String(p("out")));
      el.style.setProperty("--p-spin", String(p("spin")));
      el.style.setProperty("--p-bolt", String(p("bolt")));
      el.style.setProperty("--p-sort", String(p("sort")));
      plan.jumpers.forEach((j, i) => {
        const a = actors[i];
        if (!a) return;
        const q = p("jump", i);
        const pt = hopPoint(j.home, j.to, q);
        const s = 1 + (CROWD_CHAR / PODIUM_CHAR - 1) * Math.min(1, Math.max(0, q));
        a.style.transform = `translate(${pt.x - j.home.x}px, ${pt.y - j.home.y}px) scale(${s})`;
        a.classList.toggle("is-landed", q >= 1);
      });
      plan.coins.forEach((c, i) => {
        const e = coins[i];
        if (!e) return;
        const q = p("coin", i);
        const pt = coinPoint(c.from, c.to, q);
        e.style.transform = `translate(${pt.x}px, ${pt.y}px)`;
        e.style.opacity = q > 0 && q < 1 ? "1" : "0";
      });
      const pc = p("counter");
      if (pc > 0 && !counted) { counted = true; setStage((s) => ({ ...s, counted: true })); }
      const pop = 1 + 0.15 * Math.sin(Math.PI * Math.min(1, pc * 2.5));
      const ps2 = p("sort");
      plan.before.forEach((b, i) => {
        const row = rows.get(b.id);
        if (!row) return;
        const j = plan.after.findIndex((x) => x.id === b.id);
        const dy = (j - i) * (h + gap) * ps2;
        // An overtaker hops over the row it passes (−0.3 body arc, DESIGN-JAMAA §5.1).
        const hop = j < i ? -8 * Math.sin(Math.PI * ps2) : 0;
        row.style.transform = `translateY(${dy + hop}px)`;
        const sc = row.querySelector<HTMLElement>(".tqrow__score");
        if (sc) sc.style.transform = `scale(${coinsTo(b.id) ? pop : 1})`;
      });
      for (const m of timelineCues(marks, lastT, tMs)) play({ cue: m.cue, rate: m.rate });
      lastT = tMs;
    };
    const coinsTo = (id: string): boolean => plan.coins.some((c) => c.p.id === id);
    const count = Math.max(1, plan.jumpers.length, plan.coins.length);
    const explainAt = r.explain ? setTimeout(() => setStage((s) => ({ ...s, explain: true })), EXPLAIN_AT_MS) : null;
    if (reduced()) {
      // Calm: every step at its end at once (no travel); the stage crossfades in through CSS. The verdict cue stays.
      frame(() => 1, Number.MAX_SAFE_INTEGER);
      play({ cue: r.stumped || r.tooSlow ? "quiz_wrong" : "quiz_correct" });
      return () => { if (explainAt) clearTimeout(explainAt); };
    }
    const r_ = run(REVEAL_STEPS, frame, () => setStage((s) => ({ ...s, counted: true, done: true })), count);
    runRef.current = r_;
    return () => { if (explainAt) clearTimeout(explainAt); r_.cancel(); runRef.current = null; };
  }, []);

  // §3.10 E rule 5: OK in game completes the reveal locally (cutting the cues still ringing); the explain card then
  // shows at once. D-pad and Back stay free (Back opens the pause menu at any time).
  useInGameOk(!stage.done, () => { stopAll(); runRef.current?.complete(); setStage((s) => ({ ...s, explain: !!r.explain })); });
  const fastNames = plan.jumpers.filter((j) => fastest.has(j.p.id)).map((j) => j.p.name);
  const banner = r.voided ? tk("pause.voided") : r.tooSlow ? tk("reveal.tooSlow") : r.stumped ? tk("reveal.stumped") : r.genius ? tk("reveal.genius") : null;
  return (
    <div ref={root} class={`tqrv${stage.done ? " is-done" : ""}${r.stumped || r.tooSlow ? " is-stumped" : ""}${r.voided ? " is-voided" : ""}${reduced() ? " is-calm" : ""}`}>
      <QuestionCard pub={pub} mode="reveal" />
      <Tiles pub={pub} mode="reveal" />
      <Tower players={ps} order={plan.before} scoreOf={(p) => (stage.counted ? p.row.score : p.row.scoreBefore)}
        rankOf={(p) => (stage.done ? p.row.rank : p.row.rankBefore ?? p.row.rank)} />
      {/* Podiums stay; characters that answered leave them for their tile, the rest stay with a "z" (§12.3). */}
      <PodiumRow tr={tr} players={active} actors={false} />
      {active.map((p, i) => {
        if (jumping.has(p.id)) return null;
        const s = podiumSlots(active.length, rtl)[i]!;
        return <Actor key={p.id} tr={tr} p={p} size={PODIUM_CHAR} cls="tqrv__stay" style={{ left: `${s.x - PODIUM_CHAR / 2}px`, top: `${s.y - PODIUM_CHAR / 2}px` }} flame={false} />;
      })}
      {plan.jumpers.map((j) => (
        <Actor key={j.p.id} tr={tr} p={j.p} size={PODIUM_CHAR} cls={`tqrv__actor${fastest.has(j.p.id) ? " is-fastest" : ""}`}
          style={{ left: `${j.home.x - PODIUM_CHAR / 2}px`, top: `${j.home.y - PODIUM_CHAR / 2}px` }} />
      ))}
      {plan.jumpers.filter((j) => fastest.has(j.p.id)).map((j) => (
        <span key={`b${j.p.id}`} class="tqbolt" style={{ left: `${j.to.x}px`, top: `${j.to.y - CROWD_CHAR}px` }}><Bolt size={40} /></span>
      ))}
      {plan.coins.map((c) => (
        <span key={`c${c.p.id}`} class={`tqcoin${c.fire ? " is-fire" : ""}`} style={{ "--coin": COLOR_BY_ID[c.p.color].hex, opacity: "0" }}>
          <i />
          <b class="tqcoin__label num">{c.label}{c.final && <em>×2</em>}</b>
        </span>
      ))}
      <p class="tqstamp" aria-hidden="true">{tk("reveal.time")}</p>
      {/* The verdict band between the squeezed card and the grid: it covers no tile, no character, no podium. */}
      <div class="tqband" style={box(verdictBand(rtl))}>
        {banner && <p class={`tqbanner${r.genius ? " is-good" : ""}`}>{banner}</p>}
        {fastNames.length > 0 && !r.voided && <p class="tqfast"><Bolt size={22} />{tk("reveal.fastest", { name: listOf(fastNames) })}</p>}
      </div>
      {r.genius && stage.done && <Confetti colors={["#FFC94D", "#FFD84D", "#FFF7EC", "#5B7CFF"]} count={42} />}
      {r.onFireIds.length > 0 && !r.voided && (
        <p class="tqfire">{plan.jumpers.filter((j) => r.onFireIds.includes(j.p.id)).map((j) => `${isolate(j.p.name)} · ${tk("streak", { count: j.p.row.streak })}`).join("   ")}</p>
      )}
      {stage.explain && r.explain && <aside class="tqexplain" style={box({ ...cardRect(rtl), y: CARD_Y, h: TILE_Y - CARD_Y - 8 })}><b>{tk("reveal.didYouKnow")}</b><span dir="auto">{r.explain}</span></aside>}
    </div>
  );
}
