// The public-mode score rail along the bottom of the TV (Read the Room points; never shown with secret votes, where no
// points exist, GAME-LIKELY §6). In REVEAL the counters tick from `scoreBefore` (the reveal's "tick" step).
import { fmtNum, t } from "../../../i18n/t";
import { Character } from "../../../components/Character";
import type { LikelyModel } from "../model";

export function ScoreRail({ m, tick = false }: { m: LikelyModel; tick?: boolean }) {
  if (!m.pub.showVoters) return null;
  const lead = Math.max(...m.seats.map((s) => s.score));
  return (
    <ol class="lkrail" aria-label={t("results.scoreboard")}>
      {m.seats.filter((s) => !s.left).map((s) => {
        const from = tick ? s.scoreBefore : s.score;
        return (
          <li key={s.id} class={`lkrail__pill${lead > 0 && s.score === lead ? " is-lead" : ""}`}>
            <Character color={s.color} size={40} expression={s.connected ? "idle" : "away"} />
            <span class="lkrail__score tnum" data-score={s.score} data-from={from}>{fmtNum(from)}</span>
          </li>
        );
      })}
    </ol>
  );
}
