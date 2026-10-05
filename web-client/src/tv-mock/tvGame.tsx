// TV-04 role reveal wait, TV-05 clues (+ TV-08 tie overlay), TV-06 voting.
import { Fragment } from "preact";
import type { RefObject } from "preact";
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { useDeadlineSelect } from "../components/Timer";
import type { PublicPlayer, TvView } from "@mishana/shared/protocol";
import { dirOf, fmtNum, isolate, locale, t } from "../i18n/t";
import { revoteLine, tieLine } from "../lib/gameText";
import { Avatar, avatarState } from "../components/PlayerChip";
import { Icon } from "../components/Icon";
import { reduced } from "../lib/motion";
import { byId, orderWindow, playersOf, tiedWithTally } from "../lib/view";
import { ActionPill, Stamp, Tile, TimerChip, TimerRing, TvTimerBar, TvTopBar, VOTE_NAME_MAX } from "./tvParts";
import { useInitialFocus } from "./dpad";

/** TV-04 avatar row: 104 dp tiles (titleS names, 1 line) with a 24 dp gap in a 760 dp row → 6 per row. */
const REVEAL_PER_ROW = 6;

/**
 * TV-04 sizing (Kotlin needed() fallback): the phone icon and the avatars shrink — icon 84 → 56 → none, avatars
 * 64 → 44 — until the whole stack fits the 360 dp stage, so the avatar rows never reach the bottom bar.
 */
export function revealSizes(players: number, blankHint: boolean, rtl: boolean): { icon: number; avatar: number; hint: boolean } {
  const STAGE = 360, GAP = 12, ROW_GAP = 10;
  const title = rtl ? 96 : 80, body = rtl ? 34 : 28, name = rtl ? 34 : 28;
  const rows = Math.max(1, Math.ceil(players / REVEAL_PER_ROW));
  for (const [icon, avatar] of [[84, 64], [56, 64], [56, 44], [0, 44]] as const) {
    const blocks = (icon ? 1 : 0) + 2 + (blankHint ? 1 : 0) + 1;
    const needed = icon + title + body + (blankHint ? body : 0) + rows * (avatar + 6 + name) + (rows - 1) * ROW_GAP + (blocks - 1) * GAP;
    if (needed <= STAGE) return { icon, avatar, hint: blankHint };
  }
  return { icon: 0, avatar: 44, hint: false }; // 12 players in Arabic: the muted Blank hint goes last
}

/** TV-04 "Check your phones". */
export function TvRoleReveal({ view }: { view: TvView }) {
  const pill = useInitialFocus<HTMLButtonElement>();
  const active = view.players.filter((p) => !p.left);
  // "Ready" = pressed Got it (as on the phones and the Kotlin TV); an away player who was ready stays ready.
  const ready = active.filter((p) => p.ready).length;
  const blankHint = (view.roleCounts?.blank ?? 0) > 0;
  const size = revealSizes(active.length, blankHint, dirOf(locale.value) === "rtl");
  return (
    <div class="tvscreen">
      <TvTopBar view={view} />
      <div class="tvstage tvreveal">
        {size.icon > 0 && <span class="tvreveal__phone"><Icon name="phone" size={size.icon} /></span>}
        <h1 class="tvt-displayL tvreveal__title">{t("reveal.checkPhones")}</h1>
        <p class="tvt-body">{t("reveal.checkBody")}</p>
        {size.hint && <p class="tvt-body tv-muted">{t("reveal.blankHint")}</p>}
        <div class="tvrow">
          {active.map((p) => <Tile key={p.id} p={p} size={size.avatar} check={p.ready} class="tile--mini" />)}
        </div>
      </div>
      <div class="tvbottom">
        <span class="tvbottom__center tnum">{t("reveal.readyCount", { ready, total: active.length })}</span>
        <TimerChip deadline={view.deadline} />
        <ActionPill label={t("tv.startNow")} pillRef={pill} />
      </div>
    </div>
  );
}

/** TV-08 overlay length: long enough to read the explanation from the couch (OK skips it). */
export const TIE_OVERLAY_MS = 4000;

