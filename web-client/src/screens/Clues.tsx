// PH-05 (someone else's turn, incl. next up), PH-06 (your turn), PH-09 (tie-break), PH-10 (eliminated / spectator).
import { Fragment } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import type { Me, PlayerView, PublicPlayer } from "@mishana/shared/protocol";
import { t } from "../i18n/t";
import { act } from "../state/session";
import { HAPTIC, haptic } from "../lib/haptics";
import { PHASE_KEY } from "../lib/keys";
import { byId, playersOf, tiedWithTally } from "../lib/view";
import { Avatar, avatarState, colorVars, LIGHT_GLYPH } from "../components/PlayerChip";
import { PeekButton } from "../components/HoldToReveal";
import { RoleChip } from "../components/Role";
import { TimerBar } from "../components/Timer";
import { Heading, Slot } from "../components/UI";
import { Icon } from "../components/Icon";

export const DONE_GUARD_MS = 1500;
/** PH-09: the full tie card shows this long, then folds into a one-line chip so the speaker stays the hero. */
export const TIE_CARD_MS = 3000;

export function phaseLine(view: PlayerView): string {
  return view.round > 0 ? `${t("round.label", { count: view.round })} · ${t(PHASE_KEY[view.phase])}` : t(PHASE_KEY[view.phase]);
}

/** Which inline edges of a sideways-scrolling box hide content (RTL scrollLeft runs 0 → negative). */
function useOverflowEdges(ref: { current: HTMLElement | null }, dep: unknown): { start: boolean; end: boolean } {
  const [edges, setEdges] = useState({ start: false, end: false });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = (): void => {
      const x = Math.abs(el.scrollLeft);
      const next = { start: x > 1, end: x + el.clientWidth < el.scrollWidth - 1 };
      setEdges((p) => (p.start === next.start && p.end === next.end ? p : next));
    };
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => { el.removeEventListener("scroll", measure); window.removeEventListener("resize", measure); };
  }, [dep]);
  return edges;
}

/**
 * The speaking order. It scrolls sideways with long names / many players: it follows the current speaker, and a soft
 * edge appears only on a side that hides players. You are marked by "You" in place of your name (the underline is
 * the only highlight: the current speaker).
 */
