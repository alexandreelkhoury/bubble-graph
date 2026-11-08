// JAMAA-PLATFORM §3.2 HUB-03 Setup (game detail); geometry DESIGN-JAMAA §2.3 / §2.5 / §7.2 / §7.4.
// Title strip ("‹ Games" hint, lockup, ⓘ) · How to play pane (auto-advancing card, OK replays the full-screen intro) ·
// Players pane (characters on a stage, ghosts up to minPlayers, QR) · Settings pane (Content, ≤ 4 rows, Advanced, Start).
// First visit on this TV: the full-screen intro (cards auto-advance after 6 s, any D-pad pauses, OK next, Back skips,
// the last card waits on "Got it"). Initial focus: Start only if the intro was seen and canStart.
import { useEffect, useRef, useState } from "preact/hooks";
import type { GameId } from "@jamaa/shared/games/ids";
import { GAME_META } from "@jamaa/shared/games/meta";
import type { RoomSetup, TvRoomView } from "@jamaa/shared/protocol/v2";
import { LOCALE_NATIVE_NAME, t, titleIn } from "../i18n/t";
import { advancedRows, basicRows, blockerLine } from "../lib/gameSettings";
import type { Patch, Row } from "../lib/gameSettings";
import { billingEnabled } from "../lib/billingFlag";
import { ellipsizeName } from "../lib/names";
import { Icon } from "../components/Icon";
import { MemberCharacter } from "../components/Character";
import { Dots, HowToCard, howToKeys } from "../components/HowTo";
import { TitleLockup, WORLD_OF } from "../components/Poster";
import { Qr } from "./Qr";
import { RoomCode } from "./tvParts";
import { tvAct, tvAdvanced, tvIntro, tvPackPicker } from "./tvStore";
import { openPicker, openRules, rememberSideOpener } from "./tvDialogs";
import { openShop } from "./shopState";
import { useInitialFocus } from "./dpad";
import { choreoActive, markTvIntroSeen, tvIntroSeen } from "./tvPlatform";
import { readingDir } from "./tvHub";
import { locale } from "../i18n/t";

export const INTRO_AUTO_MS = 6000;
const isRtl = (): boolean => locale.value === "ar";

function send(setup: RoomSetup, patch: Patch | null): void {
  if (patch) tvAct({ type: "UPDATE_GAME_SETTINGS", gameId: setup.gameId, patch } as Parameters<typeof tvAct>[0]);
}

/** HUB-03 full-screen intro (DESIGN-JAMAA §2.5, §7.4). */
export function TvIntro({ view, id, onClose }: { view: TvRoomView; id: GameId; onClose(): void }) {
  const n = howToKeys(id).length;
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const last = i === n - 1;
  const got = useInitialFocus<HTMLButtonElement>(last);
  const nextRef = useInitialFocus<HTMLButtonElement>();
  useEffect(() => { if (last) markTvIntroSeen(id); }, [last]);
  useEffect(() => {
    if (paused || last) return;
    const tm = setTimeout(() => setI((x) => Math.min(n - 1, x + 1)), INTRO_AUTO_MS);
    return () => clearTimeout(tm);
  }, [i, paused, last]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => { if (e.key.startsWith("Arrow")) setPaused(true); };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);
  const room = view.room;
  const members = room.members.filter((m) => !m.left);
  const gathering = members.length < GAME_META[id].minPlayers;
  return (
    <div class="tvoverlay tvoverlay--solid tvintro" data-world={WORLD_OF[id]} role="dialog" aria-modal="true" aria-label={t("howto.title")} data-intro>
      <div class="tvintro__stage" aria-hidden="true" />
      <header class="tvintro__head">
        <TitleLockup id={id} script={room.contentLocale} class="tvintro__lockup" />
        <span class="tvt-caption tv-muted">{t("setup.introHint")}</span>
      </header>
      <div class="tvintro__card" key={i}>
        <HowToCard id={id} index={i} size={96} class="howto__card--tv" />
      </div>
      <div class="tvintro__progress" aria-hidden="true">
        {Array.from({ length: n }, (_, k) => <i key={k} class={k < i ? "is-done" : k === i ? (paused || last ? "is-on is-held" : "is-on") : undefined} />)}
      </div>
      <div class="tvintro__actions">
        {last
          ? <button type="button" ref={got} class="tvbtn tvbtn--primary" data-default-focus data-intro-done onClick={() => { markTvIntroSeen(id); onClose(); }}>{t("setup.gotIt")}</button>
          : <button type="button" ref={nextRef} class="tvbtn" data-default-focus data-intro-next onClick={() => { setPaused(true); setI((x) => Math.min(n - 1, x + 1)); }}>{t("setup.next")}<Icon name="arrow-forward" class="flip-rtl" /></button>}
      </div>
      {gathering && (
        <aside class="tvintro__join" aria-label={t("hub.joinOnPhone")}>
          <Qr url={room.joinUrl} panel={144} />
          <RoomCode code={room.roomCode} />
        </aside>
      )}
      {gathering && (
        <ul class="tvintro__members">
          {members.map((m) => <li key={m.id}><MemberCharacter m={m} size={48} crown={m.isHost} /><bdi>{ellipsizeName(m.name, 8)}</bdi></li>)}
        </ul>
      )}
    </div>
  );
}

