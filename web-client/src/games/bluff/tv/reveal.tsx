// BL-TV-05 the reveal (GAME-BLUFF §12.2 / §12.2.1, DESIGN-JAMAA §5.2): one step list on the shared sampler, played
// locally from the snapshot (the server timer runs regardless; OK completes it, platform §3.10 E). Per lie: spotlight,
// voters hop onto the card, drumroll, the LIE!/HOUSE LIE stamp, the liar pops out with the moustache on a stick, coins
// fly from each fooled voter into the liar's pill and the odometer rolls. The truth turns gold; finders cheer and get
// their coins. Then "Nobody bought it" and the like tally. The final: anonymous envelopes, the crown, the twist card.
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { Expression } from "@jamaa/shared/characters";
import { run } from "@jamaa/shared/motion";
import type { Run } from "@jamaa/shared/motion";
import { isolate, listOf, t } from "../../../i18n/t";
import { reduced } from "../../../lib/motion";
import { Character } from "../../../components/Character";
import { COLOR_BY_ID } from "../../../components/PlayerChip";
import { clearChoreo, setChoreo } from "../../../tv-mock/tvPlatform";
import { stopAll } from "../../../tv-mock/sound/player";
import { Envelope, Heart, HouseChar, Lifebuoy, Moustache, Stamp, setOdo } from "../art";
import { beatAt, revealPlan, runningScores, seatExpression } from "../model";
import type { Mark } from "../model";
import type { Beat, BluffModel, Reveal, RevealStep, Seat } from "../model";
import {
  BOX, CARD, CARD_TOP, MAX_ENVELOPES, SEAT_CHAR, SEAT_Y, PILL_Y, bezier, coinsOf, control, hoppers, landing, popSpot, revealTimeline, seatX,
} from "../choreo";
import type { Coin, Pt } from "../choreo";
import { BfTop, Cafe, Seats, TvPrompt, rtl, tk } from "./stage";
import { cue, riseRate, sfx } from "./sfx";

/** OK in game completes the running reveal (module hook for TvGameModule.onOk). */
let completeCurrent: (() => void) | null = null;
export function completeReveal(): boolean {
  if (!completeCurrent) return false;
  completeCurrent();
  return true;
}

const HOP_SIZE = 44;

function stampFor(s: RevealStep): { tone: "lie" | "house" | "truth"; key: string } {
  return s.kind === "truth" ? { tone: "truth", key: "reveal.truth" } : s.kind === "house" ? { tone: "house", key: "reveal.house" } : { tone: "lie", key: "reveal.lie" };
}