/** TV-08: an overlay on top of TV-05 at the start of TIE_BREAK (OK skips it). */
function TieOverlay({ view, onDone }: { view: TvView; onDone(): void }) {
  useEffect(() => {
    const id = setTimeout(onDone, reduced() ? TIE_OVERLAY_MS / 2 : TIE_OVERLAY_MS);
    return () => clearTimeout(id);
  }, []);
  return (
    <div class="tvtie" onClick={onDone}>
      <Stamp text={t("tie.title")} tone="accent" />
      <div class="tvtie__cards">
        {tiedWithTally(view).map(({ player: p, votes }, i) => (
          <Fragment key={p.id}>
            {i > 0 && <span class="tvtie__vs">{t("tie.vs")}</span>}
            <div class="tvtie__card">
              <span class="tvtie__av">
                <Avatar color={p.color} size={96} state={avatarState(p)} />
                <span class="tvtally num">{fmtNum(votes)}</span>
              </span>
              <bdi class="tvt-title">{p.name}</bdi>
            </div>
          </Fragment>
        ))}
      </div>
      <p class="tvt-body tvtie__explain">{t("tie.explain")}</p>
    </div>
  );
}

/** The strip's width in dp (layout px inside the scaled canvas), tracked so the window follows the action bar. */
function useWidth<T extends HTMLElement>(): [RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/**
 * TV-05 speaking order (Kotlin OrderStrip): 104 dp items (48 dp avatar, the name truncated once by a CSS ellipsis at
 * the 96 dp text width, then the current-speaker underline, all inside the safe area). When the bar is too
 * narrow the chevrons go first, then a window keeps the current speaker in view with "+n" on either side; the strip
 * never widens the bottom bar.
 */
function OrderStrip({ order, currentId }: { order: PublicPlayer[]; currentId: string | null }) {
  const [ref, width] = useWidth<HTMLOListElement>();
  const cur = Math.max(0, order.findIndex((p) => p.id === currentId));
  const win = orderWindow(order.length, cur, width || Infinity);
  const after = order.length - win.end;
  return (
    <ol class="tvorder" ref={ref}>
      {win.start > 0 && <li class="tvorder__more tnum" dir="ltr" aria-hidden="true">+{fmtNum(win.start)}</li>}
      {order.slice(win.start, win.end).map((p, i) => {
        const isCur = p.id === currentId;
        return (
          <li key={p.id} class={`tvorder__item${isCur ? " is-current" : ""}${p.spoke && !isCur ? " is-done" : ""}`}>
            {i > 0 && win.chevrons && <Icon name="chevron-forward" size={16} class="tvorder__chev" />}
            <span class="tvorder__who">
              <Avatar color={p.color} size={48} state={avatarState(p)} check={p.spoke && !isCur} />
              <bdi class="tvorder__name">{p.name}</bdi>
            </span>
          </li>
        );
      })}
      {after > 0 && <li class="tvorder__more tnum" dir="ltr" aria-hidden="true">+{fmtNum(after)}</li>}
    </ol>
  );
}

/** TV-05 Clues / TIE_BREAK. */
export function TvClues({ view }: { view: TvView }) {
  const pill = useInitialFocus<HTMLButtonElement>();
  const tie = view.phase === "TIE_BREAK";
  const [overlay, setOverlay] = useState(tie && view.round === (view.lastVote?.round ?? -1) && view.lastVote?.outcome === "TIE");
  const speaker = byId(view, view.currentSpeakerId);
  const order = playersOf(view, view.speakingOrder);
  const idx = view.currentSpeakerId ? view.speakingOrder.indexOf(view.currentSpeakerId) : -1;
  const next = byId(view, view.speakingOrder[idx + 1]);
  const firstTurn = view.round === 1 && idx === 0 && !tie;
  // Arabic's taller lines (name 72, body 34) and taller strip leave less stage: the hero steps down like Kotlin's.
  const rtl = dirOf(locale.value) === "rtl";
  const ring = rtl ? 156 : 172, av = rtl ? 112 : 124;
  return (
    <div class="tvscreen tvclues">
      <TvTopBar view={view} />
      <div class="tvspot" aria-hidden="true" />
      {/* During a tie-break the rule line says who tied and what happens next (the top bar already says TIE-BREAK). */}
      <div class="tvclues__rule">
        {tie
          ? <span class="tvt-caption tv-secondary">{tieLine(view)}</span>
          : <span class="tvt-caption tv-muted">{t("clues.rule")}</span>}
        {firstTurn && <span class="tvt-caption tv-secondary">{t("clues.firstHint")}</span>}
      </div>
      <div class="tvstage tvclues__stage">
        {speaker && (
          <div class="tvclues__hero" key={speaker.id}>
            {view.deadline ? (
              <TimerRing deadline={view.deadline} size={ring}>
                <Avatar color={speaker.color} size={av} state={avatarState(speaker)} speaking={speaker.connected} />
              </TimerRing>
            ) : (
              <div class="ring" style={{ width: `${ring}px`, height: `${ring}px` }}><div class="ring__content"><Avatar color={speaker.color} size={av} state={avatarState(speaker)} speaking /></div></div>
            )}
            <h1 class="tvt-displayM tvclues__name">{t("clues.speaking", { name: isolate(speaker.name) })}</h1>
            <p class="tvt-body tv-secondary">{view.deadline ? t("tv.cluesSub") : t("tv.cluesNoTimer")}
              {next && <span class="tv-muted"> · {t("clues.upNext", { name: isolate(next.name) })}</span>}</p>
          </div>
        )}
      </div>
      <div class="tvbottom tvbottom--strip">
        <OrderStrip order={order} currentId={view.currentSpeakerId} />
        <ActionPill label={t("clues.skipTurn")} pillRef={pill} animating={overlay} onSkipAnimation={() => setOverlay(false)} />
      </div>
      {overlay && <TieOverlay view={view} onDone={() => setOverlay(false)} />}
    </div>
  );
}

/** TV-06 Voting. */
export function TvVoting({ view }: { view: TvView }) {
  const pill = useInitialFocus<HTMLButtonElement>();
  const cands = view.players.filter((p) => p.alive && !p.left && (!view.revote || view.tieCandidates.includes(p.id)));
  const big = cands.length > 8;
  const [pulse, setPulse] = useState(0);
  // Re-renders when the last-10-seconds state flips, not on every tick (the bar ticks on its own).
  const lastTen = useDeadlineSelect(view.deadline, (c) => c.secs <= 10 && c.secs > 0, false);
  useEffect(() => { setPulse((x) => x + 1); }, [view.votesCast]);
  // With every phone asleep the server expects 0 votes: "0/0 voted" looks broken, so count the alive voters.
  const expected = view.votesExpected > 0 ? view.votesExpected : view.players.filter((p) => p.alive && !p.left).length;
  return (
    <div class="tvscreen">
      <TvTopBar view={view} />
      <div class="tvstage tvvote">
        <h1 class="tvt-displayS tvvote__title">{t("vote.title")} <span class="tv-secondary tvt-headline">{t("vote.sub")}</span></h1>
        {view.revote && <span class="tvbadge tvbadge--accent tvbadge--sentence">{revoteLine(view)}</span>}
        <div class={`tvvgrid${big ? " tvvgrid--12" : ""}`}>
          {cands.map((p) => <Tile key={p.id} p={p} size={big ? 48 : 64} check={p.hasVoted} nameMax={VOTE_NAME_MAX} class={big ? "tile--vote tile--vote-s" : "tile--vote"} />)}
        </div>
      </div>
      <div class="tvbottom tvbottom--vote">
        <div class="tvvote__timer"><TvTimerBar deadline={view.deadline} /></div>
        <span class="tvvote__progress tnum" key={pulse}>{lastTen ? <span class="tv-danger">{t("vote.tenLeft")}</span> : t("vote.progress", { cast: view.votesCast, expected })}</span>
        <ActionPill label={t("vote.close")} pillRef={pill} />
      </div>
    </div>
  );
}
