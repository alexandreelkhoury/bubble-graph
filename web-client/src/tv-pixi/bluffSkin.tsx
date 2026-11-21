// /tv-pixi: Bluff! drawn by Pixi (bluff.ts), registered in skin.tsx. OK completes a running reveal, awards drop or
// podium (the mock's in-game OK rule, like the DOM screens); the host's "Hide an answer" picker stays the DOM overlay
// of games/bluff/tv/hide.tsx, drawn above the canvas during VOTING.
import { useCallback, useRef, useState } from "preact/hooks";
import type { TvRoomView } from "@jamaa/shared/protocol/v2";
import { useInGameOk } from "../tv-mock/tvParts";
import { bluffModel } from "../games/bluff/model";
import { HidePicker, hidePickerOpen } from "../games/bluff/tv/hide";
import { BluffScene } from "./bluff";
import { PixiHost } from "./stage";

export function PixiBluff({ view }: { view: TvRoomView }) {
  const [running, setRunning] = useState(false);
  const complete = useRef<(() => void) | null>(null);
  useInGameOk(running, () => complete.current?.());
  const make = useCallback(() => new BluffScene(setRunning, (f) => { complete.current = f; }), []);
  const m = bluffModel(view);
  const picker = !!m && !m.over && m.pub.phase === "VOTING" && hidePickerOpen.value;
  return (
    <>
      <PixiHost make={make} view={view} label="bluff" />
      {picker && (
        // The picker's styles read the café tokens of `.bf` (tv.css); the wrapper is transparent over the canvas.
        <div class="bf" data-world="hakawati-cafe" style={{ background: "transparent" }}>
          <HidePicker m={m} />
        </div>
      )}
    </>
  );
}