export function TvReveal({ m }: { m: BluffModel }) {
  const r = m.pub.reveal!;
  const calm = reduced();
  const isRtl = rtl();
  const plan = useMemo(() => revealPlan(r, calm), [r, calm]);
  const tl = useMemo(() => revealTimeline(r, plan), [r, plan]);
  const scores = useMemo(() => runningScores(m, plan), [r, plan]);
  const seats = useMemo(() => m.seats.filter((s) => !s.left || s.score > 0), [m.seats]);
  const pos = useMemo(() => new Map(seats.map((s, i) => [s.id, seatX(seats.length, i, isRtl)])), [seats, isRtl]);
  const root = useRef<HTMLDivElement>(null);
  const [bi, setBi] = useState(0);
  const [mark, setMark] = useState<Mark>(0);
  const [ended, setEnded] = useState(false);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const fired = new Set<string>();
    const once = (id: string, f: () => void): void => { if (!fired.has(id)) { fired.add(id); f(); } };
    let curBeat = -1;
    let curMark: Mark = 0;
    let landed = 0;
    const frame = (p: (id: string, i?: number) => number, tMs: number): void => {
      const b = beatAt(plan, tMs);
      const tb = tl.beats[b]!;
      const beat = plan.beats[b]!;
      const mk: Mark = tMs >= tb.marks.tick && tb.marks.tick > beat.start ? 4 : tMs >= tb.marks.pop ? 3 : tMs >= tb.marks.stamp ? 2 : tMs >= tb.marks.land ? 1 : 0;
      if (b !== curBeat) { curBeat = b; curMark = mk; landed = 0; setBi(b); setMark(mk); }
      else if (mk !== curMark) { curMark = mk; setMark(mk); }
      for (const n of el.querySelectorAll<HTMLElement>("[data-s]")) n.style.setProperty("--p", String(p(n.dataset.s!, Number(n.dataset.i ?? 0))));
      for (const n of el.querySelectorAll<HTMLElement>("[data-fly]")) {
        const q = p(n.dataset.fly!, Number(n.dataset.i ?? 0));
        const a = { x: Number(n.dataset.x0), y: Number(n.dataset.y0) }, z = { x: Number(n.dataset.x1), y: Number(n.dataset.y1) };
        const at = bezier(a, control(a, z), z, Math.min(1, Math.max(0, q)));
        n.style.transform = `translate(${at.x}px, ${at.y}px)`;
        n.style.opacity = q <= 0 || q >= 1 ? "0" : "1";
      }
      for (const n of el.querySelectorAll<HTMLElement>("[data-count]")) n.textContent = `×${Math.round(Number(n.dataset.count) * Math.min(1, p(n.dataset.cs!)))}`;
      // Odometers: the running total of this beat, rolled by its tick step.
      const from = scores[b]!, to = scores[b + 1]!;
      const k = p(`b${b}.tick`);
      for (const n of el.querySelectorAll<HTMLElement>("[data-odo]")) {
        const id = n.dataset.odo!;
        const a = from.get(id) ?? 0, z = to.get(id) ?? a;
        setOdo(n, a + (z - a) * Math.min(1, Math.max(0, k)));
      }
      // Sounds (DESIGN-JAMAA §5.5): tok per landing, drumroll, stamps, pop, coins, counter, montage, likes, crown, flip.
      const kind = beat.kind;
      const step = r.steps[beat.steps[0] ?? -1];
      const hops = hoppers(r, beat).length;
      if (kind === "intro") once("intro", () => cue("sfx.drumroll"));
      for (let i = 0; i < hops && (kind === "lie" || kind === "truth"); i++) if (p(`b${b}.jump`, i) >= 0.95) once(`b${b}.tok${i}`, () => sfx("tok", riseRate(i)));
      if (kind === "lie" && mk >= 1) once(`b${b}.drum`, () => cue("sfx.drumroll"));
      if (mk >= 2 && step) {
        if (kind === "truth") once(`b${b}.st`, () => cue("truth_reveal"));
        else if (kind === "lie" || kind === "quick") once(`b${b}.st`, () => (step.kind === "house" ? cue("house_got_you") : sfx("stamp_lie")));
        else if (kind === "answer") once(`b${b}.st`, () => sfx("envelope"));
      }
      if (kind === "crown" && mk >= 2) once(`b${b}.crown`, () => cue("crown_drop"));
      if (kind === "twist" && mk >= 2) once(`b${b}.twist`, () => cue("sfx.flip"));
      if (mk >= 3 && (kind === "lie" || kind === "answer") && step && step.authorIds.length > 0) once(`b${b}.pop`, () => cue("reaction_pop"));
      const coins = coinsOf(r, beat).length;
      if (coins > 0 && p(`b${b}.coin`) > 0) once(`b${b}.fly`, () => cue("coin_fly"));
      for (let i = 0; i < coins; i++) if (p(`b${b}.coin`, i) >= 1 && landed < 10) once(`b${b}.land${i}`, () => { cue("coin_land"); landed++; });
      if (k > 0 && from !== to && [...to].some(([id, v]) => from.get(id) !== v)) once(`b${b}.tick`, () => cue("counter_tick"));
      if (kind === "montage") once(`b${b}.m`, () => cue("sfx.leave"));
      if (kind === "likes" && p(`b${b}.heart`) > 0) once(`b${b}.l`, () => sfx("like"));
    };
    const runner: Run = run(tl.steps, frame, () => { clearChoreo(wrapped); completeCurrent = null; setEnded(true); });
    const wrapped: Run = { complete: () => { stopAll(); runner.complete(); }, cancel: runner.cancel, get running() { return runner.running; } };
    setChoreo(wrapped);
    completeCurrent = wrapped.complete;
    return () => { runner.cancel(); clearChoreo(wrapped); if (completeCurrent === wrapped.complete) completeCurrent = null; };
  }, []);

  const beat: Beat = ended ? { kind: "intro", start: 0, dur: 0, steps: [] } : plan.beats[bi]!;
  const step = r.steps[beat.steps[0] ?? -1] ?? null;
  const hop = ended ? [] : hoppers(r, beat);
  const onCard = new Set(hop);
  // Round-1 Spot-on players stand on the truth card from the start of its beat (their +150 was paid already).
  const spotOn = !ended && beat.kind === "truth" && step ? step.spotOnIds : [];
  const pid = `b${bi}`;
  const exprOf = (s: Seat): Expression => seatExpression(r, beat, mark, s, ended);
  return (
    <div ref={root} class={`tvscreen bf bf--reveal bfrv bfrv--${ended ? "end" : beat.kind}${calm ? " is-calm" : ""}`} data-world="hakawati-cafe" data-bf-phase="REVEAL" data-pid={m.pub.prompt?.id ?? ""} data-beat={ended ? "end" : beat.kind}>
      <Cafe dim board={false} />
      <BfTop m={m} timer={false} />
      {m.pub.prompt && <div class="bfrv__prompt"><TvPrompt prompt={m.pub.prompt} final={r.final} small /></div>}

      {!ended && beat.kind === "intro" && <IntroBoard m={m} r={r} pid={pid} />}
      {!ended && (beat.kind === "lie" || beat.kind === "quick" || beat.kind === "truth") && step && (
        <LieCard m={m} r={r} step={step} beat={beat} pid={pid} mark={mark} key={pid} />
      )}
      {!ended && beat.kind === "answer" && step && <AnswerCard m={m} step={step} pid={pid} mark={mark} key={pid} />}
      {!ended && beat.kind === "crown" && <CrownBeat m={m} r={r} beat={beat} pid={pid} mark={mark} key={pid} />}
      {!ended && beat.kind === "twist" && <TwistBeat r={r} pid={pid} key={pid} />}
      {!ended && beat.kind === "montage" && <Montage m={m} r={r} pid={pid} key={pid} />}
      {!ended && beat.kind === "likes" && <Likes r={r} pid={pid} pos={pos} key={pid} />}
      {ended && <EndCard m={m} r={r} />}

      <Seats m={m} o={{
        expression: exprOf, pills: true, pillValue: (s) => (ended ? s.score : scores[bi]?.get(s.id) ?? s.score),
        away: (s) => onCard.has(s.id) || spotOn.includes(s.id),
      }} />

      {/* voters hop from their seat onto the card (finders on the truth); Spot-on players already stand there */}
      {[...hop, ...spotOn].map((id, k) => {
        const s = m.byId.get(id);
        const x0 = pos.get(id);
        if (!s || x0 === undefined) return null;
        const n = hop.length + spotOn.length;
        const land = landing(k, n);
        const quick = beat.kind === "quick";
        const fixed = k >= hop.length;
        return (
          <span key={`${pid}.${id}`} class={`bfhop${quick ? " is-face" : ""}${fixed ? " is-fixed" : ""}`} data-s={fixed ? undefined : `${pid}.${quick ? "faces" : "jump"}`} data-i={k}
            style={{ left: `${x0 - HOP_SIZE / 2}px`, top: `${SEAT_Y - HOP_SIZE}px`, "--dx": `${land.x - x0}px`, "--dy": `${land.y - SEAT_Y}px`, "--p": fixed ? 1 : 0 }}>
            <Character color={s.color} size={HOP_SIZE} expression={exprOf(s)} />
            {fixed && <span class="bfhop__pin">{tk("reveal.knewItPin")}</span>}
            {beat.kind === "truth" && step?.foundEarlyIds.includes(id) && <span class="bfhop__pin is-early">{tk("reveal.foundEarly")}</span>}
          </span>
        );
      })}

      {!ended && !calm && coinsOf(r, beat).map((c, i) => <CoinSprite key={`${pid}.c${i}`} c={c} i={i} pid={pid} m={m} pos={pos} hop={hop} />)}
    </div>
  );
}

