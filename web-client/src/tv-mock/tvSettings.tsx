// TV-03 Settings: categories on the start side, ‹ value › rows on the end side (rows from lib/settingsModel).
// D-pad: toward inline-end from a category enters its rows (the last one focused there, else the first); Left/Right
// step a row's value, OK steps too or opens the Packs / Difficulty sub-panel; Back closes the sub-panel, then returns
// from the rows to the categories, then to the Lobby. Up from the first category or row reaches Done; Down stops at the
// last row; a sub-panel traps the arrows (Kotlin FocusTrap), so only Back or a toggle's own action leaves it.
import { useEffect, useRef, useState } from "preact/hooks";
import type { ComponentChildren, Ref } from "preact";
import type { Settings, SettingsPatch } from "@mishana/shared/engine";
import type { TvView } from "@mishana/shared/protocol";
import { fmtNum, locale, t } from "../i18n/t";
import { rolePreview } from "../lib/lobby";
import {
  CATEGORIES, CATEGORY_HELP, CATEGORY_LABEL, DIFFICULTIES, difficultyLabel, rowValueText, stepRow, toggleDifficulty,
  togglePack, visibleRows,
} from "../lib/settingsModel";
import type { RowDef, SettingsCategory } from "../lib/settingsModel";
import { usePatcher } from "../hooks/usePatcher";
import { Icon } from "../components/Icon";
import { tvAct, tvLastErrorMsg, tvScreen } from "./tvStore";
import { focusables, isBackKey, nearest, useInitialFocus } from "./dpad";
import type { Arrow } from "./dpad";
import { SoundToggle } from "./sound/SoundToggle";

type Sub = null | "packs" | "difficulty";

const isRtl = (): boolean => document.documentElement.dir === "rtl";
/** +1 for the inline-end arrow (Right in LTR, Left in RTL), -1 for inline-start, 0 otherwise. */
function inlineDir(e: KeyboardEvent): 1 | -1 | 0 {
  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return 0;
  return (e.key === "ArrowRight") !== isRtl() ? 1 : -1;
}
const swallow = (e: KeyboardEvent): void => { e.preventDefault(); e.stopPropagation(); };

function SettingRow({ row, s, set, onOpen, onExit }: { row: RowDef; s: Settings; set(p: SettingsPatch): void; onOpen(sub: Exclude<Sub, null>): void; onExit(): void }) {
  const opens = row.kind === "packs" ? "packs" : row.kind === "difficulty" ? "difficulty" : null;
  const step = (dir: 1 | -1): void => { const p = stepRow(row, s, dir); if (p) set(p); };
  const onKey = (e: KeyboardEvent): void => {
    const dir = inlineDir(e);
    if (dir === 0) return;
    swallow(e);
    if (opens) { if (dir < 0) onExit(); return; }
    step(dir);
  };
  const label = row.kind === "points" ? `${t(row.group)} · ${t(row.label)}` : t(row.label);
  return (
    <button type="button" class="setrowtv" data-row={row.id} onKeyDown={onKey} onClick={() => (opens ? onOpen(opens) : step(1))}>
      <span class="setrowtv__label">{label}</span>
      <span class="setrowtv__value">
        {!opens && <span class="setrowtv__chev" onClick={(e) => { e.stopPropagation(); step(-1); }}><Icon name="chevron-back" size={22} /></span>}
        <span class="tnum">{rowValueText(row, s)}</span>
        <span class="setrowtv__chev" onClick={(e) => { e.stopPropagation(); if (opens) onOpen(opens); else step(1); }}><Icon name="chevron-forward" size={22} /></span>
      </span>
    </button>
  );
}

function Toggle({ on, onClick, children, first }: { on: boolean; onClick(): void; children: ComponentChildren; first?: Ref<HTMLButtonElement> }) {
  // The first toggle is the panel's default focus (the focus keeper lands there, not on a category, which would close it).
  return (
    <button type="button" ref={first} class={`tvtoggle${on ? " is-on" : ""}`} aria-pressed={on} onClick={onClick} data-default-focus={first ? true : undefined}>
      {on && <Icon name="check" size={20} />}{children}
    </button>
  );
}

