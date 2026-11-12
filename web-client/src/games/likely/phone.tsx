// GAME-LIKELY §8 phone screens (LK-PH-01..05), lazy-loaded as the `game-likely` chunk. The platform shell adds the top
// bar, ⓘ, coach marks, the world flood, the benched view and the results cup + VIP buttons.
// Secrecy (§8.1): this phone shows only the public projection plus its own `me` (its own vote); the vote grid never
// recolours a picked tile (a subtle outline + small check), so a neighbour cannot read the pick over a shoulder.
import "./phone.css";
import { useEffect, useState } from "preact/hooks";
import type { PlayerRoomView } from "@jamaa/shared/protocol/v2";
import { isolate, listOf, locale, t } from "../../i18n/t";
import { act } from "../../state/session";
import { announce } from "../../state/store";
import { HAPTIC, haptic } from "../../lib/haptics";
import { Character } from "../../components/Character";
import { Icon } from "../../components/Icon";
import { TimerBar } from "../../components/Timer";
import { MysteryPuff, Rosette } from "./art";
import {
  activeSeats, canVote, deadlineOf, fmtPercent, likelyModel, myReveal, needsVote, phoneAwards, targetsOf, winners,
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
      <p class="eyebrow"><span class="lk-eyebrow__title">{t(k("title"))}</span> <span class="tnum lk-eyebrow__count" dir="ltr">{counter(m)}</span></p>
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
  // A tap the server never confirms (rejected, or lost on a flaky link) must not keep looking counted.
  useEffect(() => {
    if (pending === null) return;
    const id = setTimeout(() => setPending(null), 3000);
    return () => clearTimeout(id);
  }, [pending]);
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
              <span class="lk-tile__check" aria-hidden="true">{on && <Icon name="check" size={12} />}</span>
            </button>
          );
        })}
      </div>
      <p class="lk-progress tnum">{t(k("vote.progress"), { count: m.pub.votedIds.length, total: voters })}</p>
    </main>
  );
}

// ---------------------------------------------------------------- LK-PH-03 REVEAL

/** Who took this card's award (public data: `topIds`), for a phone that did not: rosette, award name, the winner(s). */
function WinnerChip({ m }: { m: LikelyModel }) {
  const r = m.pub.reveal!;
  const top = winners(m);
  return (
    <div class="lk-winner">
      <Rosette size={34} class="lk-winner__rosette" />
      <div class="lk-winner__text">
        <p class="lk-winner__award">{m.pub.card?.award ?? ""}</p>
        <p class="lk-winner__who">{top.map((s) => (
          <span key={s.id} class="lk-winner__seat"><Character color={s.color} size={40} expression={r.unanimous ? "shock" : "shy"} /><bdi>{s.name}</bdi></span>
        ))}</p>
      </div>
    </div>
  );
}

/** A row of small characters with their names: who voted for this phone, or who made the same pick. */
function Faces({ seats }: { seats: Seat[] }) {
  return (
    <span class="lk-faces" aria-hidden="true">
      {seats.map((s) => <Character key={s.id} color={s.color} size={28} expression="point" />)}
    </span>
  );
}