function nameList(m: BluffModel, ids: readonly string[]): string {
  return listOf(ids.map((id) => isolate(m.byId.get(id)?.name ?? "?")));
}

/** The option cards on the corkboard slide down and dim; the host card asks the room (§12.2 intro beat). */
function IntroBoard({ m, r, pid }: { m: BluffModel; r: Reveal; pid: string }) {
  const houseOnly = !r.final && r.steps.every((s) => s.kind !== "lie") && r.unpicked.every((u) => u.authorIds.length === 0);
  return (
    <div class="bfrv__intro">
      <ol class={`bfboard is-mini${m.pub.options.length > 6 ? " is-dense" : ""}`} data-s={`${pid}.dim`}>
        {m.pub.options.map((o, i) => <li key={o.id} class="bfnote" style={{ "--i": i, "--tilt": "0deg" }}><span class="bfnote__text" dir="auto">{o.text}</span></li>)}
      </ol>
      <p class="bfrv__ask">{r.final ? tk("reveal.finalIntro") : m.pub.notice === "allKnew" ? tk("reveal.allKnew") : houseOnly ? tk("write.houseDidAll") : tk("vote.title")}</p>
    </div>
  );
}

/** One lie (or the truth) in the spotlight, with its stamp, the liar popping out and the captions. */
function LieCard({ m, r, step, beat, pid, mark }: { m: BluffModel; r: Reveal; step: RevealStep; beat: Beat; pid: string; mark: Mark }) {
  const truth = step.kind === "truth";
  const quick = beat.kind === "quick";
  const st = stampFor(step);
  const authors = step.authorIds;
  const fooled = step.voterIds.length;
  const isR = rtl();
  const eligible = m.seats.filter((s) => !s.left).length - step.spotOnIds.length;
  const finders = step.voterIds.length;
  const caption = truth
    ? m.pub.notice === "allKnew" ? tk("reveal.allKnew")
      : finders === 0 && step.spotOnIds.length === 0 ? tk("reveal.nobodyFound")
        : finders > 0 && finders >= eligible ? tk("reveal.tooEasy") : null
    : null;
  return (
    <>
      <div class={`bfcard${truth ? " is-truth" : ""}${quick ? " is-quick" : ""}`} data-s={`${pid}.spot`} data-card={step.optionId}
        style={{ left: `${CARD.x - CARD.w / 2}px`, top: `${CARD_TOP}px`, width: `${CARD.w}px`, minHeight: `${CARD.h}px` }}>
        {truth && <span class="bfcard__gold" data-s={`${pid}.gold`} aria-hidden="true" />}
        {truth && <span class="bfcard__sweep" data-s={`${pid}.sweep`} aria-hidden="true" />}
        {!truth && <span class="bfcard__tremble" aria-hidden="true" />}
        <p class="bfcard__text" dir="auto">{step.text}</p>
        {mark >= 2 && <span class="bfcard__stamp" data-s={`${pid}.stamp`}><Stamp tone={st.tone}>{tk(st.key)}</Stamp></span>}
        {truth && mark >= 2 && <Confetti pid={pid} />}
      </div>
      {!truth && mark >= 3 && (authors.length > 0 ? authors.slice(0, 3).map((id, k) => {
        const s = m.byId.get(id);
        const at = popSpot(isR, k);
        return s ? (
          <span key={id} class="bfpop" data-s={`${pid}.pop`} style={{ left: `${at.x - 42}px`, top: `${at.y - 84}px` }}>
            <Character color={s.color} size={84} expression="smug" />
            <span class="bfpop__stick"><Moustache size={46} /></span>
          </span>
        ) : null;
      }) : (
        <span class="bfpop bfpop--house" data-s={`${pid}.pop`} style={{ left: `${popSpot(isR).x - 40}px`, top: `${popSpot(isR).y - 80}px` }}><HouseChar size={80} laugh /></span>
      ))}
      <div class="bfrv__caption" style={{ top: `${CARD.y + CARD.h / 2 + 18}px` }}>
        {!truth && mark >= 3 && authors.length > 0 && (
          <p class="bfcap bfcap--big">{tk("reveal.fooled", { name: nameList(m, authors), count: fooled })}
            {step.helped && <span class="bfcap__help"><Lifebuoy size={18} />{tk("reveal.helped")}</span>}</p>
        )}
        {!truth && mark >= 3 && authors.length > 1 && <p class="bfcap">{tk("reveal.sameLie")}</p>}
        {!truth && mark >= 3 && authors.length === 0 && <p class="bfcap bfcap--big">{tk("reveal.houseWrote")}</p>}
        {truth && mark >= 2 && caption && <p class="bfcap bfcap--big">{caption}</p>}
        {truth && r.truth?.note && mark >= 4 && (
          <p class="bfcap bfcap--note" data-s={`${pid}.note`} dir="auto">{tk("reveal.itMeans", { note: r.truth.note })}
            {r.truth.original && r.truth.original !== r.truth.text && <span class="bfcap__orig"> · {tk("reveal.inArabic")} <bdi dir="rtl">{r.truth.original}</bdi></span>}</p>
        )}
      </div>
    </>
  );
}

