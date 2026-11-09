// GAME-LIKELY §8 phone screens (LK-PH-01..05), lazy-loaded as the `game-likely` chunk. The platform shell adds the top
// bar, ⓘ, coach marks, the world flood, the benched view and the results cup + VIP buttons.
// Secrecy (§8.1): this phone shows only the public projection plus its own `me` (its own vote); the vote grid never
// recolours a picked tile (a subtle outline + small check), so a neighbour cannot read the pick over a shoulder.
import "./phone.css";
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import type { PlayerRoomView } from "@jamaa/shared/protocol/v2";
import { CHOREO, run, variant } from "@jamaa/shared/motion";
import { fmtNum, isolate, locale, t } from "../../i18n/t";
import { act } from "../../state/session";
import { announce } from "../../state/store";
import { HAPTIC, haptic } from "../../lib/haptics";
import { reduced } from "../../lib/motion";
import { Character } from "../../components/Character";
import { Icon } from "../../components/Icon";
import { TimerBar } from "../../components/Timer";
import { COLOR_BY_ID } from "../../components/PlayerChip";
import { CrystalBall, MysteryPuff, Rosette } from "./art";
import {
  activeSeats, awardsOf, canVote, deadlineOf, fmtPercent, likelyModel, myReveal, needsVote, targetsOf,
} from "./model";
import type { LikelyAward, LikelyModel, Seat } from "./model";
import { Question, awardText, k, questionText, useFocusOnMount } from "./parts";

/** Haptic when this phone topped a card (GAME-LIKELY §12.5). */
export const HAPTIC_TOPPED = [30, 60, 30] as const;

const vote = (cardId: string, targetId: string): boolean => act({ type: "GAME", gameId: "likely", i: { type: "VOTE", cardId, targetId } });

function counter(m: LikelyModel): string {
  return t(k("card.counter"), { index: Math.min(m.pub.cardIndex + 1, m.pub.cardCount), count: m.pub.cardCount });
}

function Eyebrow({ m, tone }: { m: LikelyModel; tone?: "neutral" }) {
  return (
    <div class="eyebrow-row lk-eyebrow">
      <p class="eyebrow"><span class="lk-eyebrow__title">{t(k("title"))}</span> <span class="tnum lk-eyebrow__count">{counter(m)}</span></p>
      <TimerBar deadline={deadlineOf(m)} class="timerbar--inline" tone={tone} />
    </div>
  );
}

/** The card as the phone shows it (accessibility copy of the TV card: same words, small). */
function PhCardFace({ m, flip = false }: { m: LikelyModel; flip?: boolean }) {
  const c = m.pub.card;
  if (!c) return null;
  return (
    <div class={`lk-phcard${flip ? " is-flip" : ""}`} key={c.id}>
      <Question prompt={c.prompt} class="lk-phcard__q" />
      <p class="lk-phcard__award"><Rosette size={20} />{c.award}</p>
      {c.rerun && <span class="lk-tag">{t(k("card.rerun"))}</span>}
    </div>
  );
}

