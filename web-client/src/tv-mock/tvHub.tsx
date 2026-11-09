// JAMAA-PLATFORM §3.2 HUB-01 Splash and HUB-02 Hub; geometry from DESIGN-JAMAA §2.1–§2.2 (960 × 540 canvas).
// Top bar (wordmark · cup chip · ⓘ · Pass · Settings), the poster carousel (210 × 290, gap 28, focused ×1.08 at the
// start edge + 24, wraps, mirrored in RTL), the join ticket (gathering 248 / compact 200 wide, never focusable) and the
// members strip (48 dp characters in 72 dp slots, names under them; OK → Kick / Cancel).
import { useEffect, useRef, useState } from "preact/hooks";
import { COLORS } from "@jamaa/shared/constants";
import type { GameId } from "@jamaa/shared/games/ids";
import type { MemberPublic, TvRoomView } from "@jamaa/shared/protocol/v2";
import { fmtNum, isolate, isolateLtr, locale, LOCALE_NATIVE_NAME, t } from "../i18n/t";
import type { MessageKey } from "../i18n/t";
import { toasts, pushToast } from "../state/store";
import { billingEnabled } from "../lib/billingFlag";
import { ellipsizeName } from "../lib/names";
import { Icon } from "../components/Icon";
import { Character, MemberCharacter } from "../components/Character";
import { Poster, WORLD_OF } from "../components/Poster";
import { Qr } from "./Qr";
import { RoomCode } from "./tvParts";
import { focusGame, tvAct, tvCupOpen, tvFocusGame, tvHubSettings } from "./tvStore";
import { openDialog, openPicker, openRules, rememberSideOpener } from "./tvDialogs";
import { openShop } from "./shopState";
import { useInitialFocus } from "./dpad";
import { soundCue } from "./sound/controller";
import { cupStandings } from "../platform/Cup";

/** DESIGN-JAMAA §2.1 numbers. */
export const POSTER_W = 210;
export const POSTER_GAP = 28;
export const GATHER_MS = 60_000;
const STEP = POSTER_W + POSTER_GAP;

