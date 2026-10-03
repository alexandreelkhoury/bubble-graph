// PH-05 (someone else's turn, incl. next up), PH-06 (your turn), PH-09 (tie-break), PH-10 (eliminated / spectator).
import { Fragment } from "preact";
import { useEffect, useState } from "preact/hooks";
import type { Me, PlayerView, PublicPlayer } from "@mishana/shared/protocol";
import { t } from "../i18n/t";
import { act, PHASE_KEY } from "../state/session";
import { Avatar, avatarState, colorVars, LIGHT_GLYPH } from "../components/PlayerChip";
import { PeekButton } from "../components/HoldToReveal";
import { RoleChip } from "../components/Role";
import { TimerBar } from "../components/Timer";
import { Heading, Slot } from "../components/UI";
import { Icon } from "../components/Icon";

export const DONE_GUARD_MS = 1500;

export function phaseLine(view: PlayerView): string {
  return view.round > 0 ? `${t("round.label", { count: view.round })} · ${t(PHASE_KEY[view.phase])}` : t(PHASE_KEY[view.phase]);
}

export function byId(view: PlayerView, id: string | null): PublicPlayer | undefined {
  return id === null ? undefined : view.players.find((p) => p.id === id);
}

export function OrderStrip({ view, myId }: { view: PlayerView; myId: string | null }) {
  const order = view.speakingOrder.map((id) => byId(view, id)).filter((p): p is PublicPlayer => !!p);
  return (
    <ol class="orderstrip" aria-label={t("clues.nowSpeaking")}>
      {order.map((p, i) => {
        const cur = p.id === view.currentSpeakerId;
        return (
          <li key={p.id} class={`orderstrip__item${cur ? " is-current" : ""}${p.spoke && !cur ? " is-done" : ""}${p.id === myId ? " is-you" : ""}`} aria-current={cur ? "step" : undefined}>
            {i > 0 && <Icon name="chevron-forward" size={14} class="orderstrip__chev" />}
            <span class="orderstrip__who">
              <Avatar color={p.color} size={36} state={avatarState(p)} check={p.spoke && !cur} speaking={cur} />
              <bdi class="orderstrip__name">{p.name}</bdi>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** PH-09 tie card: the tied players with their tallies. */
export function TieCard({ view, myId }: { view: PlayerView; myId: string | null }) {
  const tied = view.tieCandidates.map((id) => byId(view, id)).filter((p): p is PublicPlayer => !!p);
  const tally = (id: string): number => view.lastVote?.tally.find((x) => x.targetId === id)?.voterIds.length ?? 0;
  return (
    <section class="tiecard stamp-in" aria-label={t("tie.title")}>
      <p class="tiecard__stamp">{t("stamp.tie")}</p>
      <div class="tiecard__row">
        {tied.map((p, i) => (
          <Fragment key={p.id}>
            {i > 0 && <span class="tiecard__vs" aria-hidden="true">vs</span>}
            <span class="tiecard__p">
              <Avatar color={p.color} size={48} state={avatarState(p)} />
              <bdi>{p.name}</bdi>
              <span class="tiecard__n num">{tally(p.id)}</span>
            </span>
          </Fragment>
        ))}
      </div>
      <p class="tiecard__explain">{t("tie.explain")}</p>
      {myId && view.tieCandidates.includes(myId) && <p class="banner banner--primary">{t("tie.inTie")}</p>}
    </section>
  );
}

/** PH-10: you're out; follow along passively. */
export function OutPanel({ view, me }: { view: PlayerView; me: Me }) {
  const speaker = byId(view, view.currentSpeakerId);
  const role = me.role;
  return (
    <div class="outpanel">
      <span class="outpanel__icon"><Icon name="door-out" size={56} /></span>
      <h1 class="h1" tabIndex={-1}>{t("elim.you")}</h1>
      {role && <p class="outpanel__role"><Slot k="elim.youWere" slot="role"><RoleChip role={role} size={22} /></Slot></p>}
      <p class="sub">{t("elim.stay")}</p>
      <div class="outpanel__follow">
        <p class="eyebrow">{phaseLine(view)}</p>
        {speaker && (
          <p class="outpanel__speaker">
            <span class="muted">{t("clues.nowSpeaking")}</span>
            <Avatar color={speaker.color} size={28} state={avatarState(speaker)} speaking />
            <bdi>{speaker.name}</bdi>
          </p>
        )}
      </div>
    </div>
  );
}

function YourTurn({ view, me, color }: { view: PlayerView; me: Me; color: PublicPlayer["color"] }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setArmed(true), DONE_GUARD_MS);
    return () => clearTimeout(id);
  }, [view.deadline?.at]);
  const light = LIGHT_GLYPH(color);
  return (
    <main class={`screen screen--turn flood${light ? " flood--cream" : ""}`} style={colorVars(color)}>
      <div class="flood__inner">
        <p class="eyebrow">{phaseLine(view)}</p>
        <h1 class="display" tabIndex={-1}>{t("clues.yourTurn")}</h1>
        <p class="flood__body">{t("clues.yourTurnBody")}</p>
        {me.isBlank && <p class="flood__body flood__body--strong">{t("clues.blankBody")}</p>}
        {me.role && !me.isBlank && <RoleChip role={me.role} />}
        {view.deadline ? <TimerBar deadline={view.deadline} class="timerbar--on-color" /> : <p class="flood__body">{t("clues.noTimer")}</p>}
        <button type="button" class={`donebtn${armed ? " is-armed" : ""}`} aria-disabled={!armed}
          onClick={() => { if (armed) act({ type: "CLUE_DONE" }); }}>
          <span class="donebtn__fill" aria-hidden="true" />
          <span class="donebtn__label">{t("clues.done")}</span>
        </button>
        <PeekButton word={me.word} isBlank={me.isBlank} wordLocale={view.settings.wordLocale} onDark />
      </div>
    </main>
  );
}

export function Clues({ view, me }: { view: PlayerView; me: Me }) {
  const meP = byId(view, me.id);
  if (meP && !meP.alive) {
    return (
      <>
        <main class="screen screen--out"><OutPanel view={view} me={me} /></main>
        <footer class="actionbar"><PeekButton word={me.word} isBlank={me.isBlank} wordLocale={view.settings.wordLocale} /></footer>
      </>
    );
  }
  if (view.currentSpeakerId === me.id && meP) return <YourTurn view={view} me={me} color={meP.color} />;
  const speaker = byId(view, view.currentSpeakerId);
  const idx = view.currentSpeakerId ? view.speakingOrder.indexOf(view.currentSpeakerId) : -1;
  const nextUp = idx >= 0 && view.speakingOrder[idx + 1] === me.id;
  const tie = view.phase === "TIE_BREAK";
  return (
    <>
      <main class="screen screen--clues">
        <p class="eyebrow">{phaseLine(view)}</p>
        {tie && <TieCard view={view} myId={me.id} />}
        {speaker ? (
          <section class="speaker" aria-live="polite">
            <p class="speaker__label">{t("clues.nowSpeaking")}</p>
            <Avatar color={speaker.color} size={96} state={avatarState(speaker)} speaking class="speaker__avatar" />
            <h1 class="h1 speaker__name" tabIndex={-1}><bdi>{speaker.name}</bdi></h1>
            {view.deadline ? <TimerBar deadline={view.deadline} /> : <p class="muted">{t("clues.noTimer")}</p>}
          </section>
        ) : (
          <Heading title={t(PHASE_KEY[view.phase])} />
        )}
        {nextUp && <p class="banner banner--primary" role="status"><Icon name="speech" size={20} />{t("clues.youreNext")}</p>}
        <OrderStrip view={view} myId={me.id} />
        <p class="hint hint--center">{view.round === 1 && idx === 0 && !tie ? t("clues.firstHint") : t("clues.listen")}</p>
        <p class="rule"><Icon name="info" size={16} />{t("clues.rule")}</p>
      </main>
      <footer class="actionbar"><PeekButton word={me.word} isBlank={me.isBlank} wordLocale={view.settings.wordLocale} /></footer>
    </>
  );
}
