// TV-02 Lobby and TV-03 Settings.
import { useEffect, useRef, useState } from "preact/hooks";
import { LOCALES, MAX_PLAYERS, SETTINGS_BOUNDS } from "@mishana/shared/constants";
import type { Locale } from "@mishana/shared/constants";
import type { Points, Settings } from "@mishana/shared/engine";
import type { PublicPlayer, TvView } from "@mishana/shared/protocol";
import { fmtNum, locale, setLocale, t } from "../i18n/t";
import type { MessageKey } from "../i18n/t";
import { saveLocale } from "../lib/storage";
import { stepValue } from "../lib/settings";
import type { Bound } from "../lib/settings";
import { usePatcher } from "../screens/Settings";
import { Icon } from "../components/Icon";
import { Qr } from "./Qr";
import { RoomCode, Tile, useInitialFocus } from "./tvParts";
import { tvScreen, tvSend } from "./tvStore";
import { openDialog } from "./tvDialogs";

const NATIVE: Record<Locale, string> = { en: "English", fr: "Français", ar: "العربية" };

export function hostOf(joinUrl: string): string {
  try {
    const u = new URL(joinUrl);
    return u.host;
  } catch {
    return joinUrl.replace(/^[a-z]+:\/\//i, "").replace(/\/.*$/, "");
  }
}

function needText(view: TvView): string | null {
  switch (view.startBlocker) {
    case null: return null;
    case "NOT_ENOUGH_PLAYERS": return t("lobby.needPlayers", { count: Math.max(1, 3 - view.players.filter((p) => p.connected).length) });
    case "INVALID_ROLE_CONFIG": return t("lobby.blockerRoles");
    case "NO_WORDS_AVAILABLE": return t("lobby.blockerWords");
    default: return t("error.invalidSettings");
  }
}

export function TvLobby({ view }: { view: TvView }) {
  const startRef = useInitialFocus<HTMLButtonElement>();
  const settingsRef = useRef<HTMLButtonElement>(null);
  const [langOpen, setLangOpen] = useState(false);
  const [shake, setShake] = useState(0);
  const [flash, setFlash] = useState(0);
  const prevSettings = useRef(view.settings);
  useEffect(() => {
    if (prevSettings.current !== view.settings && JSON.stringify(prevSettings.current) !== JSON.stringify(view.settings)) setFlash((f) => f + 1);
    prevSettings.current = view.settings;
  }, [view.settings]);
  useEffect(() => {
    // SPEC §9.6: initial focus Start if canStart or NOT_ENOUGH_PLAYERS, else Settings.
    const id = setTimeout(() => {
      if (!view.canStart && view.startBlocker !== "NOT_ENOUGH_PLAYERS") settingsRef.current?.focus();
    }, 40);
    return () => clearTimeout(id);
  }, []);
  const full = view.players.length >= MAX_PLAYERS;
  const rc = view.roleCounts;
  const s = view.settings;
  const packLine = s.packIds.length === 0 ? t("settings.allPacks") : s.packIds.map((id) => view.availablePacks.find((p) => p.id === id)?.title[locale.value] ?? id).join(", ");
  const blocker = needText(view);
  const slots = Array.from({ length: MAX_PLAYERS }, (_, i) => view.players[i] ?? null);
  const firstEmpty = view.players.length;
  const onStart = (): void => {
    if (view.canStart) { tvSend({ type: "START" }); return; }
    if (view.startBlocker === "NOT_ENOUGH_PLAYERS") { setShake((x) => x + 1); return; }
    tvScreen.value = "settings";
  };
  const kick = (p: PublicPlayer): void => openDialog({
    title: t("lobby.kickConfirm", { name: "⁨" + p.name + "⁩" }), body: t("lobby.kickBody"),
    confirm: t("lobby.kick"), danger: true, onConfirm: () => tvSend({ type: "KICK", playerId: p.id }),
  });
  return (
    <div class="tvscreen tvlobby">
      <img class="tvlobby__wordmark" src="/brand/wordmark-latin.svg" alt="Mish Ana!" width={160} height={48} />
      <p class="tvlobby__scan">{t("lobby.scanToJoin")}</p>
      <div class={`tvlobby__qr${full ? " is-full" : ""}`}>
        {full ? <div class="qr qr--full"><Icon name="users" size={48} /><span>{t("lobby.full")}</span></div> : <Qr url={view.joinUrl} />}
      </div>
      <div class={`tvlobby__code${full ? " is-dim" : ""}`}><RoomCode code={view.roomCode} size="big" /></div>
      <p class="tvlobby__host">{t("lobby.orVisit", { url: "⁦" + hostOf(view.joinUrl) + "⁩" })}</p>

      <div class="tvlobby__summary" key={flash} data-flash={flash > 0 ? "1" : undefined}>
        <span>{packLine} · {NATIVE[s.wordLocale]}</span>
        <span>{rc ? t("lobby.roleSummary", { civilian: rc.civilian, undercover: rc.undercover, blank: rc.blank }) : t("lobby.blockerRoles")} · {t(s.winRule === "official" ? "settings.winRuleOfficial" : "settings.winRuleParity")}</span>
      </div>
      <div class="tvlobby__players">
        <span class="tvlobby__count">{t("lobby.playerCount", { count: view.players.length, max: MAX_PLAYERS })}</span>
        {blocker && <span class="tvlobby__blocker">{blocker}</span>}
      </div>
      <div class="tvgrid">
        {slots.map((p, i) => p ? (
          <Tile key={p.id} p={p} focusable onClick={() => kick(p)} class="tile--lobby tile--drop" />
        ) : (
          <div key={`e${i}`} class={`tile tile--empty${i === firstEmpty ? " is-next" : ""}`} aria-hidden="true"><Icon name="plus" size={28} /></div>
        ))}
      </div>
      <div class="tvbottom tvbottom--lobby">
        <button type="button" ref={settingsRef} class="tvbtn" onClick={() => { tvScreen.value = "settings"; }}><Icon name="settings" />{t("lobby.settings")}</button>
        <div class="tvlang">
          <button type="button" class="tvbtn" aria-expanded={langOpen} onClick={() => setLangOpen(!langOpen)}><Icon name="globe" />{NATIVE[locale.value]}</button>
          {langOpen && (
            <div class="tvlang__menu" role="listbox">
              {LOCALES.map((l) => (
                <button key={l} type="button" role="option" aria-selected={l === locale.value} class={`tvlang__opt${l === locale.value ? " is-on" : ""}`} lang={l}
                  ref={(el) => { if (el && l === locale.value) setTimeout(() => el.focus(), 0); }}
                  onClick={() => { setLocale(l); saveLocale(l); setLangOpen(false); }}>{NATIVE[l]}{l === locale.value && <Icon name="check" size={20} />}</button>
              ))}
            </div>
          )}
        </div>
        <button type="button" ref={startRef} key={shake} class={`tvbtn tvbtn--primary tvbtn--start${view.canStart ? "" : " is-disabled"}${shake ? " shake" : ""}`} aria-disabled={!view.canStart} onClick={onStart}>
          <Icon name="play" />{t("lobby.startGame")}
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ TV-03 Settings
type Row = { id: string; label: string; value: string; prev(): void; next(): void; help?: string; open?(): void; danger?: boolean };
type Cat = "game" | "roles" | "timers" | "words";

function cycle<T>(list: readonly T[], v: T, dir: 1 | -1): T {
  const i = list.indexOf(v);
  return list[(i + dir + list.length) % list.length] as T;
}

function SettingRow({ row }: { row: Row }) {
  const onKey = (e: KeyboardEvent): void => {
    const rtl = document.documentElement.dir === "rtl";
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      e.stopPropagation();
      const fwd = (e.key === "ArrowRight") !== rtl;
      if (fwd) row.next(); else row.prev();
    }
  };
  return (
    <button type="button" class={`setrowtv${row.danger ? " is-danger" : ""}`} data-row={row.id} onKeyDown={onKey} onClick={() => (row.open ? row.open() : row.next())}>
      <span class="setrowtv__label">{row.label}</span>
      <span class="setrowtv__value">
        {!row.open && <span class="setrowtv__chev" onClick={(e) => { e.stopPropagation(); row.prev(); }}><Icon name="chevron-back" size={22} /></span>}
        <span class="num">{row.value}</span>
        <span class="setrowtv__chev" onClick={(e) => { e.stopPropagation(); if (row.open) row.open(); else row.next(); }}><Icon name="chevron-forward" size={22} /></span>
      </span>
    </button>
  );
}

export function TvSettings({ view }: { view: TvView }) {
  const [s, set] = usePatcher(view.settings, (patch) => tvSend({ type: "UPDATE_SETTINGS", patch }));
  const initialCat: Cat = view.startBlocker === "INVALID_ROLE_CONFIG" ? "roles" : view.startBlocker === "NO_WORDS_AVAILABLE" ? "words" : "game";
  const [cat, setCat] = useState<Cat>(initialCat);
  const [sub, setSub] = useState<null | "packs" | "difficulty">(null);
  const [focusRow, setFocusRow] = useState<string | null>(null);
  const catRef = useInitialFocus<HTMLButtonElement>();
  const B = SETTINGS_BOUNDS;
  const num = (k: keyof Settings & ("clueSeconds" | "voteSeconds" | "revealSeconds" | "guessSeconds" | "undercoverCount" | "blankCount"), b: Bound, fmt: (v: number) => string, label: string, help?: string): Row => ({
    id: k, label, value: fmt(s[k]), help,
    prev: () => set({ [k]: stepValue(s[k], b, -1) }), next: () => set({ [k]: stepValue(s[k], b, 1) }),
  });
  const secs = (v: number): string => (v === 0 ? t("common.off") : t("common.seconds", { count: v }));
  const pts = (k: keyof Points, label: MessageKey): Row => ({
    id: `points.${k}`, label: `${t("settings.points")} · ${t(label)}`, value: fmtNum(s.points[k]),
    prev: () => set({ points: { ...s.points, [k]: stepValue(s.points[k], B.points, -1) } }),
    next: () => set({ points: { ...s.points, [k]: stepValue(s.points[k], B.points, 1) } }),
  });
  const bool = (k: "revealRoles" | "blankGuess" | "familyFilter" | "swapSides", label: MessageKey): Row => ({
    id: k, label: t(label), value: s[k] ? t("common.on") : t("common.off"), prev: () => set({ [k]: !s[k] }), next: () => set({ [k]: !s[k] }),
  });
  const rc = view.roleCounts;
  const rows: Record<Cat, Row[]> = {
    game: [
      { id: "winRule", label: t("settings.winRule"), value: t(s.winRule === "official" ? "settings.winRuleOfficial" : "settings.winRuleParity"),
        prev: () => set({ winRule: cycle(["official", "parity"] as const, s.winRule, -1) }), next: () => set({ winRule: cycle(["official", "parity"] as const, s.winRule, 1) }),
        help: t(s.winRule === "official" ? "settings.winRuleOfficialHelp" : "settings.winRuleParityHelp") },
      bool("revealRoles", "settings.revealRoles"),
      { id: "tieBreak", label: t("settings.tieBreak"), value: t(s.tieBreak === "random" ? "settings.tieBreakRandom" : "settings.tieBreakNone"),
        prev: () => set({ tieBreak: cycle(["random", "none"] as const, s.tieBreak, -1) }), next: () => set({ tieBreak: cycle(["random", "none"] as const, s.tieBreak, 1) }) },
      bool("blankGuess", "settings.blankGuess"),
      pts("civilian", "role.civilian"), pts("undercover", "role.undercover"), pts("blank", "role.blank"),
    ],
    roles: [
      { id: "roleMode", label: t("settings.roleMode"), value: t(s.roleMode === "auto" ? "settings.roleModeAuto" : "settings.roleModeCustom"),
        prev: () => set({ roleMode: cycle(["auto", "custom"] as const, s.roleMode, -1) }), next: () => set({ roleMode: cycle(["auto", "custom"] as const, s.roleMode, 1) }),
        help: rc ? t("settings.rolePreview", { count: view.players.length, civilian: rc.civilian, undercover: rc.undercover, blank: rc.blank }) : t("lobby.blockerRoles") },
      ...(s.roleMode === "custom" ? [
        num("undercoverCount", B.undercoverCount, (v) => fmtNum(v), t("settings.undercoverCount")),
        num("blankCount", B.blankCount, (v) => fmtNum(v), t("settings.blankCount")),
      ] : []),
    ],
    timers: [
      num("clueSeconds", B.clueSeconds, secs, t("settings.clueSeconds"), t("settings.timerOffHelp")),
      num("voteSeconds", B.voteSeconds, secs, t("settings.voteSeconds"), t("settings.timerOffHelp")),
      num("revealSeconds", B.revealSeconds, secs, t("settings.revealSeconds"), t("settings.timerOffHelp")),
      num("guessSeconds", B.guessSeconds, secs, t("settings.guessSeconds"), t("settings.timerOffHelp")),
    ],
    words: [
      { id: "wordLocale", label: t("settings.wordLocale"), value: NATIVE[s.wordLocale],
        prev: () => set({ wordLocale: cycle(LOCALES, s.wordLocale, -1) }), next: () => set({ wordLocale: cycle(LOCALES, s.wordLocale, 1) }) },
      { id: "packIds", label: t("settings.packs"), value: s.packIds.length === 0 ? t("settings.allPacks") : fmtNum(s.packIds.length), prev: () => undefined, next: () => undefined, open: () => setSub("packs") },
      { id: "difficulties", label: t("settings.difficulty"), value: s.difficulties.map((d) => t(`settings.difficulty${d}` as MessageKey)).join(" · "), prev: () => undefined, next: () => undefined, open: () => setSub("difficulty") },
      bool("familyFilter", "settings.familyFilter"),
      bool("swapSides", "settings.swapSides"),
    ],
  };
  const catLabel: Record<Cat, MessageKey> = { game: "settings.catGame", roles: "settings.catRoles", timers: "settings.catTimers", words: "settings.catWords" };
  const focused = rows[cat].find((r) => r.id === focusRow);
  const help = focused?.help ?? (cat === "roles" ? rows.roles[0]?.help : undefined);
  const back = (): void => { if (sub) setSub(null); else tvScreen.value = "main"; };
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape" || e.key === "Backspace" || e.key === "GoBack") { e.preventDefault(); e.stopPropagation(); back(); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [sub]);
  return (
    <div class="tvscreen tvsettings">
      <header class="tvsettings__head">
        <h1 class="tvsettings__title">{t("settings.title")}</h1>
        <button type="button" class="tvbtn" onClick={back}><Icon name="check" />{t("common.done")}</button>
      </header>
      <nav class="tvsettings__cats" aria-label={t("settings.title")}>
        {(Object.keys(rows) as Cat[]).map((c, i) => (
          <button key={c} type="button" ref={i === 0 ? catRef : undefined} class={`tvcat${cat === c ? " is-on" : ""}`} onFocus={() => { setCat(c); setSub(null); }} onClick={() => setCat(c)}>
            {t(catLabel[c])}
          </button>
        ))}
      </nav>
      <section class="tvsettings__rows">
        {sub === "packs" ? (
          <div class="tvsub">
            <button type="button" class={`tvtoggle${s.packIds.length === 0 ? " is-on" : ""}`} onClick={() => set({ packIds: [] })}>{s.packIds.length === 0 && <Icon name="check" size={20} />}{t("settings.allPacks")}</button>
            {view.availablePacks.map((p) => {
              const on = s.packIds.includes(p.id);
              return (
                <button key={p.id} type="button" class={`tvtoggle${on ? " is-on" : ""}`} onClick={() => set({ packIds: on ? s.packIds.filter((x) => x !== p.id) : [...s.packIds, p.id] })}>
                  {on && <Icon name="check" size={20} />}<bdi>{p.title[locale.value]}</bdi><span class="muted num">{fmtNum(p.pairCount)}</span>
                  {p.ageRating === "teen" && <span class="tvtag">{t("settings.packTeen")}</span>}
                </button>
              );
            })}
          </div>
        ) : sub === "difficulty" ? (
          <div class="tvsub">
            {([1, 2, 3] as const).map((d) => {
              const on = s.difficulties.includes(d);
              return (
                <button key={d} type="button" class={`tvtoggle${on ? " is-on" : ""}`} onClick={() => {
                  if (on && s.difficulties.length === 1) return;
                  set({ difficulties: on ? s.difficulties.filter((x) => x !== d) : [...s.difficulties, d].sort() });
                }}>{on && <Icon name="check" size={20} />}{t(`settings.difficulty${d}` as MessageKey)}</button>
              );
            })}
          </div>
        ) : (
          rows[cat].map((r) => <div key={r.id} onFocusIn={() => setFocusRow(r.id)}><SettingRow row={r} /></div>)
        )}
        {help && !sub && <p class={`tvsettings__help${cat === "roles" && !rc ? " is-danger" : ""}`}>{help}</p>}
      </section>
      <p class="tvsettings__foot">{t("settings.applies")}</p>
    </div>
  );
}
