// PH-03 Lobby (player and VIP variants) + kick sheet + settings sheet.
import { useState } from "preact/hooks";
import { MAX_PLAYERS } from "@mishana/shared/constants";
import type { PlayerView, PublicPlayer } from "@mishana/shared/protocol";
import { fmtNum, isolate, locale, LOCALE_NATIVE_NAME, t } from "../i18n/t";
import type { MessageKey } from "../i18n/t";
import { RoleEmblem } from "../components/Role";
import { blockerText, packsLine, roleSummaryText } from "../lib/lobby";
import { act } from "../state/session";
import { tvBusyHint } from "../lib/premium";
import { billingEnabled } from "../lib/billingFlag";
import { wakeLockDenied, wakeLockSupported } from "../lib/wakelock";
import { Avatar, avatarState, playerLabel } from "../components/PlayerChip";
import { Button, ConfirmSheet, Heading } from "../components/UI";
import { Icon } from "../components/Icon";
import { SettingsSheet } from "./Settings";
import type { SettingsSection } from "./Settings";

/** The two lines of the lobby settings card: packs · word language / roles · clue timer. */
export function settingsSummary(view: PlayerView): [string, string] {
  const s = view.settings;
  const clue = s.clueSeconds === 0 ? t("common.timerOff") : t("common.seconds", { count: s.clueSeconds });
  return [
    `${packsLine(s, view.availablePacks, locale.value)} · ${LOCALE_NATIVE_NAME[s.wordLocale]}`,
    `${roleSummaryText(view)} · ${t("settings.clueSeconds")} ${clue}`,
  ];
}

const HOWTO: { key: MessageKey; icon: string | null }[] = [
  { key: "howto.step1", icon: "eye-off" }, { key: "howto.step2", icon: "speech" },
  { key: "howto.step3", icon: "vote" }, { key: "howto.step4", icon: null },
];

/**
 * The rules, in the one moment the whole group is idle and looking down (DESIGN TV-15 copy). Open before the first
 * game, folded into a "How to play" disclosure from game 2 on.
 */
function HowTo({ open }: { open: boolean }) {
  return (
    <details class="card howto" open={open}>
      <summary class="howto__title"><span>{t("howto.title")}</span><Icon name="chevron-forward" size={20} class="howto__chev" /></summary>
      <ol class="howto__list">
        {HOWTO.map((s, i) => (
          <li key={s.key} class="howto__step">
            <span class="howto__icon" aria-hidden="true">{s.icon ? <Icon name={s.icon} size={20} /> : <RoleEmblem role="BLANK" size={20} />}</span>
            <span class="howto__text"><span class="sr-only">{fmtNum(i + 1)}. </span>{t(s.key)}</span>
          </li>
        ))}
      </ol>
    </details>
  );
}