function Confetti({ pid }: { pid: string }) {
  const bits = Array.from({ length: 18 }, (_, i) => i);
  return (
    <span class="bfconfetti" data-s={`${pid}.confetti`} aria-hidden="true">
      {bits.map((i) => <i key={i} style={{ "--a": `${(i * 47) % 360}deg`, "--d": `${60 + ((i * 29) % 120)}px`, "--c": i % 2 ? "#FFF7EC" : "#FFC94D", "--x": i % 4 < 2 ? "0%" : "100%" }} />)}
    </span>
  );
}

/** A coin: from a voter on the card (or the card, or the ballot box) along a Bézier into a pill (§3.10 C). */
function CoinSprite({ c, i, pid, m, pos, hop }: { c: Coin; i: number; pid: string; m: BluffModel; pos: Map<string, number>; hop: string[] }) {
  const to = m.byId.get(c.to);
  const x1 = pos.get(c.to);
  if (!to || x1 === undefined) return null;
  let a: Pt;
  if (c.from === "card") a = { x: CARD.x, y: CARD.y };
  else if (c.from === "box") a = { x: rtl() ? 960 - BOX.x : BOX.x, y: BOX.y };
  else { const k = hop.indexOf(c.from); a = k >= 0 ? landing(k, hop.length) : { x: CARD.x, y: CARD.y }; a = { x: a.x, y: a.y - 20 }; }
  const z = { x: x1, y: PILL_Y };
  const col = COLOR_BY_ID[to.color];
  return (
    <span class="bfcoin" data-fly={`${pid}.coin`} data-i={i} data-x0={a.x} data-y0={a.y} data-x1={z.x} data-y1={z.y} style={{ "--c": col.hex, opacity: 0 }}>
      <span class="bfcoin__disc" />
      {c.label && <span class="bfcoin__label tnum">{c.label}</span>}
    </span>
  );
}