export function TvSettings({ view }: { view: TvView }) {
  const [s, set] = usePatcher(view.settings, (patch) => tvAct({ type: "UPDATE_SETTINGS", patch }), tvLastErrorMsg.value);
  const initialCat: SettingsCategory = view.startBlocker === "INVALID_ROLE_CONFIG" ? "roles" : view.startBlocker === "NO_WORDS_AVAILABLE" ? "words" : "game";
  const [cat, setCat] = useState<SettingsCategory>(initialCat);
  const [sub, setSub] = useState<Sub>(null);
  const [focusRow, setFocusRow] = useState<string | null>(null);
  const lastRow = useRef<Partial<Record<SettingsCategory, string>>>({});
  const rowsBox = useRef<HTMLDivElement>(null);
  const catBox = useRef<HTMLElement>(null);
  const catRef = useInitialFocus<HTMLButtonElement>();
  const doneRef = useRef<HTMLButtonElement>(null);
  const [zone, setZone] = useState<"cats" | "rows" | "sub" | "head">("cats");
  const subFirst = useInitialFocus<HTMLButtonElement>(sub);
  const rows = visibleRows(cat, s);
  const preview = rolePreview(view);

  const focusCategory = (): void => catBox.current?.querySelector<HTMLElement>(".tvcat.is-on")?.focus();
  const focusRowId = (id: string | undefined): void => {
    const box = rowsBox.current;
    (box?.querySelector<HTMLElement>(`[data-row="${id}"]`) ?? box?.querySelector<HTMLElement>("[data-row]"))?.focus();
  };
  const closeSub = (): void => {
    const opener = sub === "packs" ? "packIds" : "difficulties";
    setSub(null);
    setTimeout(() => focusRowId(opener), 0);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!isBackKey(e)) return;
      swallow(e);
      if (sub) { closeSub(); return; }
      if ((document.activeElement as HTMLElement | null)?.closest(".tvsettings__rows")) { focusCategory(); return; }
      tvScreen.value = "main";
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [sub]);

  // Up/Down inside the rows (and every arrow inside a sub-panel) never leak to the categories by geometry.
  const onRowsKey = (e: KeyboardEvent): void => {
    if (!e.key.startsWith("Arrow") || e.defaultPrevented) return;
    const box = rowsBox.current;
    const cur = document.activeElement as HTMLElement | null;
    if (!box || !cur) return;
    if (sub) {
      swallow(e);
      const others = focusables(box).filter((n) => n !== cur);
      nearest(cur.getBoundingClientRect(), others.map((el) => ({ el, rect: el.getBoundingClientRect() })), e.key as Arrow)?.focus();
      return;
    }
    const list = [...box.querySelectorAll<HTMLElement>("[data-row]")];
    const i = list.indexOf(cur);
    if (i === list.length - 1 && e.key === "ArrowDown") swallow(e);
    else if (i === 0 && e.key === "ArrowUp") { swallow(e); doneRef.current?.focus(); }
  };
  const onFocusIn = (e: FocusEvent): void => {
    const el = e.target as HTMLElement;
    setZone(el.closest(".tvsub") ? "sub" : el.closest(".tvsettings__rows") ? "rows" : el.closest(".tvsettings__cats") ? "cats" : "head");
  };

  const focused = rows.find((r) => r.id === focusRow);
  const rowHelp = focused?.kind === "enum" ? focused.help?.(s) : undefined;
  const catHelp = CATEGORY_HELP[cat];
  const help = rowHelp ? t(rowHelp) : catHelp ? t(catHelp) : cat === "roles" ? preview?.text : undefined;
  const helpDanger = cat === "roles" && !rowHelp && !catHelp && preview?.invalid === true;
  const l = locale.value;

  return (
    <div class="tvscreen tvsettings" onFocusIn={onFocusIn}>
      <header class="tvsettings__head">
        <h1 class="tvsettings__title">{t("settings.title")}</h1>
        <div class="tvsettings__actions">
          {/* A TV-only device setting (not a game setting): never sent to the server. */}
          <SoundToggle class="tvbtn" />
          <button type="button" ref={doneRef} class="tvbtn" onClick={() => { tvScreen.value = "main"; }}><Icon name="check" />{t("common.done")}</button>
        </div>
      </header>
      <nav class="tvsettings__cats" ref={catBox} aria-label={t("settings.title")}>
        {CATEGORIES.map((c) => (
          <button key={c} type="button" ref={c === initialCat ? catRef : undefined} class={`tvcat${cat === c ? " is-on" : ""}`}
            data-default-focus={cat === c && !sub ? true : undefined} aria-current={cat === c ? "true" : undefined}
            onFocus={() => { setCat(c); setSub(null); }} onClick={() => setCat(c)}
            onKeyDown={(e) => {
              if (inlineDir(e) === 1) { swallow(e); focusRowId(lastRow.current[c]); }
              else if (e.key === "ArrowUp" && c === CATEGORIES[0]) { swallow(e); doneRef.current?.focus(); }
            }}>
            {t(CATEGORY_LABEL[c])}
          </button>
        ))}
      </nav>
      <section class="tvsettings__panel">
        <div class="tvsettings__rows" ref={rowsBox} onKeyDown={onRowsKey}>
          {sub === "packs" ? (
            <div class="tvsub">
              <Toggle first={subFirst} on={s.packIds.length === 0} onClick={() => set({ packIds: [] })}>{t("settings.allPacks")}</Toggle>
              {view.availablePacks.map((p) => (
                <Toggle key={p.id} on={s.packIds.includes(p.id)} onClick={() => set(togglePack(s, p.id))}>
                  <bdi>{p.title[l]}</bdi><span class="muted num">{fmtNum(p.pairCount)}</span>
                  {p.ageRating === "teen" && <span class="tvtag">{t("settings.packTeen")}</span>}
                </Toggle>
              ))}
            </div>
          ) : sub === "difficulty" ? (
            <div class="tvsub">
              {DIFFICULTIES.map((d, i) => (
                <Toggle key={d} first={i === 0 ? subFirst : undefined} on={s.difficulties.includes(d)} onClick={() => { const p = toggleDifficulty(s, d); if (p) set(p); }}>
                  {difficultyLabel(d)}
                </Toggle>
              ))}
            </div>
          ) : (
            rows.map((r) => (
              <div key={r.id} onFocusIn={() => { setFocusRow(r.id); lastRow.current[cat] = r.id; }}>
                <SettingRow row={r} s={s} set={set} onOpen={setSub} onExit={focusCategory} />
              </div>
            ))
          )}
        </div>
        {help && !sub && <p class={`tvsettings__help${helpDanger ? " is-danger" : ""}`}>{help}</p>}
      </section>
      {/* What Back does from here: rows → categories, categories (or Done) → lobby; a sub-panel closes itself. */}
      <p class="tvsettings__foot">{t("settings.applies")}{zone !== "sub" && <> · <span class="tv-muted">{t(zone === "rows" ? "tv.backToCategories" : "tv.backToLobby")}</span></>}</p>
    </div>
  );
}
