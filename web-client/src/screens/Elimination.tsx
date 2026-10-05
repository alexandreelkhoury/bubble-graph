// PH-08b Elimination: "Look at the TV!" during the TV's head start (≈3 s), then the outcome, tally and the
// countdown to what comes next. A voted-out Blank who may guess gets "Last chance coming…" instead of "You're out".
import type { Me, PlayerView } from "@mishana/shared/protocol";
import { isolate, t } from "../i18n/t";
import { ROLE_WAS_KEY } from "../lib/keys";
import { afterElimination, byId, TV_VOTE_REVEAL_MS } from "../lib/view";
import { Avatar, avatarState } from "../components/PlayerChip";
import { RoleChip, RoleEmblem } from "../components/Role";
import { TimerBar, useDeadline, useDeadlineSelect } from "../components/Timer";
import { Heading, Slot } from "../components/UI";
import { Icon } from "../components/Icon";
import { phaseLine } from "./Clues";

/**
 * The calm (non-warning) bar under the outcome, labelled with what comes next (afterElimination): "Next round in…",
 * "Last chance coming…" when the voted-out Blank may guess, or no label when the game ends or returns to the lobby.
 */
function NextUp({ view }: { view: PlayerView }) {
  const d = useDeadline(view.deadline);
  if (!d) return null;
  const next = afterElimination(view);
  return (
    <div class="nextround">
      <TimerBar deadline={view.deadline} showSeconds={false} tone="neutral" />
      {next === "NEXT_ROUND" && <p class="nextround__label tnum">{t("elim.nextRound", { count: d.secs })}</p>}
      {next === "LAST_CHANCE" && <p class="nextround__label nextround__label--blank">{t("elim.lastChance")}</p>}
    </div>
  );
}

export function Elimination({ view, me }: { view: PlayerView; me: Me | null }) {
  // Re-renders once when the head start ends, not on every tick.
  const headStart = useDeadlineSelect(view.deadline, (c) => view.deadline!.durationMs - c.ms < TV_VOTE_REVEAL_MS, false);
  const lv = view.lastVote;
  const out = byId(view, view.eliminated?.playerId);
  const isMe = me !== null && out?.id === me.id;
  const lastChance = isMe && view.eliminated?.role === "BLANK" && view.settings.blankGuess;
  // The voted-out player looks at the TV too: their own "You're out" must not land before the TV's OUT stamp.
  if (headStart && !lastChance) {
    return (
      <main class="screen screen--looktv">
        <p class="eyebrow">{phaseLine(view)}</p>
        <div class="looktv">
          <span class="looktv__icon"><Icon name="tv" size={72} /></span>
          <h1 class="display" tabIndex={-1}>{t("vote.lookTv")}</h1>
          <p class="sub">{t("vote.votesIn")}</p>
        </div>
      </main>
    );
  }
  const maxVotes = Math.max(1, ...(lv?.tally.map((x) => x.voterIds.length) ?? [1]));
  return (
    <main class="screen screen--elim">
      <p class="eyebrow">{phaseLine(view)}</p>
      {lastChance ? (
        <div class="outpanel outpanel--me outpanel--lastchance">
          <span class="outpanel__icon outpanel__icon--blank"><RoleEmblem role="BLANK" size={64} /></span>
          <Heading title={t("elim.lastChance")} />
          <p class="sub">{t("elim.blankGetReady")}</p>
        </div>
      ) : isMe && view.eliminated ? (
        <div class="outpanel outpanel--me">
          <span class="outpanel__icon"><Icon name="door-out" size={56} /></span>
          <Heading title={t("elim.you")} />
          <p class="outpanel__role"><Slot k="elim.youWere" slot="role"><RoleChip role={view.eliminated.role} size={24} /></Slot></p>
          <p class="sub">{t("elim.stay")}</p>
        </div>
      ) : out && view.eliminated ? (
        <div class={`outcome outcome--${view.eliminated.role.toLowerCase()}`}>
          {lv?.outcome === "RANDOM" && <p class="banner banner--accent"><Icon name="dice" size={20} />{t("elim.randomPick")}</p>}
          <Avatar color={out.color} size={72} state={avatarState(out)} role={view.eliminated.role} />
          <Heading title={t("elim.eliminated", { name: isolate(out.name) })} />
          <p class="outcome__role"><RoleEmblem role={view.eliminated.role} size={28} />{t(ROLE_WAS_KEY[view.eliminated.role], { name: isolate(out.name) })}</p>
        </div>
      ) : (
        <div class="outcome outcome--none">
          <span class="outcome__stamp">{t(lv && lv.tally.length === 0 ? "vote.nobodyVoted" : "elim.noElimination")}</span>
        </div>
      )}
      {!lastChance && lv && (lv.tally.length > 0 || lv.abstainIds.length > 0) && (
        <section class="card tally" aria-label={t("vote.votesIn")}>
          {lv.tally.map((x) => {
            const p = byId(view, x.targetId);
            if (!p) return null;
            return (
              <div class="tally__row" key={x.targetId}>
                <Avatar color={p.color} size={32} state={avatarState(p)} />
                <bdi class="tally__name">{p.name}</bdi>
                <span class="tally__bar" style={{ "--w": `${(x.voterIds.length / maxVotes) * 100}%` }} aria-hidden="true" />
                <span class="tally__n num">{x.voterIds.length}</span>
              </div>
            );
          })}
          {lv.abstainIds.length > 0 && (
            <div class="tally__abstain">
              <span class="muted">{t("vote.noVote")}:</span>
              {lv.abstainIds.map((id) => {
                const p = byId(view, id);
                return p ? <span class="inline-chip" key={id}><Avatar color={p.color} size={24} state={avatarState(p)} /><bdi>{p.name}</bdi></span> : null;
              })}
            </div>
          )}
        </section>
      )}
      {lastChance ? <TimerBar deadline={view.deadline} showSeconds={false} tone="neutral" /> : <NextUp view={view} />}
    </main>
  );
}