/** Final: one answer, its anonymous envelopes (no voter shown), the counter and its author popping out. */
function AnswerCard({ m, step, pid, mark }: { m: BluffModel; step: RevealStep; pid: string; mark: Mark }) {
  const isR = rtl();
  const n = Math.min(MAX_ENVELOPES, step.voteCount);
  const house = step.authorIds.length === 0;
  const at = popSpot(isR);
  return (
    <>
      <span class="bfballotbox" style={{ left: `${(isR ? 960 - BOX.x : BOX.x) - 34}px`, top: `${BOX.y - 30}px` }} aria-hidden="true"><Envelope size={30} sealed={false} /></span>
      <div class="bfcard" data-s={`${pid}.spot`} style={{ left: `${CARD.x - CARD.w / 2}px`, top: `${CARD_TOP}px`, width: `${CARD.w}px`, minHeight: `${CARD.h}px` }}>
        <p class="bfcard__text" dir="auto">{step.text}</p>
        <span class="bfcard__count tnum" data-count={step.voteCount} data-cs={`${pid}.count`}>×0</span>
        <span class="bfenvs" aria-hidden="true">
          {Array.from({ length: n }, (_, i) => <span key={i} class="bfenv" data-s={`${pid}.env`} data-i={i} style={{ "--k": i - (n - 1) / 2 }}><Envelope size={28} /></span>)}
        </span>
      </div>
      {mark >= 3 && (house
        ? <span class="bfpop bfpop--house" data-s={`${pid}.pop`} style={{ left: `${at.x - 40}px`, top: `${at.y - 80}px` }}><HouseChar size={80} laugh /></span>
        : step.authorIds.slice(0, 3).map((id, k) => {
          const s = m.byId.get(id);
          const p = popSpot(isR, k);
          return s ? <span key={id} class="bfpop" data-s={`${pid}.pop`} style={{ left: `${p.x - 42}px`, top: `${p.y - 84}px` }}><Character color={s.color} size={84} expression="smug" /></span> : null;
        }))}
      <div class="bfrv__caption" style={{ top: `${CARD.y + CARD.h / 2 + 18}px` }}>
        {mark >= 3 && <p class="bfcap bfcap--big">{house ? tk("reveal.houseWrote") : `${nameList(m, step.authorIds)} · ${t("results.pointsEarned", { count: step.deltas.filter((d) => d.reason === "fooled").reduce((a, d) => a + d.points, 0) })}`}</p>}
      </div>
    </>
  );
}

