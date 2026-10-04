// TV-02 Lobby.
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { MAX_PLAYERS } from "@mishana/shared/constants";
import type { PublicPlayer, TvView } from "@mishana/shared/protocol";
import { isolate, isolateLtr, locale, LOCALE_NATIVE_NAME, t } from "../i18n/t";
import { blockerText, packsLine, roleSummaryText } from "../lib/lobby";
import { toasts } from "../state/store";
import { Icon } from "../components/Icon";
import { Qr } from "./Qr";
import { RoomCode, Tile } from "./tvParts";
import { tvAct, tvScreen } from "./tvStore";
import { openDialog, openLanguages } from "./tvDialogs";
import { openShop } from "./shopState";

const GRID_COLS = 4;

export function hostOf(joinUrl: string): string {
  try {
    const u = new URL(joinUrl);
    return u.host;
  } catch {
    return joinUrl.replace(/^[a-z]+:\/\//i, "").replace(/\/.*$/, "");
  }
}

export function TvLobby({ view }: { view: TvView }) {
  // SPEC §9.6: initial focus Start if canStart or NOT_ENOUGH_PLAYERS, else Settings.
  const startFirst = view.canStart || view.startBlocker === "NOT_ENOUGH_PLAYERS";
  const startRef = useRef<HTMLButtonElement>(null);
  const settingsRef = useRef<HTMLButtonElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const lastTile = useRef<string | null>(null);
  const [shake, setShake] = useState(0);
  const [flash, setFlash] = useState(0);
  const prevSettings = useRef(view.settings);
  useEffect(() => {
    if (prevSettings.current !== view.settings && JSON.stringify(prevSettings.current) !== JSON.stringify(view.settings)) setFlash((f) => f + 1);
    prevSettings.current = view.settings;
  }, [view.settings]);
  useEffect(() => {
    const id = setTimeout(() => (startFirst ? startRef : settingsRef).current?.focus(), 30);
    return () => clearTimeout(id);
  }, []);
  const full = view.players.length >= MAX_PLAYERS;
  const s = view.settings;
  const l = locale.value;
  const blocker = blockerText(view);
  const toast = toasts.value.at(-1);
  // PAY-GAP (§4.4 fit rule): Premium · Settings · Language · Start do not fit the 542 dp bar in EN/FR even with an
  // icon-only Premium, so when the bar overflows, Language also becomes icon-only (its name stays the tooltip/label).
  const bar = useRef<HTMLDivElement>(null);
  const [tight, setTight] = useState(false);
  useLayoutEffect(() => {
    const b = bar.current;
    if (!b) return;
    b.classList.remove("is-tight");
    const over = b.scrollWidth > b.clientWidth + 1;
    if (over) b.classList.add("is-tight");
    setTight(over);
  }, [l]);
  const slots = Array.from({ length: MAX_PLAYERS }, (_, i) => view.players[i] ?? null);
  const firstEmpty = view.players.length;
  const onStart = (): void => {
    if (view.canStart) { tvAct({ type: "START" }); return; }
    if (view.startBlocker === "NOT_ENOUGH_PLAYERS") { setShake((x) => x + 1); return; }
    tvScreen.value = "settings";
  };
  const kick = (p: PublicPlayer): void => openDialog({
    title: t("lobby.kickConfirm", { name: isolate(p.name) }), body: t("lobby.kickBody"),
    confirm: t("lobby.kick"), danger: true, onConfirm: () => tvAct({ type: "KICK", playerId: p.id }),
  });
  // DESIGN TV-02: Left/Right stay in the bottom bar (Settings ↔ Language ↔ Start; its ends do not leak into the grid
  // by geometry); Up enters the grid on its last occupied row (or the tile focused last).
  const onBarKey = (e: KeyboardEvent): void => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      const bar = [...(e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>("button")];
      const step = (e.key === "ArrowRight") !== (document.documentElement.dir === "rtl") ? 1 : -1;
      const next = bar[bar.indexOf(e.target as HTMLElement) + step];
      e.preventDefault();
      e.stopPropagation();
      next?.focus();
      return;
    }
    if (e.key !== "ArrowUp" || view.players.length === 0) return;
    const tiles = [...(grid.current?.querySelectorAll<HTMLElement>(".tile--btn") ?? [])];
    const target = tiles.find((n) => n.dataset.pid === lastTile.current)
      ?? tiles[Math.floor((view.players.length - 1) / GRID_COLS) * GRID_COLS];
    if (!target) return;
    e.preventDefault();
    e.stopPropagation();
    target.focus();
  };
  return (
    <div class="tvscreen tvlobby">
      <img class="tvlobby__wordmark" src="/brand/wordmark-latin.svg" alt="Mish Ana!" width={160} height={48} />
      <p class="tvlobby__scan">{t("lobby.scanToJoin")}</p>
      <div class={`tvlobby__qr${full ? " is-full" : ""}`}>
        {full ? <div class="qr qr--full"><Icon name="users" size={48} /><span>{t("lobby.full")}</span></div> : <Qr url={view.joinUrl} />}
      </div>
      <div class={`tvlobby__code${full ? " is-dim" : ""}`}><RoomCode code={view.roomCode} size="big" /></div>
      <p class="tvlobby__host">{t("lobby.orVisit", { url: isolateLtr(hostOf(view.joinUrl)) })}</p>

      <div class="tvlobby__summary" key={flash} data-flash={flash > 0 ? "1" : undefined}>
        {/* §4.4: the premium chip leads the summary; inline, so the summary keeps its two lines above the grid. */}
        <span>{view.premium && <span class="tvlobby__premium"><Icon name="gem" size={20} />{t("lobby.premiumRoom")}</span>}{packsLine(s, view.availablePacks, l)} · {LOCALE_NATIVE_NAME[s.wordLocale]}</span>
        <span>{roleSummaryText(view)} · {t(s.winRule === "official" ? "settings.winRuleOfficial" : "settings.winRuleParity")}</span>
      </div>
      <div class="tvlobby__players">
        <span class="tvlobby__count">{t("lobby.playerCount", { count: view.players.length, max: MAX_PLAYERS })}</span>
        {/* Toast zone: the newest join/leave replaces the blocker line for its 3 s (one at a time, never over a tile). */}
        <span class="tvlobby__status" aria-live="polite">
          {toast
            ? <span key={toast.id} class={`tvtoast tvtoast--inline tvtoast--${toast.tone}`}>{toast.text}</span>
            : blocker && <span class="tvlobby__blocker">{blocker}</span>}
        </span>
      </div>
      <div class="tvgrid" ref={grid} onFocusIn={(e) => { const pid = (e.target as HTMLElement).dataset.pid; if (pid) lastTile.current = pid; }}>
        {slots.map((p, i) => p ? (
          <Tile key={p.id} p={p} focusable onClick={() => kick(p)} class="tile--lobby tile--drop" />
        ) : (
          <div key={`e${i}`} class={`tile tile--empty${i === firstEmpty ? " is-next" : ""}`} aria-hidden="true"><Icon name="plus" size={28} /></div>
        ))}
      </div>
      <div class={`tvbottom tvbottom--lobby${tight ? " is-tight" : ""}`} ref={bar} onKeyDown={onBarKey}>
        {/* PAYMENTS-SPEC §4.4: Premium first, icon-only (the labelled button does not fit the 542 dp bar next to
            Settings, Language and Start), with its fixed label as the focus tooltip and accessible name. */}
        <button type="button" class="tvbtn tvbtn--icon" data-lobby="premium" aria-haspopup="true" aria-label={t("lobby.premium")}
          onClick={() => openShop({ focusProductId: null, origin: "LOBBY_BUTTON" })}>
          <Icon name="gem" /><span class="tvtip" aria-hidden="true">{t("lobby.premium")}</span>
        </button>
        <button type="button" ref={settingsRef} class="tvbtn" data-lobby="settings" data-default-focus={startFirst ? undefined : true} onClick={() => { tvScreen.value = "settings"; }}><Icon name="settings" />{t("lobby.settings")}</button>
        <button type="button" class="tvbtn tvbtn--lang" aria-haspopup="dialog" aria-label={LOCALE_NATIVE_NAME[l]} onClick={openLanguages}>
          <Icon name="globe" /><span class="tvbtn__label">{LOCALE_NATIVE_NAME[l]}</span><span class="tvtip" aria-hidden="true">{LOCALE_NATIVE_NAME[l]}</span>
        </button>
        <button type="button" ref={startRef} key={shake} data-default-focus={startFirst ? true : undefined}
          class={`tvbtn tvbtn--primary tvbtn--start${view.canStart ? "" : " is-disabled"}${shake ? " shake" : ""}`} aria-disabled={!view.canStart} onClick={onStart}>
          <Icon name="play" />{t("lobby.startGame")}
        </button>
      </div>
    </div>
  );
}