function WaitingNext({ m }: { m: LikelyModel }) {
  const h = useFocusOnMount<HTMLHeadingElement>();
  return (
    <main class="screen lk-ph lk-ph--wait">
      <Eyebrow m={m} tone="neutral" />
      <PhCardFace m={m} />
      <div class="lk-waitnext">
        {m.myId && m.byId.get(m.myId) && <Character color={m.byId.get(m.myId)!.color} size={96} expression="happy" />}
        <h1 class="h1" ref={h} tabIndex={-1}>{t(k("vote.waitingNext"))}</h1>
        <p class="hint hint--center"><Icon name="tv" size={18} />{t(k("card.readTv"))}</p>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------- LK-PH-01 CARD (votes not open yet)

function PhCard({ m }: { m: LikelyModel }) {
  const h = useFocusOnMount<HTMLParagraphElement>();
  return (
    <main class="screen lk-ph lk-ph--card">
      <Eyebrow m={m} tone="neutral" />
      <p class="lk-readtv" ref={h} tabIndex={-1}><Icon name="tv" size={22} />{t(k("card.readTv"))}</p>
      <PhCardFace m={m} flip />
      <p class="lk-soon"><span class="lk-soon__dot" />{t(k("card.getReady"))}</p>
    </main>
  );
}

// ---------------------------------------------------------------- LK-PH-02 VOTING

function PhVote({ m }: { m: LikelyModel }) {
  const card = m.pub.card!;
  const mine = m.me?.myVote ?? null;
  // Optimistic: the tapped tile is marked at once; the server's `me.myVote` takes over on the next view.
  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => { setPending(null); }, [mine]);
  const picked = pending ?? mine;
  const targets = targetsOf(m);
  const voters = activeSeats(m).filter((s) => s.connected || m.pub.votedIds.includes(s.id)).length;
  const named = card.namedPlayerId ? m.byId.get(card.namedPlayerId) ?? null : null;
  const h = useFocusOnMount<HTMLHeadingElement>();
  return (
    <main class="screen lk-ph lk-ph--vote">
      <Eyebrow m={m} />
      <h1 class="lk-vote__q" ref={h} tabIndex={-1} aria-label={questionText(card.prompt)}><Question prompt={card.prompt} /></h1>
      {named && <p class="banner banner--accent lk-named">{t(k("vote.named"), { name: isolate(named.name) })}</p>}
      <p class={`lk-voteline${picked ? " is-in" : ""}`} aria-live="polite">
        {picked ? <><Icon name="check" size={18} />{t(k("vote.locked"))}</> : t(k("vote.title"))}
      </p>
      <div class={`lk-grid lk-grid--${targets.length > 9 ? "4" : "3"}`} role="radiogroup" aria-label={t(k("vote.title"))}>
        {targets.map((s, i) => {
          const self = s.id === m.myId;
          const on = picked === s.id;
          return (
            <button key={s.id} type="button" role="radio" aria-checked={on} style={{ "--i": i }}
              class={`lk-tile${self ? " is-me" : ""}${on ? " is-picked" : ""}${s.connected ? "" : " is-away"}`}
              onClick={() => {
                if (on) return;
                if (vote(card.id, s.id)) { setPending(s.id); haptic(HAPTIC.voteLocked); }
              }}>
              <Character color={s.color} size={56} expression={s.connected ? "idle" : "away"} />
              <bdi class="lk-tile__name">{self ? t(k("vote.me")) : s.name}</bdi>
              <span class="lk-tile__check" aria-hidden="true">{on && <Icon name="check" size={14} />}</span>
            </button>
          );
        })}
      </div>
      <p class="lk-progress tnum">{t(k("vote.progress"), { count: m.pub.votedIds.length, total: voters })}</p>
    </main>
  );
}

// ---------------------------------------------------------------- LK-PH-03 REVEAL

/** Coins flying from the outcome line into the score pill (CHOREO.points: 450 ms flights, then the counter tick). */
function CoinsIntoScore({ points, from, to, color }: { points: number; from: number; to: number; color: Seat["color"] }) {
  const root = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(reduced() ? to : from);
  const n = Math.min(8, Math.max(1, Math.round(points / 50)));
  useLayoutEffect(() => {
    const el = root.current;
    if (!el || points <= 0) { setShown(to); return; }
    const src = el.querySelector<HTMLElement>(".lk-coins__from"), dst = el.querySelector<HTMLElement>(".lk-score");
    if (src && dst) {
      const a = src.getBoundingClientRect(), b = dst.getBoundingClientRect();
      el.style.setProperty("--dx", `${b.left + b.width / 2 - (a.left + a.width / 2)}px`);
      el.style.setProperty("--dy", `${b.top + b.height / 2 - (a.top + a.height / 2)}px`);
    }
    const steps = variant(CHOREO.points, { reduced: reduced() });
    const r = run(steps, (p) => {
      el.querySelectorAll<HTMLElement>(".lk-coin").forEach((c, i) => { const v = p("coin", i); c.style.setProperty("--p", String(v)); c.style.opacity = v > 0 && v < 1 ? "1" : "0"; });
      el.style.setProperty("--pop", String(p("badgePop")));
      setShown(Math.round(from + (to - from) * p("counter")));
    }, () => setShown(to), n);
    return () => r.cancel();
  }, [points, from, to]);
  return (
    <div class="lk-coins" ref={root} style={{ "--coin": COLOR_BY_ID[color].hex }}>
      <span class="lk-coins__from" aria-hidden="true">
        {!reduced() && Array.from({ length: n }, (_, i) => <span key={i} class="lk-coin" style={{ "--i": i }} />)}
      </span>
      <span class="lk-score"><Icon name="star" size={18} /><span class="tnum">{fmtNum(shown)}</span></span>
    </div>
  );
}

function PhReveal({ m }: { m: LikelyModel }) {
  const r = m.pub.reveal!;
  const mine = myReveal(m)!;
  const meSeat = m.myId ? m.byId.get(m.myId) ?? null : null;
  const votedFor = mine.votedFor ? m.byId.get(mine.votedFor) ?? null : null;
  const h = useFocusOnMount<HTMLHeadingElement>();
  const award = m.pub.card?.award ?? "";
  let title: string;
  let expr: "shy" | "smug" | "shock" | "laugh" | "idle" | "happy";
  if (r.chaos) { title = t(k("reveal.chaos")); expr = "laugh"; }
  else if (r.none) { title = t(k("reveal.none")); expr = "shy"; }
  else if (mine.top) { title = r.topIds.length > 1 ? t(k("reveal.tie")) : t(k("reveal.youTop")); expr = mine.votedFor === m.myId ? "smug" : r.unanimous ? "shock" : "shy"; }
  else if (mine.got > 0) { title = t(k("reveal.youGot"), { count: mine.got }); expr = "shy"; }
  else { title = r.unanimous ? t(k("reveal.unanimous")) : votedFor ? t(k("reveal.votedFor"), { name: isolate(votedFor.name) }) : t(k("reveal.noVote")); expr = mine.total > 0 ? "happy" : "idle"; }
  const pub = m.pub.showVoters;
  return (
    <main class={`screen lk-ph lk-ph--reveal${mine.top ? " is-top" : ""}`}>
      <Eyebrow m={m} tone="neutral" />
      <div class="lk-hero">
        {mine.top && !r.chaos && <Rosette size={88} class="lk-hero__rosette" />}
        {meSeat && <Character color={meSeat.color} size={96} expression={expr} class={mine.top ? "lk-hero__ch is-pulse" : "lk-hero__ch"} />}
        <h1 class="h1 lk-hero__title" ref={h} tabIndex={-1}>{title}</h1>
        {mine.top && !r.chaos && <p class="lk-hero__award">{award}</p>}
        {mine.got > 0 && !r.chaos && (mine.top || !pub) && (
          <p class="sub lk-hero__sub">{pub ? t(k("reveal.youGot"), { count: mine.got }) : t(k("reveal.percentYou"), { percent: fmtPercent(mine.percent, locale.value) })}</p>
        )}
      </div>
      {pub && !r.none && (
        <div class="lk-outcome">
          {mine.unanimousPoints > 0 ? <p class="lk-outcome__line is-gold"><Icon name="lk-sparkle" size={20} />{t(k("reveal.unanimousPts"))}</p>
            : mine.agreed > 0 && mine.agreePoints > 0 ? <p class="lk-outcome__line is-gold"><Icon name="lk-users" size={20} />{t(k("reveal.withGroup"), { count: mine.agreed, points: mine.agreePoints })}</p>
            : mine.votedFor && !r.chaos ? <p class="lk-outcome__line">{t(k("reveal.noAgree"))}</p> : null}
          {mine.selfAwarePoints > 0 && <p class="lk-outcome__line is-gold"><Icon name="star" size={20} />{t(k("reveal.selfAware"))}</p>}
          {meSeat && <CoinsIntoScore points={mine.total} from={mine.scoreBefore} to={mine.score} color={meSeat.color} />}
        </div>
      )}
      {(mine.top || mine.got === 0 || r.chaos) && (
        <p class="hint hint--center lk-myvote">
          {mine.votedFor === null ? t(k("reveal.noVote")) : mine.votedFor === m.myId ? t(k("reveal.votedSelf")) : votedFor ? t(k("reveal.votedFor"), { name: isolate(votedFor.name) }) : null}
        </p>
      )}
    </main>
  );
}

// ---------------------------------------------------------------- HOLD

function PhHold({ m }: { m: LikelyModel }) {
  const h = useFocusOnMount<HTMLHeadingElement>();
  const n = activeSeats(m).filter((s) => s.connected).length;
  return (
    <main class="screen lk-ph lk-ph--hold">
      <div class="lk-hold">
        <div class="lk-hold__row">{activeSeats(m).map((s) => <Character key={s.id} color={s.color} size={48} expression={s.connected ? "think" : "away"} />)}</div>
        <h1 class="h1" ref={h} tabIndex={-1}>{t(k("hold.waiting"), { count: n })}</h1>
        <p class="sub">{t(k("coach.hold"))}</p>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------- LK-PH-04 AWARDS / LK-PH-05 RESULTS

function AwardCard({ a, seat, big }: { a: LikelyAward; seat: Seat | null; big: boolean }) {
  const { title, line } = awardText(a);
  return (
    <section class={`lk-award lk-award--${a.kind}${big ? " is-big" : ""}`}>
      <span class="lk-award__foil" aria-hidden="true" />
      <div class="lk-award__art">
        {a.kind === "mystery" ? <MysteryPuff size={big ? 96 : 56} /> : a.kind === "mindReader" ? <CrystalBall size={big ? 80 : 48} /> : <Rosette size={big ? 84 : 44} />}
        {big && seat && <Character color={seat.color} size={88} expression={a.kind === "mystery" ? "smug" : "cheer"} class="lk-award__ch" />}
      </div>
      <h2 class="lk-award__title">{title}</h2>
      {line && <p class="lk-award__line">{line}</p>}
    </section>
  );
}

function PhAwards({ m, results }: { m: LikelyModel; results: boolean }) {
  const h = useFocusOnMount<HTMLParagraphElement>();
  const id = m.myId;
  const seat = id ? m.byId.get(id) ?? null : null;
  const mine = id ? awardsOf(m.pub, id) : [];
  const [main, ...extras] = mine;
  return (
    <main class={`screen lk-ph lk-ph--awards${results ? " is-results" : ""}`}>
      <p class="eyebrow lk-awards__eyebrow" ref={h} tabIndex={-1}>{results ? t(k("results.title")) : t(k("awards.yours"))}</p>
      {main ? <AwardCard a={main} seat={seat} big={!results} /> : <p class="sub">{t(k("awards.title"))}</p>}
      {extras.map((a) => <AwardCard key={a.kind} a={a} seat={seat} big={false} />)}
      {results && m.pub.showVoters && seat && (
        <p class="lk-final"><Icon name="star" size={20} /><span class="tnum">{fmtNum(seat.score)}</span></p>
      )}
    </main>
  );
}

// ---------------------------------------------------------------- module

export function Phone({ view }: { view: PlayerRoomView }) {
  const m = likelyModel(view);
  if (!m) return null;
  const p = m.pub;
  const waiting = !!m.me?.waitingForNext;
  switch (p.phase) {
    case "CARD": return waiting ? <WaitingNext m={m} /> : <PhCard m={m} />;
    case "VOTING": return waiting || !canVote(m) ? <WaitingNext m={m} /> : <PhVote m={m} />;
    case "REVEAL": return waiting ? <WaitingNext m={m} /> : <PhReveal m={m} />;
    case "HOLD": return <PhHold m={m} />;
    case "AWARDS": return <PhAwards m={m} results={false} />;
    case "RESULTS": return <PhAwards m={m} results />;
    default: return null;
  }
}

export function screenKey(view: PlayerRoomView): string {
  const m = likelyModel(view);
  if (!m) return "none";
  return `${m.n}:${m.pub.phase}:${m.pub.cardIndex}:${m.pub.card?.id ?? ""}:${m.me?.waitingForNext ? "w" : ""}`;
}

export function onPhoneView(prevRoom: PlayerRoomView | null, nextRoom: PlayerRoomView): void {
  const next = likelyModel(nextRoom);
  if (!next) return;
  const prev = prevRoom ? likelyModel(prevRoom) : null;
  if (prev && prev.pub.phase === next.pub.phase) return;
  const id = next.myId;
  if (next.pub.phase === "VOTING" && canVote(next)) {
    haptic(HAPTIC.nextUp);
    if (next.pub.card) announce(questionText(next.pub.card.prompt), true);
  }
  if (next.pub.phase === "REVEAL" && id && next.pub.reveal?.topIds.includes(id) && !next.pub.reveal.chaos) haptic(HAPTIC_TOPPED);
}

export function needsMe(view: PlayerRoomView): boolean {
  const m = likelyModel(view);
  return !!m && needsVote(m);
}

export function firstRound(view: PlayerRoomView): boolean {
  const m = likelyModel(view);
  return !m || m.pub.cardIndex === 0;
}
