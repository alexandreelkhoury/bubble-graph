// PH-08b Elimination: "Look at the TV!" during the TV's head start (≈3 s), then the outcome, tally and deadline bar.
import type { Me, PlayerView } from "@mishana/shared/protocol";
import { t } from "../i18n/t";
import { ROLE_WAS_KEY } from "../lib/roles";
import { Avatar, avatarState } from "../components/PlayerChip";
import { RoleChip, RoleEmblem } from "../components/Role";
import { TimerBar, useDeadline } from "../components/Timer";
import { Heading, Slot } from "../components/UI";
import { Icon } from "../components/Icon";
import { byId, phaseLine } from "./Clues";

export const TV_HEAD_START_MS = 3000;

export function Elimination({ view, me }: { view: PlayerView; me: Me | null }) {
  const d = useDeadline(view.deadline);
  const elapsed = view.deadline && d ? view.deadline.durationMs - d.ms : TV_HEAD_START_MS;
  const lv = view.lastVote;
  const out = view.eliminated ? byId(view, view.eliminated.playerId) : undefined;
  const isMe = me !== null && out?.id === me.id;
  if (elapsed < TV_HEAD_START_MS && !isMe) {
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
      {isMe && view.eliminated ? (
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
          <Heading title={t("elim.eliminated", { name: "⁨" + out.name + "⁩" })} />
          <p class="outcome__role"><RoleEmblem role={view.eliminated.role} size={28} />{t(ROLE_WAS_KEY[view.eliminated.role], { name: "⁨" + out.name + "⁩" })}</p>
        </div>
      ) : (
        <div class="outcome outcome--none">
          <span class="outcome__stamp">{t(lv && lv.tally.length === 0 ? "vote.nobodyVoted" : "elim.noElimination")}</span>
        </div>
      )}
      {lv && (lv.tally.length > 0 || lv.abstainIds.length > 0) && (
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
      <TimerBar deadline={view.deadline} showSeconds={false} />
    </main>
  );
}
