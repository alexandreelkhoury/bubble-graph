// /tv-pixi: registers the Pixi hub and the Pixi Most Likely into the TV mock's skin slot (tv-mock/tvSkin.ts). Importing
// this module is the whole activation; the platform around them (room, pause menu, rules, store, portal, results bar,
// every other game and the setup screen) is the unchanged DOM mock, so the app stays fully playable.
import "./pixi.css";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import type { GameId } from "@jamaa/shared/games/ids";
import type { TvRoomView } from "@jamaa/shared/protocol/v2";
import { locale } from "../i18n/t";
import { rememberSideOpener } from "../tv-mock/tvDialogs";
import { readingDir } from "../tv-mock/tvHub";
import { useInGameOk } from "../tv-mock/tvParts";
import { soundCue } from "../tv-mock/sound/controller";
import { focusGame, tvAct, tvCupOpen, tvDialog, tvFocusGame, tvHubSettings, tvIntro, tvLangOpen, tvPaused, tvPicker, tvRules, tvShop } from "../tv-mock/tvStore";
import { tvSkin } from "../tv-mock/tvSkin";
import { HubScene } from "./hub";
import { LikelyScene } from "./likely";
import { PixiMishana } from "./mishana";
import { PixiTaqriban } from "./taqriban";
import { PixiBluff } from "./bluffSkin";
import { PixiTrivia } from "./triviaSkin";
import { PixiHost } from "./stage";

const overlayOpen = (): boolean =>
  tvDialog.value !== null || tvPicker.value !== null || tvShop.value !== null || tvLangOpen.value || tvRules.value !== null || tvHubSettings.value
  || tvCupOpen.value || tvIntro.value !== null || tvPaused.value || document.querySelector(".tvoverlay") !== null;

/** The hub: Left/Right move the poster focus (RTL-aware), OK opens the game, Down opens Settings; Back and Info are the mock's. */
function PixiHub({ view, portalOut, onOpen }: { view: TvRoomView; portalOut?: boolean; onOpen(id: GameId, rect: DOMRect | null): void }) {
  const latest = useRef({ view, portalOut, onOpen });
  latest.current = { view, portalOut, onOpen };
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const { view: v, portalOut: busy, onOpen: open } = latest.current;
      if (e.defaultPrevented || busy || overlayOpen()) return;
      const ids = v.room.games.map((g) => g.id);
      const local = tvFocusGame.value;
      const cur = local && ids.includes(local) ? local : ids.includes(v.room.focusedGameId) ? v.room.focusedGameId : ids[0];
      if (!cur) return;
      const d = readingDir(e.key, document.documentElement.dir === "rtl" || locale.value === "ar");
      if (d !== 0) {
        e.preventDefault();
        if (ids.length > 1) { focusGame(ids[(ids.indexOf(cur) + d + ids.length) % ids.length]!); soundCue("hub_move"); }
      } else if ((e.key === "Enter" || e.key === " ") && !e.repeat) {
        e.preventDefault();
        const g = v.room.games.find((x) => x.id === cur);
        // An unavailable game (no content in the room language) is the DOM hub's language picker; here OK just does nothing.
        if (g?.available && tvAct({ type: "OPEN_GAME", gameId: cur }) !== null) open(cur, null);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        rememberSideOpener();
        tvHubSettings.value = true;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const make = useCallback(() => new HubScene(), []);
  // Re-set the scene when the local focus moves (it is a signal, not part of the view).
  return <PixiHost make={make} view={view} dep={tvFocusGame.value} label="hub" />;
}

/** Most Likely: OK completes a running reveal / awards drop (the mock's in-game OK rule), exactly like the DOM screens. */
function PixiLikely({ view }: { view: TvRoomView }) {
  const [running, setRunning] = useState(false);
  const complete = useRef<(() => void) | null>(null);
  useInGameOk(running, () => complete.current?.());
  const make = useCallback(() => new LikelyScene(setRunning, (f) => { complete.current = f; }), []);
  return <PixiHost make={make} view={view} label="likely" />;
}

tvSkin.Hub = PixiHub;
tvSkin.games.likely = PixiLikely;
tvSkin.games.mishana = PixiMishana;
tvSkin.games.taqriban = PixiTaqriban;
tvSkin.games.bluff = PixiBluff;
tvSkin.games.trivia = PixiTrivia;
