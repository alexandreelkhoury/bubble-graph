// The TV mute toggle (TV-03 Settings header and the TV-12 pause menu): one remote-focusable button, OK flips it.
import { t } from "../../i18n/t";
import { Icon } from "../../components/Icon";
import { play, setSoundMuted, soundMuted } from "./player";

export function SoundToggle({ class: cls }: { class: string }) {
  const on = !soundMuted.value;
  return (
    <button type="button" class={cls} aria-pressed={on} data-sound-toggle
      onClick={() => {
        setSoundMuted(on);
        if (!on) play({ cue: "ui.select" });
      }}>
      <Icon name={on ? "volume" : "volume-off"} />{t(on ? "tv.soundOn" : "tv.soundOff")}
    </button>
  );
}
