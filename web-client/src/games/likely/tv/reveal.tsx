// LK-TV-03 the reveal (GAME-LIKELY §12.2, DESIGN-JAMAA §5.3). Public mode: everyone runs to their pick and forms a conga
// line, counters roll, the spotlight drops, the rosette lands, agreement coins fly from each line's head to the voter.
// Secret votes: a ballot box bursts identical cream envelopes onto the targets, then the percentage board; no points.
// Chaos: a scramble. The whole moment is one step list on the shared sampler; OK completes it (§3.10 E rule 5); the
// server's REVEAL timer runs regardless. Positions come from the shared layout (likely/layout.ts) like on the Kotlin TV.
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { Expression } from "@jamaa/shared/characters";
import { run, variant } from "@jamaa/shared/motion";
import type { Run } from "@jamaa/shared/motion";
import { fmtNum, isolate, listOf, locale, t } from "../../../i18n/t";
import { reduced } from "../../../lib/motion";
import { Icon } from "../../../components/Icon";
import { COLOR_BY_ID } from "../../../components/PlayerChip";
import { Character } from "../../../components/Character";
import { useInGameOk } from "../../../tv-mock/tvParts";
import { stopAll } from "../../../tv-mock/sound/player";
import { likelyRevealMs } from "@jamaa/shared/games/likely/meta";
import { Envelope, Rosette } from "../art";
import { CHAR, againName, coinPoint, fmtPercent, percentLines, revealExpression, revealPlan } from "../model";
import type { LikelyModel, Seat } from "../model";
import { k } from "../parts";
import { fitReveal, revealSteps } from "./choreo";
import { JuryChar, LkTop, TvCard, World, rtl } from "./stage";
import { platformCue, riseRate, sfx } from "./sfx";
import { ScoreRail } from "./rail";

/** The ballot box (secret votes) sits between the card and the jury. */
const BOX = { x: 480, y: 250 } as const;
/** At most this many percentage lines are listed (the rest share one "+n" line). */
const BOARD_MAX = 3;

type Stage = "run" | "stamp" | "end";