export function OrderStrip({ view, myId }: { view: PlayerView; myId: string | null }) {
  const order = playersOf(view, view.speakingOrder);
  const list = useRef<HTMLOListElement>(null);
  const edges = useOverflowEdges(list, order.length);
  useEffect(() => {
    list.current?.querySelector<HTMLElement>(".is-current")?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [view.currentSpeakerId]);
  return (
    <ol class={`orderstrip${edges.start ? " fade-start" : ""}${edges.end ? " fade-end" : ""}`} ref={list} aria-label={t("clues.nowSpeaking")}>
      {order.map((p, i) => {
        const cur = p.id === view.currentSpeakerId;
        const you = p.id === myId;
        return (
          <li key={p.id} class={`orderstrip__item${cur ? " is-current" : ""}${p.spoke && !cur ? " is-done" : ""}${you ? " is-you" : ""}`} aria-current={cur ? "step" : undefined}>
            {i > 0 && <Icon name="chevron-forward" size={14} class="orderstrip__chev" />}
            <span class="orderstrip__who">
              <Avatar color={p.color} size={36} state={avatarState(p)} check={p.spoke && !cur} speaking={cur} />
              {you ? <span class="orderstrip__name">{t("common.you")}<span class="sr-only"> (<bdi>{p.name}</bdi>)</span></span> : <bdi class="orderstrip__name">{p.name}</bdi>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** PH-09 tie card: the tied players with their tallies. */
export function TieCard({ view }: { view: PlayerView }) {
  return (
    <section class="tiecard stamp-in" aria-label={t("tie.title")}>
      <p class="tiecard__stamp">{t("stamp.tie")}</p>
      <div class="tiecard__row">
        {tiedWithTally(view).map(({ player: p, votes }, i) => (
          <Fragment key={p.id}>
            {i > 0 && <span class="tiecard__vs" aria-hidden="true">{t("tie.vs")}</span>}
            <span class="tiecard__p">
              <Avatar color={p.color} size={48} state={avatarState(p)} />
              <bdi>{p.name}</bdi>
              <span class="tiecard__n num">{votes}</span>
            </span>
          </Fragment>
        ))}
      </div>
      <p class="tiecard__explain">{t("tie.explain")}</p>
    </section>
  );
}

/** The folded tie card: "TIE · Rami vs Sam" in the eyebrow row. */
function TieChip({ view }: { view: PlayerView }) {
  return (
    <p class="tiechip" aria-label={t("tie.title")}>
      <span class="tiechip__stamp">{t("stamp.tie")}</span>
      {playersOf(view, view.tieCandidates).map((p, i) => (
        <Fragment key={p.id}>
          {i > 0 && <span class="tiechip__vs">{t("tie.vs")}</span>}
          <span class="tiechip__p"><Avatar color={p.color} size={20} state={avatarState(p)} /><bdi>{p.name}</bdi></span>
        </Fragment>
      ))}
    </p>
  );
}

/** Tie rounds whose full card was already shown (the screen remounts around your own turn). */
const tieCardsShown = new Set<string>();

function useTieCardOpen(view: PlayerView): boolean {
  const key = `${view.roomCode}:${view.gameNumber}:${view.round}`;
  const tie = view.phase === "TIE_BREAK";
  const [open, setOpen] = useState(() => tie && !tieCardsShown.has(key));
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => { tieCardsShown.add(key); setOpen(false); }, TIE_CARD_MS);
    return () => clearTimeout(id);
  }, [open]);
  return tie && open;
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

/**
 * PH-06. Identical for every role (the most exposed screen in the room): the Blank's coaching lives in the private
 * hold-to-peek bubble instead of an extra line here.
 */
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
        {/* In a tie-break the speaker is one of the tied: the clue that may save them. */}
        <p class="flood__body">{t(view.phase === "TIE_BREAK" && view.tieCandidates.includes(me.id) ? "tie.yourTurn" : "clues.yourTurnBody")}</p>
        {me.role && <RoleChip role={me.role} />}
        {view.deadline ? <TimerBar deadline={view.deadline} class="timerbar--on-color" /> : <p class="flood__body">{t("clues.noTimer")}</p>}
        <button type="button" class={`donebtn${armed ? " is-armed" : ""}`} aria-disabled={!armed}
          onClick={() => { if (armed && act({ type: "CLUE_DONE" })) haptic(HAPTIC.voteLocked); }}>
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
  const tieOpen = useTieCardOpen(view);
  if (meP && !meP.alive) {
    return (
      <>
        <main class="screen screen--out"><OutPanel view={view} me={me} /></main>
        <footer class="actionbar"><PeekButton word={me.word} isBlank={me.isBlank} wordLocale={view.settings.wordLocale} out /></footer>
      </>
    );
  }
  if (view.currentSpeakerId === me.id && meP) return <YourTurn view={view} me={me} color={meP.color} />;
  const speaker = byId(view, view.currentSpeakerId);
  const idx = view.currentSpeakerId ? view.speakingOrder.indexOf(view.currentSpeakerId) : -1;
  const nextUp = idx >= 0 && view.speakingOrder[idx + 1] === me.id;
  const tie = view.phase === "TIE_BREAK";
  const inTie = tie && view.tieCandidates.includes(me.id) && !meP?.spoke;
  // One banner at most: "You're next" wins over "You're in the tie".
  const banner = nextUp ? t("clues.youreNext") : inTie ? t("tie.inTie") : null;
  return (
    <>
      <main class="screen screen--clues">
        {tie && !tieOpen ? <div class="eyebrow-row eyebrow-row--wrap"><p class="eyebrow">{phaseLine(view)}</p><TieChip view={view} /></div> : <p class="eyebrow">{phaseLine(view)}</p>}
        {tieOpen && <TieCard view={view} />}
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
        {banner && <p class="banner banner--primary" role="status"><Icon name="speech" size={20} />{banner}</p>}
        <OrderStrip view={view} myId={me.id} />
        <p class="hint hint--center">{view.round === 1 && idx === 0 && !tie ? t("clues.firstHint") : t("clues.listen")}</p>
        <p class="rule"><Icon name="info" size={16} />{t("clues.rule")}</p>
      </main>
      <footer class="actionbar"><PeekButton word={me.word} isBlank={me.isBlank} wordLocale={view.settings.wordLocale} /></footer>
    </>
  );
}