export function hostOf(joinUrl: string): string {
  try {
    return new URL(joinUrl).host;
  } catch {
    return joinUrl.replace(/^[a-z]+:\/\//i, "").replace(/\/.*$/, "");
  }
}

/** HUB-01: the 12 characters roll in from the edges into a ring, then the wordmark builds in (≤ 1.2 s). */
export function Splash({ failed, onRetry }: { failed: string | null; onRetry(): void }) {
  const retry = useInitialFocus<HTMLButtonElement>(failed);
  return (
    <div class="tvscreen tvsplash">
      <div class="tvsplash__ring" aria-hidden="true">
        {COLORS.map((c, i) => (
          <span key={c.id} class="tvsplash__ch" style={{ "--i": i, "--a": `${(i / COLORS.length) * 360}deg` }}>
            <Character color={c.id} size={48} expression={i % 3 === 0 ? "happy" : "idle"} />
          </span>
        ))}
      </div>
      <img class="tvsplash__wordmark" src="/brand/wordmark-bilingual.svg" alt="JAMAA جماعة" width={420} height={105} />
      <p class="tvt-body tv-secondary tvsplash__slogan">{t("brand.slogan")}</p>
      <div class="tvsplash__status">
        {failed === null ? (
          <p class="tvt-caption tv-muted"><Icon name="refresh" size={22} class="spin" />{t("tv.creatingRoom")}</p>
        ) : (
          <>
            <p class="tvt-title">{t("tv.createFailed")}</p>
            <p class="tvt-caption tv-muted tnum">{failed}</p>
            <button type="button" ref={retry} class="tvbtn tvbtn--primary" data-default-focus onClick={onRetry}><Icon name="refresh" />{t("common.retry")}</button>
          </>
        )}
      </div>
    </div>
  );
}

const isRtl = (): boolean => document.documentElement.dir === "rtl" || locale.value === "ar";
/** +1 toward the reading end (Right in LTR, Left in RTL), -1 toward the start. */
export function readingDir(key: string, rtl: boolean): 1 | -1 | 0 {
  if (key === "ArrowRight") return rtl ? -1 : 1;
  if (key === "ArrowLeft") return rtl ? 1 : -1;
  return 0;
}

/** Position of game `i` relative to the focused one `f`: -1 (just off the start edge) … n-2 (wrapping). */
export function carouselPos(i: number, f: number, n: number): number {
  if (n <= 1) return 0;
  return (((i - f + 1) % n) + n) % n - 1;
}

function contentLanguageDialog(view: TvRoomView, id: GameId): void {
  const room = view.room;
  const langs = room.contentLocales.filter((l) => l !== room.contentLocale);
  openPicker({
    title: t("hub.switchLanguage.title"),
    body: t("hub.switchLanguage.body", { game: t(`game.${id}.title` as MessageKey) }),
    items: [
      ...langs.map((l) => ({ id: l, label: LOCALE_NATIVE_NAME[l], lang: l, onPick: () => tvAct({ type: "SET_CONTENT_LOCALE", locale: l }) })),
      { id: "keep", label: t("hub.switchLanguage.keep", { language: LOCALE_NATIVE_NAME[room.contentLocale] }), onPick: () => undefined },
    ],
  });
}

const arrivals = new Map<string, number>();

export function TvHub({ view, portalOut, onOpen }: { view: TvRoomView; portalOut?: boolean; onOpen(id: GameId, rect: DOMRect | null): void }) {
  const room = view.room;
  const games = room.games;
  const ids = games.map((g) => g.id);
  const local = tvFocusGame.value;
  const focused: GameId = local && ids.includes(local) ? local : ids.includes(room.focusedGameId) ? room.focusedGameId : ids[0] ?? "mishana";
  const fi = Math.max(0, ids.indexOf(focused));
  const posterRefs = useRef<Partial<Record<GameId, HTMLButtonElement | null>>>({});
  const infoRef = useRef<HTMLButtonElement>(null);
  const firstMember = useRef<HTMLButtonElement>(null);
  const lastPos = useRef<Record<string, number>>({});
  const [launchedAt] = useState(() => Date.now());
  const [, tick] = useState(0);
  const members = room.members.filter((m) => !m.left);
  const gathering = members.length < 3 || Date.now() - launchedAt < GATHER_MS;
  const billing = billingEnabled.value && !room.premium;
  const card = games.find((g) => g.id === focused);
  const cupRows = cupStandings(room).filter((r) => r.stars > 0);
  const toast = toasts.value.at(-1);

  useEffect(() => {
    // The ticket narrows after the first minute (never while the carousel moves: the width change is CSS only).
    const id = setTimeout(() => tick((x) => x + 1), Math.max(0, launchedAt + GATHER_MS - Date.now()) + 50);
    return () => clearTimeout(id);
  }, []);
  // Initial focus: the focused poster (the last played game, else mishana).
  useEffect(() => {
    const id = setTimeout(() => { if (!portalOut) posterRefs.current[focused]?.focus(); }, 30);
    return () => clearTimeout(id);
  }, []);
  // Live join: a toast above the strip and a ring on the newest member until the next join.
  const prevIds = useRef<Set<string> | null>(null);
  const [newest, setNewest] = useState<string | null>(null);
  useEffect(() => {
    const now = new Set(members.map((m) => m.id));
    const before = prevIds.current;
    prevIds.current = now;
    if (!before) return;
    for (const m of members) {
      if (!before.has(m.id)) {
        arrivals.set(m.id, Date.now());
        setNewest(m.id);
        pushToast(t("lobby.joined", { name: isolate(m.name) }), "success", 2500);
      }
    }
  }, [members.map((m) => m.id).join(",")]);

  const moveTo = (id: GameId): void => {
    focusGame(id);
    soundCue("hub_move");
    requestAnimationFrame(() => posterRefs.current[id]?.focus({ preventScroll: true }));
  };
  const onPosterKey = (e: KeyboardEvent, id: GameId): void => {
    const d = readingDir(e.key, isRtl());
    if (d !== 0) {
      e.preventDefault();
      if (ids.length > 1) moveTo(ids[(ids.indexOf(id) + d + ids.length) % ids.length]!);
      return;
    }
    if (e.key === "ArrowUp") { e.preventDefault(); infoRef.current?.focus(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); firstMember.current?.focus(); }
  };
  const toPoster = (e: KeyboardEvent, key: "ArrowDown" | "ArrowUp"): void => {
    if (e.key !== key) return;
    e.preventDefault();
    posterRefs.current[focused]?.focus();
  };
  const open = (id: GameId): void => {
    const g = games.find((x) => x.id === id);
    if (!g) return;
    if (!g.available) { contentLanguageDialog(view, id); return; }
    onOpen(id, posterRefs.current[id]?.getBoundingClientRect() ?? null);
    tvAct({ type: "OPEN_GAME", gameId: id });
  };
  const kickMenu = (m: MemberPublic): void => openDialog({
    title: t("lobby.kickConfirm", { name: isolate(m.name) }), body: t("lobby.kickBody"), confirm: t("lobby.kick"), danger: true,
    onConfirm: () => tvAct({ type: "KICK", playerId: m.id }),
  });
  const n = ids.length;
  const ghosts = Math.max(0, 3 - n);
  const nameMax = members.length > 8 ? 6 : 8;
  const lang = LOCALE_NATIVE_NAME[room.contentLocale];
  const needs = card ? members.length < card.minPlayers : false;
  return (
    <div class={`tvscreen tvhub${gathering ? " is-gathering" : ""}${portalOut ? " is-portal" : ""}`} data-world={WORLD_OF[focused]}>
      <div class="tvhub__tint" data-world={WORLD_OF[focused]} key={focused} aria-hidden="true" />
      <header class="tvhubtop">
        <img class="tvhubtop__mark" src={locale.value === "ar" ? "/brand/wordmark-ar.svg" : "/brand/wordmark-latin.svg"} alt="JAMAA" height={34} />
        <div class="tvhubtop__end">
          {cupRows.length > 0 && (
            <button type="button" class="tvcupchip" onKeyDown={(e) => toPoster(e, "ArrowDown")} onClick={() => { rememberSideOpener(); tvCupOpen.value = true; }} aria-label={t("cup.title")}>
              <Icon name="trophy" size={20} />
              {cupRows.slice(0, 3).map((r, i) => (
                <span key={r.id} class="tvcupchip__who"><Character color={r.color} size={28} expression={i === 0 ? "cheer" : "idle"} crown={i === 0} /><span class="tnum">{fmtNum(r.stars)}</span></span>
              ))}
            </button>
          )}
          <button type="button" ref={infoRef} class="tvround" data-hub-info aria-label={t("rules.open")} onKeyDown={(e) => toPoster(e, "ArrowDown")}
            onClick={() => openRules({ id: focused, hub: true, fromPause: false })}>
            <Icon name="info" size={24} />
          </button>
          {billing && (
            <button type="button" class="tvbtn tvbtn--pass" data-pass onKeyDown={(e) => toPoster(e, "ArrowDown")} onClick={() => openShop({ origin: "LOBBY_BUTTON", focusProductId: null })}>
              <Icon name="gem" size={20} />{t("hub.pass")}
            </button>
          )}
          <button type="button" class="tvround" aria-label={t("hub.settings")} onKeyDown={(e) => toPoster(e, "ArrowDown")} onClick={() => { rememberSideOpener(); tvHubSettings.value = true; }}>
            <Icon name="settings" size={24} />
          </button>
        </div>
      </header>

      <div class="tvcarousel" role="listbox" aria-label={t("hub.title")}>
        {games.map((g, i) => {
          const pos = n > 1 ? carouselPos(i, fi, n) : 0;
          const jump = Math.abs((lastPos.current[g.id] ?? pos) - pos) > 1;
          lastPos.current[g.id] = pos;
          const isF = g.id === focused;
          return (
            <button key={g.id} type="button" role="option" aria-selected={isF} ref={(el) => { posterRefs.current[g.id] = el; }}
              class={`tvposter${isF ? " is-focused" : ""}${jump ? " no-anim" : ""}`} data-game={g.id} data-poster-focus={isF ? "" : undefined} data-default-focus={isF ? true : undefined}
              data-side={i < fi ? "start" : i > fi ? "end" : "self"}
              style={{ "--x": `${24 + pos * STEP}px` }}
              tabIndex={isF ? 0 : -1}
              onFocus={() => { if (!isF) focusGame(g.id); }}
              onKeyDown={(e) => onPosterKey(e, g.id)} onClick={() => open(g.id)}
              aria-label={`${t(`game.${g.id}.title` as MessageKey)}. ${t(`game.${g.id}.tagline` as MessageKey)}`}>
              <Poster id={g.id} script={room.contentLocale} charSize={64}
                passChip={billing && g.lockedPackCount > 0}
                dim={g.available ? null : t("hub.notAvailable", { language: lang })} />
            </button>
          );
        })}
        {Array.from({ length: ghosts }, (_, k) => (
          // JAMAA-GAP: with fewer games than the carousel shows (GAMES_ENABLED="mishana" at launch) the empty slots get
          // quiet outlines (no text, not focusable) so the single poster does not float in an empty stage.
          <span key={`ghost${k}`} class="tvposter tvposter--ghost" aria-hidden="true" style={{ "--x": `${24 + (n + k) * STEP}px` }} />
        ))}
      </div>
      {card && (
        <p class="tvhub__meta" key={focused}>
          <span class={needs ? "tv-danger" : undefined}>{needs ? t("hub.needsPlayers", { count: card.minPlayers }) : t("hub.players", { min: card.minPlayers, max: card.maxPlayers })}</span>
          <span class="tvhub__dot">·</span>
          <span>{t("hub.minutes", { min: card.durationMinutes[0], max: card.durationMinutes[1] })}</span>
          <span class="tvhub__dot">·</span>
          {room.contentLocales.map((l) => <span key={l} class={`tvlangchip${l === room.contentLocale ? " is-on" : ""}`}>{l.toUpperCase()}</span>)}
        </p>
      )}

      <aside class="tvjoin" aria-label={t("hub.joinOnPhone")}>
        <p class="tvjoin__head">{t("hub.joinOnPhone")}</p>
        <Qr url={room.joinUrl} panel={gathering ? 208 : 176} />
        <RoomCode code={room.roomCode} size="big" />
        <p class="tvjoin__url" dir="ltr">{isolateLtr(`${hostOf(room.joinUrl)}/${room.roomCode}`)}</p>
      </aside>

      <div class="tvhub__toast" aria-live="polite">{toast && <div key={toast.id} class={`tvtoast tvtoast--${toast.tone}`}>{toast.text}</div>}</div>
      <ul class="tvmembers" aria-label={t("setup.gang")}>
        {members.length === 0 && (
          <li class="tvmembers__empty">
            {[0, 1, 2].map((k) => <span key={k} class="tvmembers__ghost" aria-hidden="true" />)}
            <span class="tvt-caption tv-muted">{t("hub.waitingGang")}</span>
          </li>
        )}
        {members.map((m, i) => (
          <li key={m.id} class={`tvmember${m.id === newest ? " is-new" : ""}${arrivals.has(m.id) && Date.now() - (arrivals.get(m.id) ?? 0) < 1000 ? " is-drop" : ""}`}>
            <button type="button" ref={i === 0 ? firstMember : undefined} class="tvmember__btn" onKeyDown={(e) => toPoster(e, "ArrowUp")} onClick={() => kickMenu(m)}
              aria-label={m.name}>
              <MemberCharacter m={m} size={48} crown={m.isHost} />
              <bdi class="tvmember__name">{ellipsizeName(m.name, nameMax)}</bdi>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** "Tonight's cup" sheet: the full standings (stars), the last game. */
export function CupSheet({ view }: { view: TvRoomView }) {
  const rows = cupStandings(view.room);
  const close = useInitialFocus<HTMLButtonElement>();
  const top = rows[0]?.stars ?? 0;
  return (
    <div class="tvoverlay tvoverlay--sheet" role="dialog" aria-modal="true" aria-label={t("cup.title")}>
      <div class="tvsheet tvsheet--end">
        <h2 class="tvsheet__title"><Icon name="trophy" size={28} class="tv-accent" />{t("cup.title")}</h2>
        {view.room.cup.last && <p class="tvt-caption tv-muted">{t(`game.${view.room.cup.last.gameId}.title` as MessageKey)}</p>}
        <ol class="tvcuplist">
          {rows.map((r, i) => (
            <li key={r.id} class="tvcuplist__row">
              <span class="tvcuplist__rank tnum">{fmtNum(i + 1)}</span>
              <Character color={r.color} size={40} expression={r.stars === top && top > 0 ? "cheer" : "idle"} crown={r.stars === top && top > 0} />
              <bdi class="tvcuplist__name">{r.name}</bdi>
              <span class="tvcuplist__stars tnum"><Icon name="star" size={20} />{fmtNum(r.stars)}</span>
            </li>
          ))}
        </ol>
        <button type="button" ref={close} class="tvbtn tvbtn--primary tvsheet__close" data-default-focus onClick={() => { tvCupOpen.value = false; }}>{t("common.close")}</button>
      </div>
    </div>
  );
}

/** The focused poster's rect in canvas units (for the portal), from a client rect. */
export function canvasRect(r: DOMRect | null, canvas: HTMLElement | null, scale: number): { x: number; y: number; w: number; h: number } | null {
  if (!r || !canvas) return null;
  const c = canvas.getBoundingClientRect();
  return { x: (r.left - c.left) / scale, y: (r.top - c.top) / scale, w: r.width / scale, h: r.height / scale };
}

