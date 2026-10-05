// PH-07 Vote (radiogroup + lock CTA) and PH-08 Vote locked; eliminated players follow along (vote.dead).
import { useEffect, useState } from "preact/hooks";
import type { Me, PlayerView } from "@mishana/shared/protocol";
import { t } from "../i18n/t";
import { act } from "../state/session";
import { HAPTIC, haptic } from "../lib/haptics";
import { Avatar, avatarState, playerLabel } from "../components/PlayerChip";
import { TimerBar, useDeadlineSelect } from "../components/Timer";
import { PeekButton } from "../components/HoldToReveal";
import { Button, Heading, Slot } from "../components/UI";
import { Icon } from "../components/Icon";
import { byId } from "../lib/view";
import { revoteLine } from "../lib/gameText";
import { phaseLine } from "./Clues";

export function Vote({ view, me }: { view: PlayerView; me: Me }) {
  const meP = byId(view, me.id);
  const [sel, setSel] = useState<string | null>(null);
  const timeUp = useDeadlineSelect(view.deadline, (c) => c.ms <= 0, false);
  const candidates = view.players.filter((p) => p.alive && !p.left && p.id !== me.id && (!view.revote || view.tieCandidates.includes(p.id)));
  useEffect(() => { if (sel && !candidates.some((p) => p.id === sel)) setSel(null); }, [view]);

  if (meP && !meP.alive) {
    return (
      <>
        <main class="screen screen--out">
          <p class="eyebrow">{phaseLine(view)}</p>
          <div class="outpanel">
            <span class="outpanel__icon"><Icon name="door-out" size={56} /></span>
            <h1 class="h1" tabIndex={-1}>{t("vote.dead")}</h1>
            <p class="bigcount tnum">{t("vote.progress", { cast: view.votesCast, expected: view.votesExpected })}</p>
            <TimerBar deadline={view.deadline} />
          </div>
        </main>
        {/* Same footer as PH-10 during the clues: the controls don't change between phases. */}
        <footer class="actionbar"><PeekButton word={me.word} isBlank={me.isBlank} wordLocale={view.settings.wordLocale} out /></footer>
      </>
    );
  }

  const voted = byId(view, me.myVote);
  if (voted) {
    return (
      <main class="screen screen--locked">
        <p class="eyebrow">{phaseLine(view)}</p>
        <div class="lockedvote">
          <span class="lockedvote__check pop-in"><Icon name="check" size={48} /></span>
          <h1 class="h1" tabIndex={-1}>{t("vote.locked")}</h1>
          <p class="sub">{t("vote.actNatural")}</p>
          <p class="lockedvote__who">
            <Slot k="vote.youVoted" slot="name"><span class="inline-chip"><Avatar color={voted.color} size={28} state={avatarState(voted)} /><bdi>{voted.name}</bdi></span></Slot>
          </p>
          <p class="bigcount tnum" aria-live="polite">{t("vote.progress", { cast: view.votesCast, expected: view.votesExpected })}</p>
          <TimerBar deadline={view.deadline} />
          <p class="hint hint--center"><Icon name="tv" size={18} />{t("vote.lookTv")}</p>
        </div>
      </main>
    );
  }

  const target = byId(view, sel);
  return (
    <>
      <main class="screen screen--vote">
        <div class="eyebrow-row"><p class="eyebrow">{phaseLine(view)}</p><TimerBar deadline={view.deadline} class="timerbar--inline" /></div>
        {/* The brand's question, the same as on the TV ("lying" assumes the voter knows they are honest). */}
        <Heading title={t("vote.title")} sub={t("vote.pickSub")} />
        {view.revote && <p class="banner banner--accent"><Icon name="users" size={20} />{revoteLine(view)}</p>}
        {timeUp && <p class="banner banner--danger" role="alert">{t("vote.timeUp")}</p>}
        <div class="votelist" role="radiogroup" aria-label={t("vote.title")}>
          {candidates.map((p) => {
            const on = sel === p.id;
            return (
              <button key={p.id} type="button" role="radio" aria-checked={on} class={`voterow${on ? " is-selected" : ""}`}
                aria-label={playerLabel(p)} onClick={() => { if (sel !== p.id) haptic(HAPTIC.tick); setSel(p.id); }}>
                <Avatar color={p.color} size={56} state={avatarState(p)} />
                <bdi class="voterow__name">{p.name}</bdi>
                <span class="voterow__radio" aria-hidden="true">{on && <Icon name="check" size={18} />}</span>
              </button>
            );
          })}
        </div>
      </main>
      <footer class="actionbar">
        <Button disabled={!target || timeUp} onClick={() => {
          if (!target) return;
          if (act({ type: "CAST_VOTE", targetId: target.id })) haptic(HAPTIC.voteLocked);
        }}>
          {/* One inline run: as separate flex items the template's space and the button gap would double up. */}
          {target ? <span><Slot k="vote.confirm" slot="name"><bdi>{target.name}</bdi></Slot></span> : t("vote.pickFirst")}
        </Button>
      </footer>
    </>
  );
}