export function Lobby({ view }: { view: PlayerView }) {
  const myId = view.me?.id ?? "";
  const isVip = view.hostPlayerId === myId;
  const [kick, setKick] = useState<PublicPlayer | null>(null);
  const [settings, setSettings] = useState<SettingsSection | null | false>(false);
  const [line1, line2] = settingsSummary(view);
  const blocker = blockerText(view);
  const players = view.players;
  const host = players.find((p) => p.isHost);
  // After "Play again" the running totals stay visible (the TV shows them on Results).
  const topScore = Math.max(0, ...players.map((p) => p.score));
  const openBlocker = (): void => {
    if (view.startBlocker === "INVALID_ROLE_CONFIG") setSettings("roles");
    else if (view.startBlocker === "NO_WORDS_AVAILABLE") setSettings("words");
  };
  return (
    <>
      <main class="screen screen--lobby">
        {isVip ? (
          <Heading title={<span class="with-icon"><span>{t("phone.youAreHost")}</span><span class="crown-pill"><Icon name="crown" size={18} /></span></span>} sub={t("lobby.youHostSub")} />
        ) : (
          <Heading title={t("lobby.youreIn")} sub={t("lobby.lookTv")} />
        )}
        {view.premium && billingEnabled.value && <p class="premiumchip"><Icon name="gem" size={16} />{t("lobby.premiumRoom")}</p>}
        <section class="card card--list" aria-labelledby="players-h">
          <div class="card__head">
            <h2 id="players-h" class="eyebrow">{t("lobby.playerCount", { count: players.length, max: MAX_PLAYERS })}</h2>
            {isVip && players.length > 1 && <span class="card__hint"><Icon name="user-x" size={16} />{t("lobby.kick")}</span>}
          </div>
          <ul class="plist">
            {players.map((p) => {
              const you = p.id === myId;
              const content = (
                <>
                  <Avatar color={p.color} size={40} state={avatarState(p)} host={p.isHost} />
                  {/* The crown on the avatar marks the host (named in the row's accessible label); "You" is a small
                      second line so the name keeps the full row width. */}
                  <span class="plist__text">
                    <bdi class="plist__name">{p.name}</bdi>
                    {you && <span class="plist__you" aria-hidden="true">{t("common.you")}</span>}
                  </span>
                  {topScore > 0 && (
                    <span class={`plist__score${p.score === topScore ? " is-lead" : ""}`}>
                      {p.score === topScore && <Icon name="trophy" size={14} />}<bdi class="num">{fmtNum(p.score)}</bdi>
                    </span>
                  )}
                </>
              );
              return (
                <li key={p.id} class={`plist__item join-pop${you ? " is-you" : ""}`}>
                  {isVip && !you ? (
                    <button type="button" class="plist__row plist__row--btn" aria-label={`${playerLabel(p)}. ${t("lobby.kick")}`} onClick={() => setKick(p)}>
                      {content}<Icon name="x" size={18} class="plist__kick" />
                    </button>
                  ) : (
                    <div class="plist__row" aria-label={playerLabel(p, you ? [t("common.you")] : [])}>{content}</div>
                  )}
                </li>
              );
            })}
          </ul>
          {!isVip && host && <p class="card__foot">{t("lobby.hostIs", { name: isolate(host.name) })}</p>}
        </section>

        {isVip ? (
          <button type="button" class="card card--link" onClick={() => setSettings(null)}>
            <span class="card--link__text">
              <span class="card--link__title"><Icon name="settings" size={20} />{t("settings.title")}</span>
              <span class="card--link__sub">{line1}</span>
              <span class="card--link__sub">{line2}</span>
            </span>
            <Icon name="chevron-forward" />
          </button>
        ) : (
          <section class="card card--summary" aria-label={t("settings.title")}>
            <p>{line1}</p>
            <p>{line2}</p>
          </section>
        )}
        <HowTo open={view.gameNumber === 0} />
        {(!wakeLockSupported() || wakeLockDenied.value) && <p class="hint hint--tip"><Icon name="phone" size={18} />{t("phone.keepScreenOn")}</p>}
      </main>
      <footer class="actionbar">
        {isVip ? (
          <>
            {blocker && (
              view.startBlocker === "NOT_ENOUGH_PLAYERS"
                ? <p class="blocker" role="status">{blocker}</p>
                : <button type="button" class="blocker blocker--link" onClick={openBlocker}>{blocker}<Icon name="chevron-forward" size={18} /></button>
            )}
            <Button disabled={!view.canStart} onClick={() => act({ type: "START" })}>{t("lobby.startAll")}</Button>
            {tvBusyHint(view, isVip) && <p class="blocker blocker--busy" role="status">{t("error.tvBusy")}</p>}
          </>
        ) : (
          <p class="waiting"><span class="waiting__text"><span class="dots" aria-hidden="true"><i /><i /><i /></span>{t("lobby.waitingHost")}</span></p>
        )}
      </footer>
      <ConfirmSheet open={kick !== null} title={kick ? t("lobby.kickConfirm", { name: isolate(kick.name) }) : ""} body={t("lobby.kickBody")}
        confirm={t("lobby.kick")} onConfirm={() => { if (kick) act({ type: "KICK", playerId: kick.id }); }} onClose={() => setKick(null)} />
      {isVip && <SettingsSheet view={view} open={settings !== false} section={settings === false ? null : settings} onClose={() => setSettings(false)} />}
    </>
  );
}