/** Final: MOST CONVINCING, the crown hops onto the author(s), +400, confetti (§12.2.1 step 3). */
function CrownBeat({ m, r, beat, pid, mark }: { m: BluffModel; r: Reveal; beat: Beat; pid: string; mark: Mark }) {
  const tops = beat.steps.map((i) => r.steps[i]!).filter(Boolean);
  if (tops.length === 0) return <div class="bfrv__center"><p class="bfcap bfcap--big">{tk("reveal.noCrown")}</p></div>;
  const unanimous = tops.length === 1 && tops[0]!.voteCount > 0 && tops[0]!.voteCount === r.steps.reduce((a, s) => a + s.voteCount, 0) && r.steps.filter((s) => s.voteCount > 0).length === 1;
  return (
    <div class="bfcrown">
      {tops.slice(0, 3).map((s) => (
        <div key={s.optionId} class="bfcard is-gold is-crown" data-s={`${pid}.spot`}>
          <p class="bfcard__text" dir="auto">{s.text}</p>
          {mark >= 2 && <span class="bfcard__stamp" data-s={`${pid}.stamp`}><Stamp tone="truth" class="bf-stamp--goldtv">{tk("reveal.mostConvincing")}</Stamp></span>}
          <div class="bfcrown__who">
            {s.authorIds.map((id) => {
              const p = m.byId.get(id);
              return p ? (
                <span key={id} class="bfcrown__p" data-s={`${pid}.pop`}>
                  <span class="bfcrown__crown" data-s={`${pid}.crown`} aria-hidden="true"><svg viewBox="0 0 24 16" width="40" height="27"><path d="M2 14L4 3l5 5 3-7 3 7 5-5 2 11z" fill="#FFC94D" stroke="#120A1F" stroke-width="1.2" stroke-linejoin="round" /></svg></span>
                  <Character color={p.color} size={72} expression={mark >= 2 ? "cheer" : "idle"} />
                  <bdi class="bfcrown__name">{p.name}</bdi>
                </span>
              ) : null;
            })}
          </div>
          {mark >= 3 && <span class="bfcrown__bonus tnum">+400</span>}
        </div>
      ))}
      {mark >= 2 && <Confetti pid={pid} />}
      {unanimous && mark >= 2 && <p class="bfcap bfcap--big bfcrown__note">{tk("reveal.unanimous")}</p>}
    </div>
  );
}

/** Final: every card flips at once to "No truth: it was all made up!" (§12.2.1 step 4). */
function TwistBeat({ r, pid }: { r: Reveal; pid: string }) {
  const all = [...r.steps.map((s) => s.text), ...r.unpicked.map((u) => u.text)];
  return (
    <div class="bftwist">
      <ol class={`bftwist__grid${all.length > 6 ? " is-dense" : ""}`}>
        {all.map((text, i) => (
          <li key={i} class="bfflip" data-s={`${pid}.flip`} data-i={i}>
            <span class="bfflip__front" dir="auto">{text}</span>
            <span class="bfflip__back" aria-hidden="true">{tk("reveal.lie")}</span>
          </li>
        ))}
      </ol>
      <p class="bftwist__stamp" data-s={`${pid}.stamp`}><span>{tk("reveal.noTruthStamp")}</span></p>
    </div>
  );
}