function SettingRow({ row, setup, locked, refCb, onLeft, onPacks }: { row: Row; setup: RoomSetup; locked: boolean; refCb?: (el: HTMLButtonElement | null) => void; onLeft(e: KeyboardEvent): void; onPacks(): void }) {
  const steppable = !!row.step && !locked;
  return (
    <button type="button" ref={refCb} class={`tvsrow${row.sub ? " tvsrow--sub" : ""}${locked ? " is-locked" : ""}`} data-row={row.id}
      onKeyDown={(e) => {
        const d = readingDir(e.key, isRtl());
        if (d === 0) return;
        if (steppable) {
          // JAMAA-GAP: §3.2 says both "Left/Right steps a value" and "Left from any row → the how-to pane". Rows with a
          // value to step keep Left/Right for stepping (as today); every other row sends Left to the how-to pane.
          e.preventDefault();
          send(setup, row.step!(d));
          return;
        }
        if (d === -1) onLeft(e);
      }}
      onClick={() => {
        if (locked) { if (billingEnabled.value) openShop({ origin: "LOCKED_SETTING", focusProductId: null }); return; }
        if (row.packs) { onPacks(); return; }
        if (row.step) send(setup, row.step(1));
      }}>
      <span class="tvsrow__label">{row.label}{row.premium && <Icon name="gem" size={18} class="tv-accent" />}</span>
      <span class="tvsrow__value">
        {steppable && <Icon name="chevron-back" size={20} class="tvsrow__chev flip-rtl" />}
        <bdi>{row.value}</bdi>
        {steppable && <Icon name="chevron-forward" size={20} class="tvsrow__chev flip-rtl" />}
        {row.packs && <Icon name="chevron-forward" size={20} class="tvsrow__chev flip-rtl" />}
        {locked && <span class="tvpasschip"><Icon name="gem" size={16} />{t("hub.passChip")}</span>}
      </span>
    </button>
  );
}

/** HUB-03 pack picker (end sheet, 420 dp): toggles packs; locked rows open the Pass store (billing on). */
export function PackPicker({ setup }: { setup: RoomSetup }) {
  const first = useInitialFocus<HTMLButtonElement>();
  const sel = new Set((setup.settings as { packIds?: string[] }).packIds ?? []);
  return (
    <div class="tvoverlay tvoverlay--clear" role="dialog" aria-modal="true" aria-label={t("setup.packs")}>
      <div class="tvsheet tvsheet--end tvsheet--solid">
        <h2 class="tvsheet__title">{t("setup.packs")}</h2>
        <div class="tvmenu tvmenu--scroll" data-scroll>
          {setup.availablePacks.map((p, i) => {
            const on = sel.has(p.id) || sel.has(p.family);
            return (
              <button key={p.id} type="button" ref={i === 0 ? first : undefined} data-default-focus={i === 0 ? true : undefined}
                role="checkbox" aria-checked={on} class={`tvmenu__item tvpack${on ? " is-on" : ""}`}
                onClick={() => {
                  const next = on ? [...sel].filter((x) => x !== p.id && x !== p.family) : [...sel, p.id];
                  if (next.length > 0) send(setup, { packIds: next });
                }}>
                <span class="tvpack__box" aria-hidden="true">{on && <Icon name="check" size={18} />}</span>
                <bdi class="tvpack__title">{titleIn(p.title)}</bdi>
                <span class="tvpack__meta tnum">{p.pairCount}</span>
              </button>
            );
          })}
          {setup.lockedPacks.map((p) => (
            <button key={p.id} type="button" class="tvmenu__item tvpack is-locked" data-locked-pack={p.id}
              onClick={() => { if (billingEnabled.value) openShop({ origin: "LOCKED_PACK", focusProductId: p.productId }); }}>
              <span class="tvpack__box" aria-hidden="true"><Icon name="lock" size={16} /></span>
              <bdi class="tvpack__title">{titleIn(p.title)}</bdi>
              <span class="tvpasschip"><Icon name="gem" size={16} />{t("hub.passChip")}</span>
            </button>
          ))}
        </div>
        <button type="button" class="tvbtn tvsheet__close" onClick={() => { tvPackPicker.value = false; }}>{t("common.done")}</button>
      </div>
    </div>
  );
}