function PhReveal({ m }: { m: LikelyModel }) {
  const r = m.pub.reveal!;
  const mine = myReveal(m)!;
  const meSeat = m.myId ? m.byId.get(m.myId) ?? null : null;
  const votedFor = mine.votedFor ? m.byId.get(mine.votedFor) ?? null : null;
  const h = useFocusOnMount<HTMLHeadingElement>();
  const award = m.pub.card?.award ?? "";
  const pub = m.pub.showVoters;
  let title: string;
  let expr: "shy" | "smug" | "shock" | "laugh" | "idle" | "happy";
  if (r.chaos) { title = t(k("reveal.chaos")); expr = "laugh"; }
  else if (r.none) { title = t(k("reveal.none")); expr = "shy"; }
  else if (mine.top) { title = r.topIds.length > 1 ? t(k("reveal.tie")) : t(k("reveal.youTop")); expr = mine.votedFor === m.myId ? "smug" : r.unanimous ? "shock" : "shy"; }
  else if (mine.got > 0) { title = t(k("reveal.youGot"), { count: mine.got }); expr = "shy"; }
  else { title = r.unanimous ? t(k("reveal.unanimous")) : votedFor ? t(k("reveal.votedFor"), { name: isolate(votedFor.name) }) : t(k("reveal.noVote")); expr = "idle"; }
  // The "you voted for…" line, unless the title already says it.
  const voteLineInTitle = !r.chaos && !r.none && !mine.top && mine.got === 0 && !r.unanimous;
  const names = (seats: Seat[]): string => listOf(seats.map((x) => isolate(x.name)));
  return (
    <main class={`screen lk-ph lk-ph--reveal${mine.top ? " is-top" : ""}`}>
      <Eyebrow m={m} tone="neutral" />
      <div class="lk-hero">
        {mine.top && !r.chaos && <Rosette size={88} class="lk-hero__rosette" />}
        {meSeat && <Character color={meSeat.color} size={96} expression={expr} class={mine.top ? "lk-hero__ch is-pulse" : "lk-hero__ch"} />}
        <h1 class="h1 lk-hero__title" ref={h} tabIndex={-1}>{title}</h1>
        {mine.top && !r.chaos && <p class="lk-hero__award">{award}</p>}
        {mine.got > 0 && !r.chaos && mine.top && pub && <p class="sub lk-hero__sub">{t(k("reveal.youGot"), { count: mine.got })}</p>}
        {mine.got > 0 && !r.chaos && !pub && <p class="sub lk-hero__sub">{t(k("reveal.percentYou"), { percent: fmtPercent(mine.percent, locale.value) })}</p>}
      </div>
      {!mine.top && winners(m).length > 0 && <WinnerChip m={m} />}
      {/* Public mode: who voted for whom, from this phone's side (GAME-LIKELY §8.2). No points in this game. */}
      {pub && !r.none && (
        <div class="lk-outcome">
          {mine.voters.length > 0
            ? <p class="lk-outcome__line is-gold"><Faces seats={mine.voters} />{t(k("reveal.votedForYou"), { count: mine.voters.length, names: names(mine.voters) })}</p>
            : mine.votedFor !== m.myId || mine.got === 0 ? <p class="lk-outcome__line">{t(k("reveal.nobodyForYou"))}</p> : null}
          {mine.samePick.length > 0 && !r.chaos && <p class="lk-outcome__line"><Faces seats={mine.samePick} />{t(k("reveal.samePick"), { names: names(mine.samePick) })}</p>}
        </div>
      )}
      {!voteLineInTitle && (
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
        {a.kind === "mystery" ? <MysteryPuff size={big ? 96 : 56} /> : <Rosette size={big ? 84 : 44} />}
        {big && seat && <Character color={seat.color} size={88} expression={a.kind === "mystery" ? "smug" : "cheer"} class="lk-award__ch" />}
      </div>
      <div class="lk-award__text">
        <h2 class="lk-award__title">{title}</h2>
        {line && <p class="lk-award__line">{line}</p>}
      </div>
    </section>
  );
}

function PhAwards({ m, results }: { m: LikelyModel; results: boolean }) {
  const h = useFocusOnMount<HTMLParagraphElement>();
  const id = m.myId;
  const seat = id ? m.byId.get(id) ?? null : null;
  const mine = id ? phoneAwards(m.pub, id) : [];
  const [main, ...extras] = mine;
  return (
    <main class={`screen lk-ph lk-ph--awards${results ? " is-results" : ""}`}>
      <p class="eyebrow lk-awards__eyebrow" ref={h} tabIndex={-1}>{results ? t(k("results.title")) : t(k("awards.yours"))}</p>
      {main ? <AwardCard a={main} seat={seat} big={!results} /> : <p class="sub">{t(k("awards.title"))}</p>}
      {extras.map((a) => <AwardCard key={a.kind} a={a} seat={seat} big={false} />)}
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