/** "Nobody bought it…": unpicked lies fan out like a hand of cards with their authors' sad faces, then fall. */
function Montage({ m, r, pid }: { m: BluffModel; r: Reveal; pid: string }) {
  const cards = r.unpicked.slice(0, 6);
  const rest = r.unpicked.slice(6);
  return (
    <div class="bfmontage">
      <p class="bfcap bfcap--big">{tk("reveal.nobody")}</p>
      <div class="bfmontage__hand">
        {cards.map((u, i) => (
          <div key={u.optionId} class="bfmcard" data-s={`${pid}.fan`} data-i={i} style={{ "--k": i - (cards.length - 1) / 2 }}>
            <span class="bfmcard__fall" data-s={`${pid}.fall`} data-i={i}>
              <span class="bfmcard__text" dir="auto">{u.text}</span>
              <span class="bfmcard__who">
                {u.authorIds.length === 0 ? <HouseChar size={36} /> : u.authorIds.slice(0, 2).map((id) => { const s = m.byId.get(id); return s ? <Character key={id} color={s.color} size={40} expression="sad" /> : null; })}
              </span>
            </span>
          </div>
        ))}
      </div>
      {rest.length > 0 && <p class="bfmontage__rest" dir="auto">{rest.map((u) => u.text).join(" · ")}</p>}
    </div>
  );
}

/** The like tally: hearts drift from likers to the liked answers' authors; likes on the truth or a house lie: the house thanks you. */
function Likes({ r, pid, pos }: { r: Reveal; pid: string; pos: Map<string, number> }) {
  const flights: { from: string; to: string }[] = [];
  let houseThanks = false;
  for (const s of [...r.steps, ...r.unpicked.map((u) => ({ ...u, kind: "lie" as const }))]) {
    if (s.likerIds.length === 0) continue;
    if (s.authorIds.length === 0) { houseThanks = true; continue; }
    for (const l of s.likerIds) for (const a of s.authorIds) flights.push({ from: l, to: a });
  }
  return (
    <div class="bflikes">
      <p class="bfcap bfcap--big"><Heart size={26} on />{tk("vote.like")}</p>
      {houseThanks && <p class="bfcap">{tk("reveal.houseLike")}</p>}
      {flights.slice(0, 24).map((f, i) => {
        const x0 = pos.get(f.from), x1 = pos.get(f.to);
        if (x0 === undefined || x1 === undefined) return null;
        return (
          <span key={i} class="bfheartfly" data-fly={`${pid}.heart`} data-i={i} data-x0={x0} data-y0={SEAT_Y - SEAT_CHAR} data-x1={x1} data-y1={PILL_Y} style={{ opacity: 0 }}>
            <Heart size={22} on />
          </span>
        );
      })}
    </div>
  );
}

/** After the last beat (or OK): the truth with its note (rounds 1–2) or the twist line (final), until SCORES. */
function EndCard({ m, r }: { m: BluffModel; r: Reveal }) {
  if (r.final) {
    const tops = r.steps.filter((s) => s.top);
    return (
      <div class="bfrv__center">
        <p class="bftwist__stamp is-static"><span>{tk("reveal.noTruthStamp")}</span></p>
        {tops.length > 0 && <p class="bfcap bfcap--big">{tk("reveal.mostConvincing")} · {nameList(m, tops.flatMap((s) => s.authorIds))}</p>}
      </div>
    );
  }
  return (
    <>
      <div class="bfcard is-truth is-end" style={{ left: `${CARD.x - CARD.w / 2}px`, top: `${CARD_TOP}px`, width: `${CARD.w}px`, minHeight: `${CARD.h}px` }}>
        <span class="bfcard__gold" style={{ "--p": 1 }} aria-hidden="true" />
        <p class="bfcard__text" dir="auto">{r.truth?.text ?? ""}</p>
        <span class="bfcard__stamp" style={{ "--p": 1 }}><Stamp tone="truth">{tk("reveal.truth")}</Stamp></span>
      </div>
      {r.truth?.note && (
        <div class="bfrv__caption" style={{ top: `${CARD.y + CARD.h / 2 + 18}px` }}>
          <p class="bfcap bfcap--note" dir="auto">{tk("reveal.itMeans", { note: r.truth.note })}
            {r.truth.original && r.truth.original !== r.truth.text && <span class="bfcap__orig"> · {tk("reveal.inArabic")} <bdi dir="rtl">{r.truth.original}</bdi></span>}</p>
        </div>
      )}
    </>
  );
}
