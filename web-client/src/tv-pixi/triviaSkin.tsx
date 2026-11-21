// Quiz Night's Pixi screen for the /tv-pixi skin slot (registered in skin.tsx): the scene (trivia.ts) in the shared
// Pixi host, with the mock's in-game OK rule: OK completes a running reveal, leaderboard race or podium, exactly like
// the DOM screens (games/trivia/tv). The game host remounts this per screen key, so each phase gets a fresh scene.
import { useCallback, useRef, useState } from "preact/hooks";
import type { TvRoomView } from "@jamaa/shared/protocol/v2";
import { useInGameOk } from "../tv-mock/tvParts";
import { PixiHost } from "./stage";
import { TriviaScene } from "./trivia";

export function PixiTrivia({ view }: { view: TvRoomView }) {
  const [running, setRunning] = useState(false);
  const complete = useRef<(() => void) | null>(null);
  useInGameOk(running, () => complete.current?.());
  const make = useCallback(() => new TriviaScene(setRunning, (f) => { complete.current = f; }), []);
  return <PixiHost make={make} view={view} label="trivia" />;
}
