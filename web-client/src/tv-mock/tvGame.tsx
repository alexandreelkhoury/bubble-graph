// TV-04 role reveal wait, TV-05 clues (+ TV-08 tie overlay), TV-06 voting.
import { Fragment } from "preact";
import { useEffect, useState } from "preact/hooks";
import { useDeadline } from "../components/Timer";
import type { PublicPlayer, TvView } from "@mishana/shared/protocol";
import { fmtNum, t } from "../i18n/t";
import { Avatar, avatarState } from "../components/PlayerChip";
import { Icon } from "../components/Icon";
import { ActionPill, Stamp, Tile, TimerChip, TimerRing, TvTimerBar, TvTopBar, useInitialFocus } from "./tvParts";
import { reduced } from "./motion";

export function byIdTv(view: TvView, id: string | null | undefined): PublicPlayer | undefined {
  return id ? view.players.find((p) => p.id === id) : undefined;
}

/** TV-04 "Check your phones". */
export function TvRoleReveal({ view }: { view: TvView }) {
  const pill = useInitialFocus<HTMLButtonElement>();
  const active = view.players.filter((p) => !p.left);
  const ready = active.filter((p) => p.ready && p.connected).length;
  return (
    <div class="tvscreen">
      <TvTopBar view={view} />
      <div class="tvstage tvreveal">
        <span class="tvreveal__phone"><Icon name="phone" size={96} /></span>
        <h1 class="tvt-displayL tvreveal__title">{t("reveal.checkPhones")}</h1>
        <p class="tvt-body">{t("reveal.checkBody")}</p>
        {(view.roleCounts?.blank ?? 0) > 0 && <p class="tvt-body tv-muted">{t("reveal.blankHint")}</p>}
        <div class={`tvrow${active.length > 7 ? " tvrow--two" : ""}`}>
          {active.map((p) => <Tile key={p.id} p={p} size={64} check={p.ready && p.connected} class="tile--mini" />)}
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

/** TV-08: a ≤ 2.5 s overlay on top of TV-05 at the start of TIE_BREAK (OK skips it). */
function TieOverlay({ view, onDone }: { view: TvView; onDone(): void }) {
  useEffect(() => {
    const id = setTimeout(onDone, reduced() ? 1250 : 2500);
    return () => clearTimeout(id);
  }, []);
  const tied = view.tieCandidates.map((id) => byIdTv(view, id)).filter((p): p is PublicPlayer => !!p);
  const tally = (id: string): number => view.lastVote?.tally.find((x) => x.targetId === id)?.voterIds.length ?? 0;
  return (
    <div class="tvtie" onClick={onDone}>
      <Stamp text={t("tie.title")} tone="accent" />
      <div class="tvtie__cards">
        {tied.map((p, i) => (
          <Fragment key={p.id}>
            {i > 0 && <span class="tvtie__vs">VS</span>}
            <div class="tvtie__card">
              <span class="tvtie__av">
                <Avatar color={p.color} size={120} state={avatarState(p)} />
                <span class="tvtally num">{fmtNum(tally(p.id))}</span>
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

/** TV-05 Clues / TIE_BREAK. */
export function TvClues({ view }: { view: TvView }) {
  const pill = useInitialFocus<HTMLButtonElement>();
  const tie = view.phase === "TIE_BREAK";
  const [overlay, setOverlay] = useState(tie && view.round === (view.lastVote?.round ?? -1) && view.lastVote?.outcome === "TIE");
  const speaker = byIdTv(view, view.currentSpeakerId);
  const order = view.speakingOrder.map((id) => byIdTv(view, id)).filter((p): p is PublicPlayer => !!p);
  const idx = view.currentSpeakerId ? view.speakingOrder.indexOf(view.currentSpeakerId) : -1;
  const next = byIdTv(view, view.speakingOrder[idx + 1]);
  const firstTurn = view.round === 1 && idx === 0 && !tie;
  return (
    <div class="tvscreen tvclues">
      <TvTopBar view={view} />
      <div class="tvspot" aria-hidden="true" />
      <div class="tvclues__rule">
        <span class="tvt-caption tv-muted">{t("clues.rule")}</span>
        {firstTurn && <span class="tvt-caption tv-secondary">{t("clues.firstHint")}</span>}
        {tie && <span class="tvbadge tvbadge--accent">{t("phase.tieBreak")}</span>}
      </div>
      <div class="tvstage tvclues__stage">
        {speaker && (
          <div class="tvclues__hero" key={speaker.id}>
            {view.deadline ? (
              <TimerRing deadline={view.deadline} size={184}>
                <Avatar color={speaker.color} size={136} state={avatarState(speaker)} speaking={speaker.connected} />
              </TimerRing>
            ) : (
              <div class="ring" style={{ width: "184px", height: "184px" }}><div class="ring__content"><Avatar color={speaker.color} size={136} state={avatarState(speaker)} speaking /></div></div>
            )}
            <h1 class="tvt-displayM tvclues__name"><bdi>{t("clues.speaking", { name: "⁨" + speaker.name + "⁩" })}</bdi></h1>
            <p class="tvt-body tv-secondary">{view.deadline ? t("clues.speakerSub") : t("clues.noTimer")}
              {next && <span class="tv-muted"> · {t("clues.upNext", { name: "\u2068" + next.name + "\u2069" })}</span>}</p>
          </div>
        )}
      </div>
      <div class="tvbottom tvbottom--strip">
        <ol class="tvorder">
          {order.map((p, i) => {
            const cur = p.id === view.currentSpeakerId;
            return (
              <li key={p.id} class={`tvorder__item${cur ? " is-current" : ""}${p.spoke && !cur ? " is-done" : ""}`}>
                {i > 0 && <Icon name="chevron-forward" size={18} class="tvorder__chev" />}
                <span class="tvorder__who">
                  <Avatar color={p.color} size={48} state={avatarState(p)} check={p.spoke && !cur} />
                  <bdi class="tvorder__name">{p.name}</bdi>
                </span>
              </li>
            );
          })}
        </ol>
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
  const d = useDeadline(view.deadline);
  useEffect(() => { setPulse((x) => x + 1); }, [view.votesCast]);
  return (
    <div class="tvscreen">
      <TvTopBar view={view} />
      <div class="tvstage tvvote">
        <h1 class="tvt-displayS tvvote__title">{t("vote.title")} <span class="tv-secondary tvt-headline">{t("vote.sub")}</span></h1>
        {view.revote && <span class="tvbadge tvbadge--accent">{t("vote.revoteAmong")}</span>}
        <div class={`tvvgrid${big ? " tvvgrid--12" : ""}`}>
          {cands.map((p) => <Tile key={p.id} p={p} size={big ? 56 : 64} check={p.hasVoted} class={big ? "tile--vote tile--vote-s" : "tile--vote"} />)}
        </div>
      </div>
      <div class="tvbottom tvbottom--vote">
        <div class="tvvote__timer"><TvTimerBar deadline={view.deadline} /></div>
        <span class="tvvote__progress tnum" key={pulse}>{d && d.secs <= 10 && d.secs > 0 ? <span class="tv-danger">{t("vote.tenLeft")}</span> : t("vote.progress", { cast: view.votesCast, expected: view.votesExpected })}</span>
        <ActionPill label={t("vote.close")} pillRef={pill} />
      </div>
    </div>
  );
}
