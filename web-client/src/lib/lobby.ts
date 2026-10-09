// Lobby texts shared by PH-03 (phone) and TV-02 (TV mock): role summary, start blocker, packs line.
import { MIN_PLAYERS } from "@mishana/shared/constants";
import type { Locale } from "@mishana/shared/constants";
import { effectiveRoleCounts } from "@mishana/shared/engine";
import type { Settings } from "@mishana/shared/engine";
import type { PublicView } from "@mishana/shared/protocol";
import { t } from "../i18n/t";
import { selectedPacks } from "./settingsModel";

type LobbyView = Pick<PublicView, "players" | "startBlocker" | "settings" | "availablePacks" | "roleCounts">;

/** Seats that count for the role table (a player who left is gone). */
export function activeCount(view: Pick<PublicView, "players">): number {
  return view.players.filter((p) => !p.left).length;
}

/**
 * Role summary for the lobby cards. Below MIN_PLAYERS the room is simply not full yet, so it previews the roles at
 * MIN_PLAYERS (or names the role mode) instead of claiming the roles don't fit.
 */
export function roleSummaryText(view: Pick<LobbyView, "players" | "settings" | "roleCounts">): string {
  const s = view.settings;
  const few = activeCount(view) < MIN_PLAYERS;
  const c = view.roleCounts ?? (few ? effectiveRoleCounts(s, MIN_PLAYERS) : null);
  if (c) return t("lobby.roleSummary", { civilian: c.civilian, undercover: c.undercover, blank: c.blank });
  if (few) return t(s.roleMode === "auto" ? "settings.roleModeAuto" : "settings.roleModeCustom");
  return t("lobby.blockerRoles");
}

/** The settings-sheet / TV-03 role preview (null + `invalid` when the combination doesn't fit). */
export function rolePreview(view: Pick<LobbyView, "players" | "roleCounts">): { text: string; invalid: boolean } | null {
  const n = activeCount(view);
  const rc = view.roleCounts;
  if (rc) return { text: t("settings.rolePreview", { count: n, civilian: rc.civilian, undercover: rc.undercover, blank: rc.blank }), invalid: false };
  return n >= MIN_PLAYERS ? { text: t("lobby.blockerRoles"), invalid: true } : null;
}

/** The start blocker in words ("Need 2 more players" counts connected players). */
export function blockerText(view: Pick<LobbyView, "players" | "startBlocker">): string | null {
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

/** "All packs" or the selected pack titles in the UI locale. */
export function packsLine(settings: Settings, packs: LobbyView["availablePacks"], l: Locale): string {
  // Only the room language's packs count (the default list holds one easy pack per language), always by title.
  const sel = selectedPacks(settings, packs);
  if (sel.length === 0) return t("settings.allPacks");
  return sel.map((p) => p.title[l]).join(", ");
}
