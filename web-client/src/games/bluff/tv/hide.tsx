// The host's pause-menu items on /tv (GAME-BLUFF §5.4, platform §3.2 HUB-06), remote only. SKIP_PROMPT and HIDE_OPTION
// need ids the platform's generic `{type}` pause path cannot send (the strict schema answers BAD_MESSAGE), so Bluff
// resolves its own items here, like the native `BluffTv.pauseAction`. "Hide an answer" opens a picker that shows the
// corkboard in the same order and grid (RTL mirrors it), frozen letters, a cream focus ring: the D-pad moves, OK
// sends HIDE_OPTION for the focused card, Back closes. Nothing here depends on what a card is (its kind is never known).
// JAMAA-GAP (G2): tvDialogs' PauseMenu must call `runPauseAction` for Bluff's items (see the lane B report).
import { signal } from "@preact/signals";
import { useEffect } from "preact/hooks";
import type { TvRoomView } from "@jamaa/shared/protocol/v2";
import { tvAct } from "../../../tv-mock/tvStore";
import { isBackKey, useInitialFocus } from "../../../tv-mock/dpad";
import { letterOf, optionLetters } from "../model";
import { pauseAction } from "./pause";
import type { BluffModel } from "../model";
import { tk } from "./stage";

/** The hide picker is open (VOTING only; it closes itself when VOTING ends or nothing can be hidden). */
export const hidePickerOpen = signal(false);

const sendGame = (i: Record<string, unknown>): void => {
  tvAct({ type: "GAME", gameId: "bluff", i } as Parameters<typeof tvAct>[0]);
};

/** Runs a pause item: sends the full intent or opens the hide picker. False when the item cannot run now. */
export function runPauseAction(intent: string, view: TvRoomView): boolean {
  const a = pauseAction(intent, view);
  if (a.kind === "send") { sendGame(a.intent); return true; }
  if (a.kind === "pickOptionToHide") { hidePickerOpen.value = true; return true; }
  return false;
}

/** The corkboard as a remote-only picker (cards in board order; 2 columns from 7 cards, like the board). */
export function HidePicker({ m }: { m: BluffModel }) {
  const first = useInitialFocus<HTMLButtonElement>(m.pub.options.length);
  const opts = m.pub.options;
  const usable = m.pub.phase === "VOTING" && m.pub.hidesLeft > 0 && opts.length > 2 && !m.over;
  useEffect(() => { if (!usable) hidePickerOpen.value = false; }, [usable]);
  useEffect(() => () => { hidePickerOpen.value = false; }, []);
  if (!usable) return null;
  const letters = optionLetters(m);
  const close = (): void => { hidePickerOpen.value = false; };
  return (
    <div class="tvoverlay bfhide" role="dialog" aria-modal="true" aria-label={tk("pause.hideOptionPick")} data-bf-hidepicker
      onKeyDown={(e) => { if (isBackKey(e)) { e.preventDefault(); e.stopPropagation(); close(); } }}>
      <div class="tvdialog bfhide__card">
        <h2 class="tvdialog__title tvdialog__title--center">{tk("pause.hideOptionPick")}</h2>
        <p class="tvdialog__sub">{tk("pause.hidesLeft", { count: m.pub.hidesLeft })}</p>
        <div class={`bfhide__grid${opts.length > 6 ? " is-dense" : ""}`} role="listbox" aria-label={tk("pause.hideOptionPick")}>
          {opts.map((o, i) => (
            <button key={o.id} type="button" role="option" aria-selected="false" class="bfhide__opt" data-hide-option={o.id}
              ref={i === 0 ? first : undefined} data-default-focus={i === 0 ? true : undefined}
              onClick={() => { sendGame({ type: "HIDE_OPTION", optionId: o.id }); close(); }}>
              <span class="bfnote__letter" aria-hidden="true">{letters.get(o.id) ?? letterOf(i)}</span>
              <span class="bfhide__text" dir="auto">{o.text}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
