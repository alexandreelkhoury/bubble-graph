// JAMAA-PLATFORM §3.3 PHH-03 / §3.5: the setup rows on the phone, from the same model as the TV (lib/gameSettings):
// the content language, ≤ 4 basic rows, then "Advanced". Read-only for everyone but the VIP; the VIP steps values with
// ‹ › buttons (sent at once, UPDATE_GAME_SETTINGS) and picks packs in a sheet. Phones never show a price or a buy
// button: a locked pack or premium value says "Unlock on the TV" (PAYMENTS-SPEC §5.1).
import { useState } from "preact/hooks";
import { LOCALES } from "@jamaa/shared/constants";
import type { Locale } from "@jamaa/shared/constants";
import type { RoomPublic, RoomSetup } from "@jamaa/shared/protocol/v2";
import { LOCALE_NATIVE_NAME, locale, t, titleIn } from "../i18n/t";
import { act, gameModules } from "../state/session";
import { pushToast } from "../state/store";
import { advancedRows, basicRows } from "../lib/gameSettings";
import type { Patch, Row } from "../lib/gameSettings";
import { Icon } from "../components/Icon";
import { Sheet } from "../components/UI";

function send(setup: RoomSetup, patch: Patch | null): void {
  if (!patch) return;
  act({ type: "UPDATE_GAME_SETTINGS", gameId: setup.gameId, patch } as Parameters<typeof act>[0]);
}

function RowView({ row, setup, edit, locked, onPacks }: { row: Row; setup: RoomSetup; edit: boolean; locked: boolean; onPacks(): void }) {
  const can = edit && !locked;
  return (
    <li class={`srow${row.sub ? " srow--sub" : ""}${locked ? " is-locked" : ""}`}>
      <span class="srow__label">{row.label}{row.premium && <Icon name="gem" size={16} class="srow__gem" />}</span>
      {row.packs ? (
        <button type="button" class="srow__value srow__value--btn" disabled={!edit} onClick={onPacks}>
          <span>{row.value}</span>{edit && <Icon name="chevron-forward" size={18} class="flip-rtl" />}
        </button>
      ) : can && row.step ? (
        <span class="srow__stepper">
          <button type="button" class="srow__step" aria-label={`${row.label} −`} onClick={() => send(setup, row.step!(-1))}><Icon name="chevron-back" size={20} class="flip-rtl" /></button>
          <output class="srow__value" aria-live="polite">{row.value}</output>
          <button type="button" class="srow__step" aria-label={`${row.label} +`} onClick={() => send(setup, row.step!(1))}><Icon name="chevron-forward" size={20} class="flip-rtl" /></button>
        </span>
      ) : locked && edit ? (
        <button type="button" class="srow__value srow__value--btn" onClick={() => pushToast(t("error.premiumRequired"), "error")}>
          <span>{row.value}</span><span class="passchip"><Icon name="gem" size={14} />{t("hub.passChip")}</span>
        </button>
      ) : (
        <span class="srow__value">{row.value}</span>
      )}
    </li>
  );
}

function PacksSheet({ setup, open, onClose }: { setup: RoomSetup; open: boolean; onClose(): void }) {
  const sel = new Set((setup.settings as { packIds?: string[] }).packIds ?? []);
  const toggle = (id: string): void => {
    const next = sel.has(id) ? [...sel].filter((x) => x !== id) : [...sel, id];
    if (next.length === 0) return; // at least one pack stays on
    send(setup, { packIds: next });
  };
  return (
    <Sheet open={open} onClose={onClose} title={t("setup.packs")} closable>
      <ul class="packlist">
        {setup.availablePacks.map((p) => {
          const on = sel.has(p.id) || sel.has(p.family);
          return (
            <li key={p.id}>
              <button type="button" role="checkbox" aria-checked={on} class={`packrow${on ? " is-on" : ""}`} onClick={() => toggle(p.id)}>
                <span class="packrow__box" aria-hidden="true">{on && <Icon name="check" size={16} />}</span>
                <span class="packrow__title"><bdi>{titleIn(p.title)}</bdi></span>
                <span class="packrow__count tnum">{p.pairCount}</span>
              </button>
            </li>
          );
        })}
        {setup.lockedPacks.map((p) => (
          <li key={p.id}>
            <button type="button" class="packrow is-locked" onClick={() => pushToast(t("error.packLocked"), "error")}>
              <span class="packrow__box" aria-hidden="true"><Icon name="lock" size={14} /></span>
              <span class="packrow__title"><bdi>{titleIn(p.title)}</bdi></span>
              <span class="passchip"><Icon name="gem" size={14} />{t("settings.unlockOnTv")}</span>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

function ContentSheet({ room, open, onClose }: { room: RoomPublic; open: boolean; onClose(): void }) {
  const langs = (room.contentLocales.length ? room.contentLocales : [...LOCALES]) as Locale[];
  return (
    <Sheet open={open} onClose={onClose} title={t("setup.contentTitle")}>
      <div class="langlist" role="radiogroup">
        {langs.map((l) => (
          <button key={l} type="button" role="radio" aria-checked={room.contentLocale === l} class={`radiorow${room.contentLocale === l ? " is-selected" : ""}`}
            onClick={() => { act({ type: "SET_CONTENT_LOCALE", locale: l }); onClose(); }}>
            <span class="radiorow__dot" aria-hidden="true" />
            <span class="radiorow__label"><bdi lang={l}>{LOCALE_NATIVE_NAME[l]}</bdi></span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

export function SettingsList({ room, setup, edit }: { room: RoomPublic; setup: RoomSetup; edit: boolean }) {
  const [packs, setPacks] = useState(false);
  const [content, setContent] = useState(false);
  const [adv, setAdv] = useState(false);
  void locale.value;
  const basic = basicRows(setup);
  const advanced = advancedRows(setup);
  const lockedRow = (r: Row): boolean => r.premium && !room.premium;
  // A game's own setup content (Quiz Night's quiz cards) comes with its lazy phone chunk, loaded at SETUP.
  const Extra = gameModules.value[setup.gameId]?.SetupExtra;
  return (
    <section class="card setlist" aria-label={t("settings.title")}>
      <ul class="setlist__rows">
        <li class="srow">
          <span class="srow__label">{t("setup.contentTitle")}</span>
          <button type="button" class="srow__value srow__value--btn" disabled={!edit} onClick={() => setContent(true)}>
            <bdi lang={room.contentLocale}>{LOCALE_NATIVE_NAME[room.contentLocale]}</bdi>{edit && <Icon name="chevron-down" size={18} />}
          </button>
        </li>
        {Extra && <Extra room={room} setup={setup} edit={edit} send={(patch) => send(setup, patch)} />}
        {basic.map((r) => <RowView key={r.id} row={r} setup={setup} edit={edit} locked={lockedRow(r)} onPacks={() => setPacks(true)} />)}
        {advanced.length > 0 && (
          <li class="srow srow--adv">
            <button type="button" class="srow__adv" aria-expanded={adv} onClick={() => setAdv(!adv)}>
              <span>{t("setup.advanced")}</span><Icon name="chevron-down" size={18} class={adv ? "is-open" : undefined} />
            </button>
          </li>
        )}
        {adv && advanced.map((r) => <RowView key={r.id} row={r} setup={setup} edit={edit} locked={lockedRow(r)} onPacks={() => setPacks(true)} />)}
      </ul>
      {edit && <PacksSheet setup={setup} open={packs} onClose={() => setPacks(false)} />}
      {edit && <ContentSheet room={room} open={content} onClose={() => setContent(false)} />}
    </section>
  );
}
