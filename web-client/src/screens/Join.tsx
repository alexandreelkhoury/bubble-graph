// PHH-01 Join (JAMAA-PLATFORM §3.3): name + a character picker (12 faces in a 4 × 3 grid, taken ones greyed, the
// selected one turns happy and hops). Joins are open in every phase: while PLAYING the newcomer is benched until the
// next game (§2.3), so there is no locked variant any more.
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { COLORS, MAX_PLAYERS, NAME_MAX_CHARS } from "@jamaa/shared/constants";
import type { ColorId } from "@jamaa/shared/constants";
import type { PlayerRoomView } from "@jamaa/shared/protocol/v2";
import { errorKeyOf, fmtNum, isolateLtr, t, tPrefer } from "../i18n/t";
import type { MessageKey } from "../i18n/t";
import { inlineError, joinPending } from "../state/store";
import { join } from "../state/session";
import { loadColor, loadName } from "../lib/storage";
import { graphemeCount, sanitizeName } from "../lib/names";
import { firstFree } from "../components/ColorPicker";
import { Character } from "../components/Character";
import { Button, Heading } from "../components/UI";
import { Icon } from "../components/Icon";

/** JAMAA-PLATFORM §3.7: the protocol field stays `color`, the UI says "character" (keys from lane D; until they land
 *  the colour wording shows instead of a raw key). */
const characterTaken = (): string => tPrefer("join.characterTaken", "join.colorTaken");

export function CharacterPicker({ value, taken, onChange, shake }: { value: ColorId | null; taken: ReadonlySet<string>; onChange(c: ColorId): void; shake: boolean }) {
  return (
    <div class={`chargrid${shake ? " shake" : ""}`} role="radiogroup" aria-labelledby="character-label">
      {COLORS.map((c) => {
        const isTaken = taken.has(c.id);
        const sel = value === c.id;
        const name = t(`color.${c.id}` as MessageKey);
        return (
          <button key={c.id} type="button" role="radio" aria-checked={sel} aria-disabled={isTaken}
            aria-label={isTaken ? `${name}, ${characterTaken()}` : name}
            class={`charpick${sel ? " is-selected" : ""}${isTaken ? " is-taken" : ""}`}
            onClick={() => { if (!isTaken) onChange(c.id); }}>
            <Character color={c.id} size={56} expression={sel ? "happy" : isTaken ? "away" : "idle"} key={sel ? "sel" : "idle"} />
          </button>
        );
      })}
    </div>
  );
}

export function Join({ view }: { view: PlayerRoomView }) {
  const room = view.room;
  const taken = useMemo(() => new Set(room.members.filter((m) => !m.left).map((m) => m.color)), [room.members]);
  const [name, setName] = useState(() => loadName());
  const [color, setColor] = useState<ColorId | null>(() => firstFree(taken, loadColor()));
  const [shake, setShake] = useState(0);
  const err = inlineError.value;
  const pending = joinPending.value;
  const clean = sanitizeName(name);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (color === null || taken.has(color)) {
      const f = firstFree(taken);
      if (f !== color) setColor(f);
    }
  }, [taken]);
  useEffect(() => {
    if (err === "COLOR_TAKEN") {
      setColor(firstFree(taken));
      setShake((s) => s + 1);
    }
  }, [err]);

  const full = room.members.length >= MAX_PLAYERS;
  const canSubmit = clean !== null && color !== null && !pending && !full;
  const submit = (): void => {
    if (!canSubmit || clean === null || color === null) return;
    join(clean, color);
  };
  const errKey: MessageKey | null =
    err === "COLOR_TAKEN" ? null : err && err !== "GUESS_INVALID" ? errorKeyOf(err) : full ? "error.roomFull" : null;
  const errText = err === "COLOR_TAKEN" ? characterTaken() : errKey ? t(errKey) : null;
  const count = clean ? graphemeCount(clean) : 0;
  const playing = room.phase === "PLAYING";

  return (
    <>
      <main class="screen screen--join">
        <Heading title={<>{t("join.joiningCode", { code: isolateLtr(room.roomCode) })}</>} />
        {playing && <p class="liveline"><span class="liveline__dot" aria-hidden="true" />{t("error.notInGame")}</p>}
        <label class="field-label" for="name">{t("join.nameLabel")}</label>
        <div class="field">
          <input
            id="name" ref={nameRef} class="input" value={name} dir="auto" autoComplete="nickname" enterKeyHint="go"
            placeholder={t("join.namePlaceholder")} maxLength={64} spellcheck={false} autoCorrect="off"
            aria-invalid={err === "NAME_INVALID" || err === "NAME_TAKEN"}
            onInput={(e) => { setName(e.currentTarget.value); if (err === "NAME_INVALID" || err === "NAME_TAKEN") inlineError.value = null; }}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          />
          <p class={`field__count${count >= NAME_MAX_CHARS ? " is-max" : ""}`} aria-hidden="true"><bdi class="num">{fmtNum(count)}/{fmtNum(NAME_MAX_CHARS)}</bdi></p>
        </div>
        <p class="field-label" id="character-label">{tPrefer("join.characterLabel", "join.colorLabel")}</p>
        <CharacterPicker value={color} taken={taken} onChange={(c) => { setColor(c); if (err === "COLOR_TAKEN") inlineError.value = null; }} shake={shake > 0} key={shake} />
      </main>
      <footer class="actionbar">
        {errText && <p class="inline-error" role="alert"><Icon name="info" size={18} />{errText}</p>}
        <Button disabled={!canSubmit} onClick={submit} aria-busy={pending}>
          {pending ? t("join.joining") : t("join.submit")}
        </Button>
      </footer>
    </>
  );
}
