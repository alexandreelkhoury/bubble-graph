// PH-02 Join (name + colour) and its locked variant (me===null, phase≠LOBBY).
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { NAME_MAX_CHARS } from "@mishana/shared/constants";
import type { ColorId } from "@mishana/shared/constants";
import { sanitizeName } from "@mishana/shared/engine";
import type { PlayerView } from "@mishana/shared/protocol";
import { errorKeyOf, fmtNum, t } from "../i18n/t";
import type { MessageKey } from "../i18n/t";
import { inlineError, joinPending } from "../state/store";
import { join, PHASE_KEY } from "../state/session";
import { loadColor, loadName } from "../lib/storage";
import { ColorPicker, firstFree } from "../components/ColorPicker";
import { Avatar } from "../components/PlayerChip";
import { Button, Heading } from "../components/UI";
import { Icon } from "../components/Icon";

const segmenter = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;
export function graphemeCount(s: string): number {
  if (!segmenter) return [...s].length;
  let n = 0;
  for (const seg of segmenter.segment(s)) if (seg.segment) n++;
  return n;
}

export function Join({ view }: { view: PlayerView }) {
  const locked = view.phase !== "LOBBY";
  const taken = useMemo(() => new Set(view.players.filter((p) => !p.left).map((p) => p.color)), [view.players]);
  const [name, setName] = useState(() => loadName());
  const [color, setColor] = useState<ColorId | null>(() => firstFree(taken, loadColor()));
  const [shake, setShake] = useState(0);
  const err = inlineError.value;
  const pending = joinPending.value;
  const clean = sanitizeName(name);
  const nameRef = useRef<HTMLInputElement>(null);

  // Keep the selection valid as colours get taken live; COLOR_TAKEN → first free + shake (CTA stays enabled).
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

  const full = view.players.length >= 12;
  const canSubmit = !locked && clean !== null && color !== null && !pending && !full;
  const submit = (): void => {
    if (!canSubmit || clean === null || color === null) return;
    join(clean, color);
  };
  const errKey: MessageKey | null =
    err === "COLOR_TAKEN" ? "join.colorTaken" : err && err !== "ROOM_LOCKED" && err !== "GUESS_INVALID" ? errorKeyOf(err) : full && !locked ? "error.roomFull" : null;
  const count = clean ? graphemeCount(clean) : 0;

  return (
    <>
      <main class="screen screen--join">
        {locked ? (
          <div class="locked">
            <span class="locked__icon"><Icon name="lock" size={32} /></span>
            <Heading title={t("join.locked")} />
            <p class="liveline">
              <span class="liveline__dot" aria-hidden="true" />
              {view.round > 0 ? `${t("round.label", { count: view.round })} · ` : ""}{t(PHASE_KEY[view.phase])}
            </p>
          </div>
        ) : (
          <Heading title={<>{t("join.joiningCode", { code: "⁨" + view.roomCode + "⁩" })}</>} />
        )}

        <label class="field-label" for="name">{t("join.nameLabel")}</label>
        <div class="field">
          <input
            id="name" ref={nameRef} class="input" value={name} dir="auto" autoComplete="nickname" enterKeyHint="go"
            placeholder={t("join.namePlaceholder")} maxLength={64} spellcheck={false} autoCorrect="off"
            aria-invalid={err === "NAME_INVALID" || err === "NAME_TAKEN"}
            onInput={(e) => { setName(e.currentTarget.value); if (err === "NAME_INVALID" || err === "NAME_TAKEN") inlineError.value = null; }}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          />
          <span class={`field__count num${count >= NAME_MAX_CHARS ? " is-max" : ""}`} aria-hidden="true">{fmtNum(count)}/{fmtNum(NAME_MAX_CHARS)}</span>
        </div>

        <p class="field-label" id="color-label">{t("join.colorLabel")}</p>
        <ColorPicker value={color} taken={taken} onChange={(c) => { setColor(c); if (err === "COLOR_TAKEN") inlineError.value = null; }} shake={shake > 0} key={shake} />

        <div class="preview" aria-hidden="true">
          {color && (
            <div class="preview__tile">
              <Avatar color={color} size={56} />
              <bdi class="preview__name">{clean ?? t("join.namePlaceholder")}</bdi>
            </div>
          )}
        </div>
      </main>
      <footer class="actionbar">
        {errKey && <p class="inline-error" role="alert"><Icon name="info" size={18} />{t(errKey)}</p>}
        <Button disabled={!canSubmit} onClick={submit} aria-busy={pending}>
          {pending ? t("join.joining") : t("join.submit")}
        </Button>
      </footer>
    </>
  );
}
