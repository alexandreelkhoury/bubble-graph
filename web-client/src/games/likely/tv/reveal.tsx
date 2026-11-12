// LK-TV-03 the reveal (GAME-LIKELY §12.2, DESIGN-JAMAA §5.3), redesigned with the owner (2026-11-12): one centred
// composition, no left/right split. The card lifts to the top, the players glide into one row; then every vote lands
// under its target one by one: public mode, the VOTER'S OWN CHARACTER in miniature flies from the voter to its pick
// (who voted for whom, at a glance); secret votes, identical envelopes drop from the card (tallies only). The counts
// pop (votes, or percentages with secret votes), the room dims around the most-voted, the award stamp lands and the
// banner names the award and its winner(s). No points anywhere (§6). One step list on the shared sampler; OK completes
// it (§3.10 E rule 5); the server's REVEAL timer runs regardless. Positions: the shared layout (likely/layout.ts).
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { Expression } from "@jamaa/shared/characters";
import { run, variant } from "@jamaa/shared/motion";
import type { Run } from "@jamaa/shared/motion";
import { likelyRevealMs } from "@jamaa/shared/games/likely/meta";
import { fmtNum, isolate, listOf, locale, t } from "../../../i18n/t";
import { reduced } from "../../../lib/motion";
import { Character } from "../../../components/Character";
import { useInGameOk } from "../../../tv-mock/tvParts";
import { stopAll } from "../../../tv-mock/sound/player";
import { Envelope, Rosette } from "../art";
import { CHAR, REVEAL_CHAR, againName, arcPoint, fmtPercent, revealExpression, revealPlan } from "../model";
import type { LikelyModel, Seat } from "../model";
import { k } from "../parts";
import { fitReveal, revealSteps } from "./choreo";
import { JuryChar, LkTop, TvCard, World, rtl } from "./stage";
import { platformCue, riseRate, sfx } from "./sfx";

type Stage = "run" | "stamp" | "end";

/** Where secret envelopes leave from: under the shrunk card. */
const CARD_DROP = { x: 480, y: 150 } as const;

