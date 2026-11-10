// LK-TV-04 AWARDS (GAME-LIKELY §12.4: three players at a time on podium marks, a rosette drops with each award name and
// the original prompt, a golden glint sweeps; the Mystery Award is a "?" puff; then the Mind Reader podium, public
// mode only) and LK-TV-05 RESULTS (Mind Reader ranking + the awards wall; secret votes: the wall only). The trio on
// screen is derived from the server deadline, so every TV (and a reconnecting one) shows the same trio.
import { useEffect, useRef, useState } from "preact/hooks";
import { run, variant } from "@jamaa/shared/motion";
import { fmtNum, listOf, t } from "../../../i18n/t";
import { reduced } from "../../../lib/motion";
import { Icon } from "../../../components/Icon";
import { Character } from "../../../components/Character";
import { useDeadline } from "../../../components/Timer";
import { resultsSettled } from "../../../tv-mock/tvPlatform";
import { useInGameOk } from "../../../tv-mock/tvParts";
import { TitleLockup } from "../../../components/Poster";
import { CrystalBall, MysteryPuff, Rosette } from "../art";
import { activeSeats, awardsOf, awardsStage, deadlineOf, extraAwards, mindReader, podiumSteps, rankRows, signatureRow } from "../model";
import type { LikelyAward, LikelyModel, Seat } from "../model";
import { awardText, k, promptLine } from "../parts";
import { LkTop, World } from "./stage";
import { sfx } from "./sfx";

function extrasOf(m: LikelyModel, id: string): LikelyAward[] {
  return extraAwards(m.pub).filter((a) => a.playerIds.includes(id));
}

function PodiumCard({ m, seat, award, i }: { m: LikelyModel; seat: Seat; award: LikelyAward | null; i: number }) {
  const txt = award ? awardText(award) : null;
  const mystery = award?.kind === "mystery";
  return (
    <div class={`lkpod${seat.left ? " is-left" : ""}${mystery ? " is-mystery" : ""}`} style={{ "--i": i }}>
      <div class="lkpod__stage">
        <span class="lkpod__glow" aria-hidden="true" />
        <Character color={seat.color} size={120} expression={seat.left ? "away" : mystery ? "smug" : "cheer"} />
        <span class="lkpod__prop">{mystery ? <MysteryPuff size={84} /> : <Rosette size={70} />}</span>
        <span class="lkpod__disc" aria-hidden="true" />
      </div>
      <bdi class="lkpod__name">{seat.name}</bdi>
      {txt && <p class="lkpod__title"><span class="lkpod__glint" aria-hidden="true" />{txt.title}</p>}
      {txt?.line && <p class="lkpod__line">{txt.line}</p>}
      {seat.left && <p class="lkpod__line">{t(k("awards.left"))}</p>}
      <div class="lkpod__extras">
        {extrasOf(m, seat.id).map((a) => <span key={a.kind} class="lkpod__extra"><Icon name="star" size={16} />{awardText(a).title}</span>)}
      </div>
    </div>
  );
}

/** Most characters drawn on one podium step (a bigger tie shows "+n"). */
const STEP_MAX = 4;