export function TvReveal({ m }: { m: LikelyModel }) {
  const r = m.pub.reveal!;
  const isRtl = rtl();
  const pub = m.pub.showVoters;
  const plan = useMemo(() => revealPlan(m, isRtl), [m.pub.card?.id, m.pub.cardIndex, isRtl, m.seats.length]);
  const envelopes = useMemo(() => (pub ? [] : r.counts.flatMap((c) => Array.from({ length: c.count }, () => c.playerId))), [r]);
  const count = Math.max(plan.runners.length, envelopes.length, plan.coins.length, 1);
  const steps = useMemo(() => fitReveal(revealSteps({
    runners: plan.runners.length, envelopes: envelopes.length, publicMode: pub, chaos: r.chaos, none: r.none, unanimous: r.unanimous, coins: plan.coins.length,
  }), likelyRevealMs(r.votesCast, r.unanimous, r.topIds.length), count), [plan, envelopes.length, pub, r.chaos, r.none, r.unanimous]);
  const root = useRef<HTMLDivElement>(null);
  const runRef = useRef<Run | null>(null);
  const [stage, setStage] = useState<Stage>(() => (reduced() ? "end" : "run"));
  const [running, setRunning] = useState(true);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const fired = new Set<string>();
    const once = (id: string, f: () => void): void => { if (!fired.has(id)) { fired.add(id); f(); } };
    const runnerIdx = new Map(plan.runners.map((id, i) => [id, i]));
    const lineLen = new Map<string, number>();
    const ballotOf = new Map((r.ballots ?? []).map((b) => [b.voterId, b.targetId]));
    let stageNow: Stage = "run";
    const toStage = (s: Stage): void => { if (s !== stageNow) { stageNow = s; setStage(s); } };
    const cast = [...el.querySelectorAll<HTMLElement>("[data-cast]")];
    const envs = [...el.querySelectorAll<HTMLElement>("[data-env]")];
    const coins = [...el.querySelectorAll<HTMLElement>("[data-coin]")];
    const counts = [...el.querySelectorAll<HTMLElement>("[data-count]")];
    const scores = [...el.querySelectorAll<HTMLElement>("[data-score]")];
    const eff = variant(steps, { reduced: reduced() });
    const has = new Set(steps.map((x) => x.id));
    platformCue("sfx.drumroll");
    const handle = run(eff, (p) => {
      const dim = p("dim");
      el.style.setProperty("--dim", String(dim));
      // Steps this card's list does not have stay at 0 (the reduced list has none, so p() reads 1 = the end state).
      for (const id of ["count", "spot", "stamp", "board", "hold", "box", "confetti", "tick"]) el.style.setProperty(`--${id}`, has.has(id) ? String(p(id)) : "0");
      const scr = p("scramble");
      // Characters: run to their pick (two little hops), or scramble (chaos).
      cast.forEach((c, i) => {
        const id = c.dataset.cast!;
        const from = plan.arc[id]!, to = plan.ends[id]!;
        let dx = 0, dy = 0;
        if (scr > 0 && scr < 1) {
          dx = 70 * Math.sin(2 * Math.PI * (scr * 1.7 + i * 0.37)) * Math.sin(Math.PI * scr);
          dy = -26 * Math.abs(Math.sin(2 * Math.PI * (scr * 2.3 + i * 0.21)));
        }
        const ri = runnerIdx.get(id);
        if (ri !== undefined) {
          const q = p("run", ri);
          dx += (to.x - from.x) * q;
          dy += (to.y - from.y) * q - 40 * Math.abs(Math.sin(2 * Math.PI * Math.min(1, q)));
          if (q >= 1) once(`land${id}`, () => {
            const target = ballotOf.get(id) ?? "";
            const n = (lineLen.get(target) ?? 0) + 1;
            lineLen.set(target, n);
            sfx("tok", riseRate(n - 1));
          });
        }
        c.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
        // Later runners stand in front of earlier ones (z by y).
        c.style.zIndex = String(Math.round(from.y + dy));
      });
      envs.forEach((e, i) => {
        const q = p("env", i);
        const target = plan.arc[e.dataset.env!]!;
        const pt = coinPoint(BOX, { x: target.x, y: target.y - CHAR - 8 }, Math.max(0, Math.min(1, q)));
        e.style.transform = `translate(${pt.x.toFixed(1)}px, ${pt.y.toFixed(1)}px) rotate(${(1 - q) * (i % 2 ? 40 : -40)}deg)`;
        e.style.opacity = q > 0 && q < 1 ? "1" : "0";
        if (q > 0) once(`env${i}`, () => { if (i === 0) sfx("ballot"); });
      });
      coins.forEach((c, i) => {
        const q = p("coin", i);
        const coin = plan.coins[i]!;
        const pt = coinPoint(coin.from, coin.to, Math.max(0, Math.min(1, q)));
        c.style.transform = `translate(${pt.x.toFixed(1)}px, ${pt.y.toFixed(1)}px)`;
        c.style.opacity = q > 0 && q < 1 ? "1" : "0";
        if (q >= 1) once(`coin${i}`, () => platformCue("coin_land"));
      });
      const cq = p("count");
      counts.forEach((c) => { c.textContent = fmtNum(Math.round(Number(c.dataset.count) * cq)); });
      const tq = p("tick");
      scores.forEach((s) => { const a = Number(s.dataset.from), b = Number(s.dataset.score); s.textContent = fmtNum(Math.round(a + (b - a) * tq)); });
      if (cq > 0) once("count", () => platformCue("counter_tick"));
      if (scr > 0) once("scr", () => sfx("scramble"));
      if (p("spot") > 0) once("spot", () => sfx("spot"));
      if (p("stamp") > 0) once("stamp", () => { sfx("rosette"); toStage("stamp"); });
      if (p("confetti") > 0) once("conf", () => sfx("confetti"));
      if (p("coin") > 0) once("coins", () => platformCue("coin_fly"));
    }, () => { toStage("end"); setRunning(false); }, count);
    runRef.current = handle;
    return () => handle.cancel();
  }, [plan, steps]);

  // OK completes the moment to its end state (and cuts the drumroll).
  useInGameOk(running, () => { stopAll(); runRef.current?.complete(); });

  const top = r.topIds.map((id) => m.byId.get(id)).filter((s): s is Seat => !!s);
  const again = againName(m);
  const expr = (s: Seat): Expression => (stage === "run" && !plan.runners.includes(s.id) && !plan.selfVoters.includes(s.id) ? (s.connected ? "idle" : "away") : revealExpression(m, s.id, stage));
  const look = (s: Seat): "start" | "end" | null => {
    if (stage !== "run" || !r.ballots) return null;
    const b = r.ballots.find((x) => x.voterId === s.id);
    if (!b || b.targetId === s.id) return null;
    return (plan.arc[b.targetId]?.x ?? 0) < (plan.arc[s.id]?.x ?? 0) ? "start" : "end";
  };
  const lines = percentLines(m);
  const caption = r.none ? t(k("reveal.none"))
    : r.chaos ? t(k("reveal.chaos"))
    : top.length > 1 ? t(k("reveal.tie"))
    : top[0] ? t(k("reveal.defend"), { name: isolate(top[0].name) }) : "";
  return (
    <div data-world="rooftop" class={`tvscreen lkrev lkrev--${pub ? "public" : "secret"}${r.chaos ? " is-chaos" : ""}${r.unanimous ? " is-unanimous" : ""}`} ref={root} data-reveal={pub ? "public" : "secret"} data-running={running ? "1" : "0"}>
      <World dim />
      <LkTop m={m} />
      <TvCard m={m} small />
      {/* Spotlight: the room dims around the top target(s), a cone drops from the rig (§12.2 step 4). */}
      {!r.chaos && !r.none && top.length > 0 && (
        <svg class="lkspot" viewBox="0 0 960 540" width="960" height="540" aria-hidden="true">
          <defs>
            <radialGradient id="lkspot-hole"><stop offset=".55" stop-color="#000" /><stop offset="1" stop-color="#fff" /></radialGradient>
            <linearGradient id="lkspot-cone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#B8FFF6" stop-opacity=".05" /><stop offset="1" stop-color="#B8FFF6" stop-opacity=".3" /></linearGradient>
            <mask id="lkspot-mask"><rect width="960" height="540" fill="#fff" />{top.map((s) => <ellipse key={s.id} cx={plan.arc[s.id]!.x} cy={plan.arc[s.id]!.y - CHAR / 2} rx="96" ry="120" fill="url(#lkspot-hole)" />)}</mask>
          </defs>
          <rect class="lkspot__dim" width="960" height="540" mask="url(#lkspot-mask)" />
          <g class="lkspot__cones">
            {top.map((s) => { const p = plan.arc[s.id]!; return <path key={s.id} d={`M${p.x - 26} 0 L${p.x + 26} 0 L${p.x + 92} ${p.y + 6} L${p.x - 92} ${p.y + 6} Z`} fill="url(#lkspot-cone)" />; })}
          </g>
        </svg>
      )}
      {!pub && !r.none && <div class="lkbox" style={{ left: `${BOX.x}px`, top: `${BOX.y}px` }} aria-hidden="true"><Icon name="lk-ballot" size={56} /></div>}
      <div class="lkcast">
        {m.seats.map((s) => {
          const p = plan.arc[s.id]!;
          return (
            <div key={s.id} class={`lkcast__ch${top.some((x) => x.id === s.id) ? " is-top" : ""}${s.left ? " is-left" : ""}`} data-cast={s.id} style={{ left: `${p.x - CHAR / 2}px`, top: `${p.y - CHAR}px` }}>
              <JuryChar s={s} expression={expr(s)} size={CHAR} look={look(s)} />
              <bdi class="lkjury__name">{s.name}</bdi>
              {pub && (plan.gains[s.id] ?? 0) > 0 && <span class="lkgain">+{fmtNum(plan.gains[s.id]!)}</span>}
            </div>
          );
        })}
      </div>
      {/* Count bubbles above each picked target (§12.2 step 3). */}
      {!r.none && r.counts.map((c) => {
        const p = plan.arc[c.playerId];
        if (!p) return null;
        return <span key={c.playerId} class="lkcount" style={{ left: `${p.x}px`, top: `${p.y - CHAR - 40}px` }}><span data-count={c.count}>{fmtNum(reduced() ? c.count : 0)}</span></span>;
      })}
      {/* Rosette(s) on the top target(s) + the award name plate (§12.2 step 5). */}
      {!r.chaos && top.map((s) => {
        const p = plan.arc[s.id]!;
        return (
          <div key={s.id} class={`lkstamp${top.length > 1 ? " is-tie" : ""}`} style={{ left: `${p.x + CHAR * 0.42}px`, top: `${p.y - CHAR * 0.42}px` }}>
            <Rosette size={top.length > 1 ? 36 : 44} />
          </div>
        );
      })}
      {!r.chaos && !r.none && m.pub.card && <p class="lkplate"><Rosette size={26} /><span>{m.pub.card.award}</span>{top.length > 0 && <bdi class="lkplate__who">{listOf(top.map((s) => s.name))}</bdi>}</p>}
      {again && !r.chaos && <p class="lkagain">{t(k("reveal.again"), { name: isolate(again) })}</p>}
      {r.unanimous && <p class="lkbanner">{t(k(pub ? "reveal.unanimousPts" : "reveal.unanimous"))}</p>}
      {r.unanimous && stage !== "run" && !reduced() && <Confetti />}
      {envelopes.map((id, i) => <span key={i} class="lkenv" data-env={id}><Envelope size={34} /></span>)}
      {plan.coins.map((c, i) => (
        <span key={i} class="lkcoin" data-coin={i} style={{ "--c": COLOR_BY_ID[m.byId.get(c.voterId)!.color].hex }}>
          {i === plan.coins.findIndex((x) => x.voterId === c.voterId) && <span class="lkcoin__label">+{fmtNum(c.points)}</span>}
        </span>
      ))}
      {/* Secret votes: the percentage board under the card (never who voted for whom). */}
      {!pub && lines.length > 0 && (
        <ol class="lkboard" aria-label={t(k("rules.secret.title"))}>
          {lines.slice(0, BOARD_MAX).map((l, i) => (
            <li key={l.seat.id} class="lkboard__row" style={{ "--i": i, "--pc": `${l.percent}%`, "--c": COLOR_BY_ID[l.seat.color].hex }}>
              <Character color={l.seat.color} size={40} expression={r.topIds.includes(l.seat.id) ? "shy" : "idle"} />
              <span class="lkboard__text">{t(k("reveal.percent"), { percent: fmtPercent(l.percent, locale.value), name: isolate(l.seat.name) })}</span>
              <span class="lkboard__bar" aria-hidden="true"><span /></span>
            </li>
          ))}
          {lines.length > BOARD_MAX && <li class="lkboard__more tnum">+{fmtNum(lines.length - BOARD_MAX)}</li>}
        </ol>
      )}
      {caption && <p class={`lkcaption${r.chaos ? " is-chaos" : ""}${r.none ? " is-none" : ""}`}>{!r.chaos && !r.none && top.length === 1 && <Icon name="lk-speech" size={30} class="lkcaption__icon" />}{caption}</p>}
      {pub && <ScoreRail m={m} tick />}
    </div>
  );
}

/** Unanimous: a confetti cannon from both bottom corners (paper + gold, 36 pieces, 1.2 s; §12.2 step 6). */
function Confetti() {
  const colors = ["#FFC94D", "#FFF7EC", "#29D3C2", "#FF7AB3", "#FFE7A0", "#B8FFF6"];
  return (
    <div class="lkconf" aria-hidden="true">
      {Array.from({ length: 36 }, (_, i) => {
        const left = i % 2 === 0;
        return <span key={i} class="lkconf__p" style={{ "--x": `${(left ? 1 : -1) * (180 + ((i * 53) % 320))}px`, "--y": `${-(260 + ((i * 97) % 220))}px`, "--r": `${(i * 67) % 720}deg`, "--c": colors[i % colors.length], [left ? "left" : "right"]: "20px", "--d": `${(i % 6) * 30}ms` }} />;
      })}
    </div>
  );
}