/** "Advanced" (Mish Ana!'s extra settings) as an end sheet of the same rows. */
export function AdvancedSheet({ view, setup }: { view: TvRoomView; setup: RoomSetup }) {
  const first = useRef<HTMLButtonElement | null>(null);
  useEffect(() => { const id = setTimeout(() => first.current?.focus(), 30); return () => clearTimeout(id); }, []);
  const rows = advancedRows(setup);
  return (
    <div class="tvoverlay tvoverlay--clear" role="dialog" aria-modal="true" aria-label={t("setup.advanced")}>
      <div class="tvsheet tvsheet--end tvsheet--solid">
        <h2 class="tvsheet__title">{t("setup.advanced")}</h2>
        <div class="tvsrows tvmenu--scroll" data-scroll>
          {rows.map((r, i) => (
            <SettingRow key={r.id} row={r} setup={setup} locked={r.premium && !view.room.premium} refCb={i === 0 ? (el) => { first.current = el; } : undefined}
              onLeft={() => undefined} onPacks={() => { rememberSideOpener(); tvPackPicker.value = true; }} />
          ))}
        </div>
        <button type="button" class="tvbtn tvsheet__close" onClick={() => { tvAdvanced.value = false; }}>{t("common.done")}</button>
      </div>
    </div>
  );
}

