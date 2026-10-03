// PH-03 Lobby (player and VIP variants) + kick sheet + settings sheet.
import { useState } from "preact/hooks";
import { MAX_PLAYERS, MIN_PLAYERS } from "@mishana/shared/constants";
import { effectiveRoleCounts } from "@mishana/shared/engine";
import type { RoleCounts, Settings } from "@mishana/shared/engine";
import type { PlayerView, PublicPlayer } from "@mishana/shared/protocol";
import { locale, t } from "../i18n/t";
import { act } from "../state/session";
import { wakeLockDenied, wakeLockSupported } from "../lib/wakelock";
import { Avatar, avatarState, playerLabel } from "../components/PlayerChip";
import { Button, ConfirmSheet, Heading } from "../components/UI";
import { Icon } from "../components/Icon";
import { SettingsSheet } from "./Settings";
import type { SettingsSection } from "./Settings";

const NATIVE = { en: "English", fr: "Français", ar: "العربية" } as const;

/**
 * Role summary for the lobby cards (phone + TV). Below MIN_PLAYERS the room is simply not full yet, so it previews
 * the roles at MIN_PLAYERS (or names the role mode) instead of claiming the roles don't fit.
 */
export function roleSummaryText(settings: Settings, playerCount: number, rc: RoleCounts | null): string {
  const few = playerCount < MIN_PLAYERS;
  const c = rc ?? (few ? effectiveRoleCounts(settings, MIN_PLAYERS) : null);
  if (c) return t("lobby.roleSummary", { civilian: c.civilian, undercover: c.undercover, blank: c.blank });
  if (few) return t(settings.roleMode === "auto" ? "settings.roleModeAuto" : "settings.roleModeCustom");
  return t("lobby.blockerRoles");
}

export function settingsSummary(view: PlayerView): [string, string] {
  const s = view.settings;
  const l = locale.value;
  const packs = s.packIds.length === 0
    ? t("settings.allPacks")
    : s.packIds.map((id) => view.availablePacks.find((p) => p.id === id)?.title[l] ?? id).join(", ");
  const roles = roleSummaryText(s, view.players.length, view.roleCounts);
  const clue = s.clueSeconds === 0 ? t("common.timerOff") : t("common.seconds", { count: s.clueSeconds });
  return [`${packs} · ${NATIVE[s.wordLocale]}`, `${roles} · ${t("settings.clueSeconds")} ${clue}`];
}

export function blockerText(view: PlayerView): string | null {
  switch (view.startBlocker) {
    case null: return null;
    case "NOT_ENOUGH_PLAYERS": {
      const connected = view.players.filter((p) => p.connected && !p.left).length;
      return t("lobby.needPlayers", { count: Math.max(1, MIN_PLAYERS - connected) });
    }
    case "INVALID_ROLE_CONFIG": return t("lobby.blockerRoles");
    case "NO_WORDS_AVAILABLE": return t("lobby.blockerWords");
    default: return t("error.invalidSettings");
  }
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
          {!isVip && host && <p class="card__foot">{t("lobby.hostIs", { name: "⁨" + host.name + "⁩" })}</p>}
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
          </>
        ) : (
          <p class="waiting"><span class="dots" aria-hidden="true"><i /><i /><i /></span>{t("lobby.waitingHost")}</p>
        )}
      </footer>
      <ConfirmSheet open={kick !== null} title={kick ? t("lobby.kickConfirm", { name: "⁨" + kick.name + "⁩" }) : ""} body={t("lobby.kickBody")}
        confirm={t("lobby.kick")} onConfirm={() => { if (kick) act({ type: "KICK", playerId: kick.id }); }} onClose={() => setKick(null)} />
      {isVip && <SettingsSheet view={view} open={settings !== false} section={settings === false ? null : settings} onClose={() => setSettings(false)} />}
    </>
  );
}