export function TvReveal({ m }: { m: LikelyModel }) {
  const r = m.pub.reveal!;
  const isRtl = rtl();
  const pub = m.pub.showVoters && !!r.ballots;
  const plan = useMemo(() => revealPlan(m, isRtl), [m.pub.card?.id, m.pub.cardIndex, isRtl, m.seats.length]);
  const count = Math.max(1, plan.tokens.length);
  const steps = useMemo(() => fitReveal(revealSteps({ tokens: plan.tokens.length, chaos: r.chaos, none: r.none, unanimous: r.unanimous }),
    likelyRevealMs(r.votesCast, r.unanimous, r.topIds.length), count), [plan, r.chaos, r.none, r.unanimous]);
  const root = useRef<HTMLDivElement>(null);
  const runRef = useRef<Run | null>(null);
  const [stage, setStage] = useState<Stage>(() => (reduced() ? "end" : "run"));
  const [running, setRunning] = useState(true);
  const seats = m.seats.filter((s) => plan.row[s.id]);
  const top = r.topIds.map((id) => m.byId.get(id)).filter((s): s is Seat => !!s && !!plan.row[s.id]);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const fired = new Set<string>();
    const once = (id: string, f: () => void): void => { if (!fired.has(id)) { fired.add(id); f(); } };
    let stageNow: Stage = "run";
    const toStage = (s: Stage): void => { if (s !== stageNow) { stageNow = s; setStage(s); } };
    const cast = [...el.querySelectorAll<HTMLElement>("[data-cast]")];
    const toks = [...el.querySelectorAll<HTMLElement>("[data-token]")];
    const has = new Set(steps.map((x) => x.id));
    const eff = variant(steps, { reduced: reduced() });
    const landed = new Map<string, number>();
    platformCue("sfx.drumroll");
    const handle = run(eff, (p) => {
      const lift = Math.max(0, Math.min(1, p("dim")));
      el.style.setProperty("--dim", String(lift));
      for (const id of ["count", "spot", "stamp", "hold", "confetti", "scramble"]) el.style.setProperty(`--${id}`, has.has(id) ? String(p(id)) : "0");
      const scr = p("scramble");
      // The row glides from its card-phase seats to the reveal row (and shrinks 72 → 64), then holds still.
      cast.forEach((c, i) => {
        const id = c.dataset.cast!;
        const a = plan.seat[id]!, b = plan.row[id]!;
        let x = a.x + (b.x - a.x) * lift, y = a.y + (b.y - a.y) * lift;
        if (scr > 0 && scr < 1) {
          x += 18 * Math.sin(2 * Math.PI * (scr * 3 + i * 0.37)) * Math.sin(Math.PI * scr);
          y -= 14 * Math.abs(Math.sin(2 * Math.PI * (scr * 2.5 + i * 0.21)));
        }
        const sc = (CHAR + (REVEAL_CHAR - CHAR) * lift) / REVEAL_CHAR;
        c.style.transform = `translate(${(x - b.x).toFixed(1)}px, ${(y - b.y).toFixed(1)}px) scale(${sc.toFixed(3)})`;
      });
      // The votes: one by one, from the voter (public) or from the card (secret), along a soft arc to their slot.
      toks.forEach((e, i) => {
        const tk = plan.tokens[i]!;
        const q = Math.max(0, Math.min(1, p("token", i)));
        const from = tk.voterId ? { x: plan.row[tk.voterId]!.x, y: plan.row[tk.voterId]!.y - REVEAL_CHAR / 2 } : CARD_DROP;
        const pt = arcPoint(from, tk.at, q, tk.voterId === tk.targetId ? 20 : 70);
        e.style.transform = `translate(${(pt.x - tk.at.x).toFixed(1)}px, ${(pt.y - tk.at.y).toFixed(1)}px) scale(${(0.5 + 0.5 * q).toFixed(3)})`;
        e.style.opacity = q > 0 ? "1" : "0";
        if (q >= 1) once(`tok${i}`, () => {
          const n = (landed.get(tk.targetId) ?? 0) + 1;
          landed.set(tk.targetId, n);
          sfx("tok", riseRate(n - 1));
        });
      });
      if (p("count") > 0) once("count", () => platformCue("counter_tick"));
      if (scr > 0) once("scr", () => sfx("scramble"));
      if (p("spot") > 0) once("spot", () => sfx("spot"));
      if (p("stamp") > 0) once("stamp", () => { sfx("rosette"); toStage("stamp"); });
      if (p("confetti") > 0) once("conf", () => sfx("confetti"));
      // The hold fills the rest of the server window: the room has settled once it starts (OK has nothing left to finish).
      if (has.has("hold") && p("hold") > 0) once("hold", () => { toStage("end"); setRunning(false); });
    }, () => { toStage("end"); setRunning(false); }, count);
    runRef.current = handle;
    return () => handle.cancel();
  }, [plan, steps]);

  // OK completes the moment to its end state (and cuts the drumroll).
  useInGameOk(running, () => { stopAll(); runRef.current?.complete(); });

  const again = againName(m);
  const expr = (s: Seat): Expression => (stage === "run" && !(r.ballots ?? []).some((b) => b.voterId === s.id) ? (s.connected ? "idle" : "away") : revealExpression(m, s.id, stage));
  const look = (s: Seat): "start" | "end" | null => {
    if (stage !== "run" || !r.ballots) return null;
    const b = r.ballots.find((x) => x.voterId === s.id);
    if (!b || b.targetId === s.id) return null;
    return (plan.row[b.targetId]?.x ?? 0) < (plan.row[s.id]?.x ?? 0) ? "start" : "end";
  };
  const caption = r.none ? t(k("reveal.none")) : r.chaos ? t(k("reveal.chaos")) : "";
  return (
    <div data-world="rooftop" class={`tvscreen lkrev lkrev--${pub ? "public" : "secret"}${r.chaos ? " is-chaos" : ""}${r.unanimous ? " is-unanimous" : ""}`} ref={root} data-reveal={pub ? "public" : "secret"} data-running={running ? "1" : "0"}>
      <World dim />
      <LkTop m={m} />
      <TvCard m={m} small />
      {/* The players: one centred row; the most-voted step forward under the spotlight. */}
      <div class="lkcast">
        {seats.map((s) => {
          const p = plan.row[s.id]!;
          const isTop = top.some((x) => x.id === s.id);
          return (
            <div key={s.id} class={`lkcast__ch${isTop ? " is-top" : ""}`} data-cast={s.id} style={{ left: `${p.x - REVEAL_CHAR / 2}px`, top: `${p.y - REVEAL_CHAR}px` }}>
              <JuryChar s={s} expression={expr(s)} size={REVEAL_CHAR} look={look(s)} />
              {isTop && !r.chaos && <span class="lkcast__stamp"><Rosette size={30} /></span>}
              <bdi class="lkcast__name">{s.name}</bdi>
            </div>
          );
        })}
      </div>
      {/* The count above each voted player: votes (public) or the percentage (secret votes, GAME-LIKELY §8.1). */}
      {!r.none && r.counts.map((c) => {
        const p = plan.row[c.playerId];
        if (!p) return null;
        return <span key={c.playerId} class="lkcount" style={{ left: `${p.x + REVEAL_CHAR * 0.42}px`, top: `${p.y - REVEAL_CHAR - 7}px` }}>{pub ? fmtNum(c.count) : fmtPercent(c.percent, locale.value)}</span>;
      })}
      {/* The votes, stacked under their targets in arrival order. */}
      {plan.tokens.map((tk, i) => {
        const v = tk.voterId ? m.byId.get(tk.voterId) : null;
        return (
          <span key={i} class={`lktoken${v ? "" : " is-env"}`} data-token={i} style={{ left: `${tk.at.x - plan.cell / 2}px`, top: `${tk.at.y - plan.cell / 2}px`, width: `${plan.cell}px`, height: `${plan.cell}px` }}>
            {v ? <Character color={v.color} size={Math.round(plan.cell * 0.92)} expression="point" /> : <Envelope size={Math.round(plan.cell * 0.9)} />}
          </span>
        );
      })}
      {/* The result banner between the card and the row: the award and its winner(s), or chaos / no votes. */}
      {!r.chaos && !r.none && top.length > 0 && m.pub.card && (
        <p class="lkplate">
          {r.unanimous && <span class="lkplate__tag">{t(k("reveal.unanimous"))}</span>}
          <Rosette size={30} /><span class="lkplate__award">{m.pub.card.award}</span>
          <bdi class="lkplate__who">{listOf(top.map((s) => isolate(s.name)))}</bdi>
        </p>
      )}
      {caption && <p class={`lkcaption${r.chaos ? " is-chaos" : " is-none"}`}>{caption}</p>}
      {again && !r.chaos && <p class="lkagain">{t(k("reveal.again"), { name: isolate(again) })}</p>}
      {r.unanimous && stage !== "run" && !reduced() && <Confetti />}
    </div>
  );
}

/** Unanimous: a confetti cannon from both bottom corners (paper + gold, 36 pieces, 1.2 s). */
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