export function TvSetup({ view, entering }: { view: TvRoomView; entering: number | null }) {
  const room = view.room;
  const setup = room.setup;
  const id: GameId = room.setupGameId ?? setup?.gameId ?? "mishana";
  const meta = GAME_META[id];
  // The first time this game's setup opens on this TV, the how-to opens full screen (Back skips it: closeTopOverlay).
  useState(() => { tvIntro.value = tvIntroSeen(id) ? null : id; return 0; });
  const intro = tvIntro.value === id;
  const setIntro = (on: boolean): void => { tvIntro.value = on ? id : null; };
  const [card, setCard] = useState(0);
  const [howFocused, setHowFocused] = useState(false);
  const howRef = useRef<HTMLButtonElement>(null);
  const infoRef = useRef<HTMLButtonElement>(null);
  const startRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLButtonElement>(null);
  const firstRowRef = useRef<HTMLButtonElement | null>(null);
  const cameFrom = useRef<HTMLElement | null>(null);
  const members = room.members.filter((m) => !m.left);
  const missing = Math.max(0, meta.minPlayers - members.length);
  const nCards = howToKeys(id).length;

  // The collapsed how-to pane auto-advances every 6 s while it is not focused.
  useEffect(() => {
    if (howFocused || intro) return;
    const tm = setTimeout(() => setCard((c) => (c + 1) % nCards), INTRO_AUTO_MS);
    return () => clearTimeout(tm);
  }, [card, howFocused, intro]);
  // §3.10 E rule 4: initial focus after the portal (and after the intro closes).
  const focusInitial = (): void => {
    const seen = tvIntroSeen(id);
    const target = seen && setup?.canStart ? startRef.current : !seen ? howRef.current : firstRowRef.current ?? contentRef.current ?? startRef.current;
    target?.focus();
  };
  useEffect(() => {
    if (intro || choreoActive.value) return;
    const tm = setTimeout(focusInitial, 40);
    return () => clearTimeout(tm);
  }, [intro, choreoActive.value]);

  if (!setup) return <div class="tvscreen tvsetup" data-world={WORLD_OF[id]} />;
  const basic = basicRows(setup);
  const hasAdvanced = advancedRows(setup).length > 0;
  const blocker = blockerLine(setup, members.length, meta.minPlayers);
  const toHow = (e: KeyboardEvent): void => {
    e.preventDefault();
    cameFrom.current = e.currentTarget as HTMLElement;
    howRef.current?.focus();
  };
  const columnKey = (e: KeyboardEvent, up?: boolean): void => {
    if (readingDir(e.key, isRtl()) === -1) { toHow(e); return; }
    if (up && e.key === "ArrowUp") { e.preventDefault(); infoRef.current?.focus(); }
    if (e.key === "ArrowDown" && e.currentTarget === startRef.current) e.preventDefault(); // Down from Start → nothing
  };
  const contentDialog = (): void => openPicker({
    title: t("setup.contentTitle"),
    items: room.contentLocales.map((l) => ({ id: l, label: LOCALE_NATIVE_NAME[l], lang: l, onPick: () => tvAct({ type: "SET_CONTENT_LOCALE", locale: l }) })),
  });
  const k = entering ?? 1;
  return (
    <div class={`tvscreen tvsetup${entering !== null ? " is-entering" : ""}`} data-world={WORLD_OF[id]} style={{ "--k": k }}>
      <div class="tvworld" data-world={WORLD_OF[id]} aria-hidden="true" />
      <header class="tvsetup__strip">
        <span class="tvt-caption tv-muted tvsetup__back"><Icon name="chevron-back" size={20} class="flip-rtl" />{t("hub.title")}</span>
        <TitleLockup id={id} script={room.contentLocale} class="tvsetup__lockup" />
        <button type="button" ref={infoRef} class="tvround" data-setup-info aria-label={t("rules.open")}
          onKeyDown={(e) => { if (e.key === "ArrowDown") { e.preventDefault(); howRef.current?.focus(); } }}
          onClick={() => openRules({ id, hub: false, fromPause: false })}><Icon name="info" size={24} /></button>
      </header>

      <button type="button" ref={howRef} class="tvpane tvpane--how" data-howto aria-label={t("howto.title")}
        onFocus={() => setHowFocused(true)} onBlur={() => setHowFocused(false)}
        onKeyDown={(e) => {
          if (readingDir(e.key, isRtl()) === 1) { e.preventDefault(); (cameFrom.current ?? firstRowRef.current ?? contentRef.current)?.focus(); }
          else if (e.key === "ArrowUp") { e.preventDefault(); infoRef.current?.focus(); }
          else if (e.key === "ArrowDown" || readingDir(e.key, isRtl()) === -1) e.preventDefault();
        }}
        onClick={() => { setCard(0); setIntro(true); }}>
        <span class="tvpane__label"><Icon name="play" size={18} />{t("howto.title")}</span>
        <HowToCard id={id} index={card % nCards} size={64} class="howto__card--pane" />
        <Dots n={nCards} i={card % nCards} />
      </button>

      <section class="tvpane tvpane--players" aria-label={t("setup.gang")}>
        <p class="tvpane__label"><Icon name="users" size={18} />{t("setup.gang")}</p>
        <ul class="tvcast">
          {members.map((m) => (
            <li key={m.id}><MemberCharacter m={m} size={members.length > 6 ? 48 : 64} crown={m.isHost} base="happy" /><bdi>{ellipsizeName(m.name, 8)}</bdi></li>
          ))}
          {Array.from({ length: missing }, (_, g) => <li key={`g${g}`} class="tvcast__ghost" aria-hidden="true"><span /></li>)}
        </ul>
        {missing > 0 && <p class="tvt-caption tv-accent tvcast__need">{t("setup.needMore", { count: missing })}</p>}
        <div class={`tvpane__qr${missing > 0 ? " is-big" : ""}`}>
          <Qr url={room.joinUrl} panel={missing > 0 ? 136 : 96} />
          <RoomCode code={room.roomCode} />
        </div>
      </section>

      <section class="tvpane tvpane--settings" aria-label={t("settings.title")}>
        <button type="button" ref={contentRef} class="tvsrow tvsrow--content" data-row="content" onKeyDown={(e) => columnKey(e, true)} onClick={contentDialog}>
          <span class="tvsrow__label">{t("setup.contentTitle")}</span>
          <span class="tvsrow__value"><bdi lang={room.contentLocale}>{LOCALE_NATIVE_NAME[room.contentLocale]}</bdi><Icon name="chevron-down" size={20} class="tvsrow__chev" /></span>
        </button>
        {basic.map((r, i) => (
          <SettingRow key={r.id} row={r} setup={setup} locked={r.premium && !room.premium}
            refCb={i === 0 ? (el) => { firstRowRef.current = el; } : undefined} onLeft={toHow}
            onPacks={() => { rememberSideOpener(); tvPackPicker.value = true; }} />
        ))}
        {hasAdvanced && (
          <button type="button" class="tvsrow tvsrow--adv" data-row="advanced" onKeyDown={(e) => columnKey(e)} onClick={() => { rememberSideOpener(); tvAdvanced.value = true; }}>
            <span class="tvsrow__label">{t("setup.advanced")}</span><Icon name="chevron-forward" size={20} class="tvsrow__chev flip-rtl" />
          </button>
        )}
        <div class="tvsetup__startwrap">
          {blocker && <p class="tvt-caption tv-danger tvsetup__blocker">{blocker}</p>}
          <button type="button" ref={startRef} class={`tvbtn tvbtn--primary tvbtn--start${setup.canStart ? "" : " is-disabled"}`} data-start
            aria-disabled={!setup.canStart} onKeyDown={(e) => columnKey(e)} onClick={() => { if (setup.canStart) tvAct({ type: "START_GAME" }); }}>
            <Icon name="play" />{t("setup.start")}
          </button>
        </div>
      </section>
      {intro && <TvIntro view={view} id={id} onClose={() => { setIntro(false); }} />}
    </div>
  );
}