function MindReaderPodium({ m }: { m: LikelyModel }) {
  const mr = mindReader(m.pub);
  const steps = podiumSteps(m);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    sfx("glint");
    const r = run(variant([{ id: "counter", startMs: 500, durationMs: 900, easing: "ease.decel", reduced: "fade", lite: "keep" }], { reduced: reduced() }), (p) => {
      el.querySelectorAll<HTMLElement>("[data-score]").forEach((s) => { s.textContent = fmtNum(Math.round(Number(s.dataset.score) * p("counter"))); });
    });
    return () => r.cancel();
  }, []);
  // Steps 3-2-1: second on the start side, the winner in the middle, third on the end side. Tied players share a step.
  const order: [Seat[], number][] = [[steps[1], 2], [steps[0], 1], [steps[2], 3]];
  return (
    <div class="lkmr" ref={root}>
      <h1 class="lkmr__title">{mr ? awardText(mr).title : t(k("awards.mindReader.title"))}</h1>
      <p class="lkmr__line">{t(k("awards.mindReader.line"))}</p>
      <div class="lkmr__steps">
        {order.map(([group, place]) => {
          if (group.length === 0) return <div key={place} class={`lkmr__step is-p${place} is-empty`} />;
          const shown = group.slice(0, STEP_MAX);
          const big = place === 1 ? 120 : 92;
          const size = shown.length === 1 ? big : shown.length === 2 ? Math.round(big * 0.7) : Math.round(big * 0.52);
          const winAt = (s: Seat): boolean => mr?.playerIds.includes(s.id) ?? place === 1;
          return (
            <div key={place} class={`lkmr__step is-p${place}${group.some(winAt) ? " is-win" : ""}${group.length > 1 ? " is-tie" : ""}`} data-place={place} data-tie={group.length}>
              <div class="lkmr__who">
                {shown.map((s) => (
                  <span key={s.id} class="lkmr__ch">
                    <Character color={s.color} size={size} expression={winAt(s) ? "cheer" : "happy"} crown={winAt(s)} />
                    {winAt(s) && shown.length === 1 && <span class="lkmr__ball"><CrystalBall size={56} /></span>}
                  </span>
                ))}
                {group.length > STEP_MAX && <span class="lkmr__more tnum">+{fmtNum(group.length - STEP_MAX)}</span>}
              </div>
              <bdi class="lkmr__name">{listOf(group.map((s) => s.name))}</bdi>
              <span class="lkmr__block"><span class="lkmr__place tnum">{fmtNum(place)}</span><span class="lkmr__score tnum" data-score={group[0]!.score}>{fmtNum(reduced() ? group[0]!.score : 0)}</span></span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TvAwards({ m }: { m: LikelyModel }) {
  const dl = deadlineOf(m);
  const c = useDeadline(dl);
  const players = m.seats.length;
  const elapsed = dl && c ? dl.durationMs - c.ms : 0;
  const st = awardsStage(players, m.pub.showVoters, elapsed);
  const rows = signatureRow(m);
  const key = st.kind === "trio" ? `t${st.index}` : st.kind;
  // A rosette chime (or the mystery puff) as each trio lands.
  useEffect(() => {
    if (st.kind !== "trio") return;
    const trio = rows.slice(st.index * 3, st.index * 3 + 3);
    sfx(trio.some((r) => r.award?.kind === "mystery") ? "puff" : "rosette");
  }, [key]);
  // OK completes the current trio's drop animation (the server's AWARDS timer moves on by itself).
  const [skip, setSkip] = useState("");
  useInGameOk(skip !== key, () => setSkip(key));
  return (
    <div data-world="rooftop" class={`tvscreen lkawards${skip === key ? " is-skipped" : ""}`} data-awards={key}>
      <World dim />
      <LkTop m={m} label={t(k("awards.title"))} />
      {st.kind === "intro" && (
        <div class="lkintro" key="intro">
          <TitleLockup id="likely" class="lkintro__lockup" />
          <h1 class="lkintro__title">{t(k("awards.title"))}</h1>
          <div class="lkintro__row">{activeSeats(m).map((s, i) => <span key={s.id} style={{ "--i": i }}><Character color={s.color} size={56} expression="happy" /></span>)}</div>
        </div>
      )}
      {st.kind === "trio" && (
        <div class="lktrio" key={key}>
          {rows.slice(st.index * 3, st.index * 3 + 3).map((r, i) => <PodiumCard key={r.seat.id} m={m} seat={r.seat} award={r.award} i={i} />)}
        </div>
      )}
      {st.kind === "mindReader" && <MindReaderPodium m={m} key="mr" />}
    </div>
  );
}

/** Awards wall layout by entries: ≤ 4 two roomy columns; 5–9 three columns with the prompt; 10+ three, titles only. */
export function wallDensity(n: number): "roomy" | "mid" | "dense" {
  return n <= 4 ? "roomy" : n <= 9 ? "mid" : "dense";
}

export function TvResults({ m }: { m: LikelyModel }) {
  useEffect(() => {
    const id = setTimeout(() => { resultsSettled.value = true; }, reduced() ? 300 : 1400);
    return () => { clearTimeout(id); resultsSettled.value = false; };
  }, []);
  const pub = m.pub.showVoters;
  const rows = signatureRow(m);
  const ranked = rankRows(m.seats);
  const mr = mindReader(m.pub);
  return (
    <div data-world="rooftop" class={`tvscreen lkres${pub ? " is-public" : " is-secret"}`} data-results>
      <World dim />
      <LkTop m={m} label={t(k("results.title"))} />
      <div class="lkres__body">
        {pub && (
          <section class="lkres__rank">
            <h2 class="lkres__h"><Icon name="trophy" size={22} />{t(k("results.mindReader"))}</h2>
            <ol class="lkres__list">
              {ranked.slice(0, 6).map(({ seat: s, rank }, i) => (
                <li key={s.id} data-rank={rank} class={`lkres__row${mr?.playerIds.includes(s.id) ? " is-win" : ""}${s.left ? " is-left" : ""}`} style={{ "--i": i }}>
                  <span class="lkres__pos tnum">{fmtNum(rank)}</span>
                  <Character color={s.color} size={40} expression={mr?.playerIds.includes(s.id) ? "cheer" : "idle"} crown={mr?.playerIds.includes(s.id)} />
                  <bdi class="lkres__name">{s.name}</bdi>
                  <span class="lkres__score tnum">{fmtNum(s.score)}</span>
                </li>
              ))}
            </ol>
          </section>
        )}
        <section class="lkres__wall">
          <h2 class="lkres__h"><Rosette size={22} />{t(k("results.awardsWall"))}</h2>
          <ul class={`lkres__grid lkres__grid--${wallDensity(rows.length)}`} data-density={wallDensity(rows.length)}>
            {rows.map((r, i) => {
              const extras = awardsOf(m.pub, r.seat.id).filter((a) => a.kind !== "mindReader" && a !== r.award);
              const main = r.award ?? extras.shift() ?? null;
              const line = main?.kind === "signature" && main.card ? promptLine(main.card.prompt) : main ? awardText(main).line : "";
              const dense = wallDensity(rows.length);
              return (
                <li key={r.seat.id} class={`lkres__award${r.seat.left ? " is-left" : ""}`} style={{ "--i": i }}>
                  <Character color={r.seat.color} size={dense === "roomy" ? 56 : dense === "mid" ? 40 : 34} expression={r.award?.kind === "mystery" ? "smug" : "happy"} />
                  <span class="lkres__awtext">
                    <bdi class="lkres__awname">{r.seat.name}</bdi>
                    {main && <span class="lkres__awtitle">{awardText(main).title}</span>}
                    {extras.length > 0 && (
                      <span class="lkres__chips">{extras.map((a) => <span key={a.kind} class="lkres__chip"><Icon name="star" size={13} />{awardText(a).title}</span>)}</span>
                    )}
                    {dense !== "dense" && line && <span class="lkres__awline" dir="auto">{line}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
