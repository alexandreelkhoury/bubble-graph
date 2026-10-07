// TV-02 Lobby.
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { MAX_PLAYERS, MIN_PLAYERS } from "@mishana/shared/constants";
import type { PublicPlayer, TvView } from "@mishana/shared/protocol";
import { fmtNum, isolate, isolateLtr, locale, LOCALE_NATIVE_NAME, t } from "../i18n/t";
import { activeCount, blockerText, packsLine, roleSummaryText } from "../lib/lobby";
import { createArrivals, isFresh, noteArrivals } from "../lib/arrivals";
import { Slot } from "../components/UI";
import { toasts } from "../state/store";
import { Icon } from "../components/Icon";
import { Qr } from "./Qr";
import { RoomCode, Tile } from "./tvParts";
import { tvAct, tvScreen } from "./tvStore";
import { openDialog, openLanguages } from "./tvDialogs";
import { openShop } from "./shopState";
import { billingEnabled } from "../lib/billingFlag";

const GRID_COLS = 4;
/** TV-02 QR panel inside the join ticket (dp). */
const QR_PANEL = 208;
const arrivals = createArrivals();

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
    const measure = (): void => {
      const b = bar.current;
      if (!b) return;
      b.classList.remove("is-tight");
      const over = b.scrollWidth > b.clientWidth + 1;
      if (over) b.classList.add("is-tight");
      setTight(over);
    };
    measure();
    // Measured again once the web fonts are in: a fallback font is wider and would leave the bar icon-only for good.
    let live = true;
    void document.fonts?.ready.then(() => { if (live) measure(); });
    return () => { live = false; };
  }, [l, billingEnabled.value]);
  const slots = Array.from({ length: MAX_PLAYERS }, (_, i) => view.players[i] ?? null);
  // B4/B15: only a new player's tile drops in; the newest keeps a ring in their colour until the next join.
  const now = Date.now();
  noteArrivals(arrivals, view.roomCode, view.gameNumber, view.players.map((p) => p.id), now);
  // After "Play again" the tiles carry the running totals (the replay hook: "I'm 2 points behind").
  const topScore = Math.max(0, ...view.players.map((p) => p.score));
  // B5: the settings chips wait for a startable room (the QR owns the empty lobby); until then, on a fresh room, the
  // browser TV says how to drive it without a remote.
  const startable = activeCount(view) >= MIN_PLAYERS;
  const rc = view.roleCounts;
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
      <img class="tvlobby__wordmark" src="/brand/wordmark-latin.svg" alt="Mish Ana!" width={196} height={59} />
      {/* One join "ticket": the caption, QR, code and URL read as a single object. */}
      <div class="tvticket">
        <p class="tvticket__scan">{t("lobby.scanToJoin")}</p>
        <div class={`tvticket__qr${full ? " is-full" : ""}`}>
          {full
            ? <div class="qr qr--full" style={{ width: `${QR_PANEL}px`, height: `${QR_PANEL}px` }}><Icon name="users" size={48} /><span>{t("lobby.full")}</span></div>
            : <Qr url={view.joinUrl} panel={QR_PANEL} />}
        </div>
        <div class={`tvticket__code${full ? " is-dim" : ""}`}><RoomCode code={view.roomCode} size="big" /></div>
        <p class="tvticket__url"><Slot k="lobby.orVisit" slot="url"><b>{isolateLtr(hostOf(view.joinUrl))}</b></Slot></p>
      </div>

      {startable ? (
        <div class="tvlobby__summary" key={flash} data-flash={flash > 0 ? "1" : undefined}>
          {/* §4.4: the premium chip leads the summary. The win rule lives in Settings. */}
          {view.premium && billingEnabled.value && <span class="tvsumchip tvlobby__premium"><Icon name="gem" size={20} />{t("lobby.premiumRoom")}</span>}
          <span class="tvsumchip tvsumchip--text">{packsLine(s, view.availablePacks, l)}</span>
          <span class="tvsumchip">{LOCALE_NATIVE_NAME[s.wordLocale]}</span>
          {rc ? (
            <span class="tvsumchip tnum" role="img" aria-label={roleSummaryText(view)}>
              <i class="tvsumchip__dot tvsumchip__dot--civilian" />{fmtNum(rc.civilian)}
              {rc.blank > 0 && <><i class="tvsumchip__dot tvsumchip__dot--blank" />{fmtNum(rc.blank)}</>}
              {rc.undercover > 0 && <><i class="tvsumchip__dot tvsumchip__dot--undercover" />{fmtNum(rc.undercover)}</>}
            </span>
          ) : <span class="tvsumchip">{roleSummaryText(view)}</span>}
        </div>
      ) : view.gameNumber === 0 && (
        <p class="tvlobby__tip">{t("tv.browserTip")}</p>
      )}
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
          <Tile key={p.id} p={p} focusable onClick={() => kick(p)}
            class={`tile--lobby${isFresh(arrivals, p.id, now) ? " tile--drop" : ""}${arrivals.newest === p.id ? " tile--newest" : ""}`}>
            {topScore > 0 && (
              <span class={`tvscore tnum${p.score === topScore ? " is-lead" : ""}`}>
                <bdi class="num">{fmtNum(p.score)}</bdi>
              </span>
            )}
          </Tile>
        ) : (
          <div key={`e${i}`} class={`tile tile--empty${i === firstEmpty ? " is-next" : ""}`} aria-hidden="true"><Icon name="plus" size={28} /></div>
        ))}
      </div>
      <div class={`tvbottom tvbottom--lobby${tight ? " is-tight" : ""}`} ref={bar} onKeyDown={onBarKey}>
        {/* PAYMENTS-SPEC §4.4: Premium first, icon-only (the labelled button does not fit the 542 dp bar next to
            Settings, Language and Start), with its fixed label as the focus tooltip and accessible name. */}
        {billingEnabled.value && (
          <button type="button" class="tvbtn tvbtn--icon" data-lobby="premium" aria-haspopup="true" aria-label={t("lobby.premium")}
            onClick={() => openShop({ focusProductId: null, origin: "LOBBY_BUTTON" })}>
            <Icon name="gem" /><span class="tvtip" aria-hidden="true">{t("lobby.premium")}</span>
          </button>
        )}
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
