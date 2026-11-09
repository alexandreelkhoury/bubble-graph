// JAMAA-PLATFORM §3.2 HUB-03 / §3.3 PHH-03, DESIGN-JAMAA §2.5: the how-to cards of a game (`rules.howToKeys`), each
// with a small scene of characters acting the step (no extra assets), shared by the TV intro and the phone sheet.
import type { ColorId } from "@jamaa/shared/constants";
import type { GameId } from "@jamaa/shared/games/ids";
import { metaOf } from "../lib/meta";
import { t } from "../i18n/t";
import type { MessageKey } from "../i18n/t";
import type { Expression } from "@jamaa/shared/characters";
import { Character } from "./Character";
import { Icon } from "./Icon";
import { WORLD_OF } from "./Poster";
import { useEffect, useState } from "preact/hooks";
import { reduced } from "../lib/motion";

type Look = "start" | "end" | null;
/** One beat: per actor [expression, look, hop]. */
type Beat = readonly (readonly [Expression, Look, boolean?])[];
/** The prop each card acts with: dealt word cards, a speech bubble, the vote mark, the trophy. */
type Prop = "cards" | "bubble" | "vote" | "trophy";
const CAST: readonly ColorId[] = ["coral", "azure", "jade"];
/**
 * Per card (step 1 → 4: receive, talk, vote, finale): a ≤ 3 s loop of three 1 s beats acted with the character rig
 * (expression swap, look, hop) and one prop. Card 1: the outer two get the SAME word card and smile at each other;
 * the middle one gets a different card and wonders.
 */
const SCENES: readonly { prop: Prop; beats: readonly Beat[] }[] = [
  { prop: "cards", beats: [
    [["idle", null], ["idle", null], ["idle", null]],
    [["happy", "end"], ["think", null], ["happy", "start"]],
    [["smug", "end", true], ["shy", "start"], ["smug", "start", true]],
  ] },
  { prop: "bubble", beats: [
    [["point", "end", true], ["think", "start"], ["think", "start"]],
    [["idle", "end"], ["laugh", "end", true], ["think", "start"]],
    [["think", "end"], ["think", "end"], ["point", "start", true]],
  ] },
  { prop: "vote", beats: [
    [["think", "end"], ["idle", null], ["think", "start"]],
    [["point", "end"], ["shock", null, true], ["point", "start"]],
    [["smug", "end", true], ["facepalm", null], ["smug", "start", true]],
  ] },
  { prop: "trophy", beats: [
    [["shock", null], ["shock", null], ["shock", null]],
    [["happy", "end"], ["cheer", null, true], ["happy", "start"]],
    [["cheer", null, true], ["cheer", null, true], ["cheer", null, true]],
  ] },
];
export const HOWTO_BEAT_MS = 1000;

/** The prop over actor `i` at beat `b` (null: nothing over this actor). */
function propFor(prop: Prop, i: number, b: number) {
  switch (prop) {
    case "cards": return <svg viewBox="0 0 24 16" class={`howto__card-prop${i === 1 ? " is-odd" : ""}`}><rect x="1" y="1" width="22" height="14" rx="3" /><path d={i === 1 ? "M9 6c0-2 6-2 6 0s-3 2-3 4M12 12.5v.1" : "M6 7h12M6 10.5h8"} /></svg>;
    case "bubble": return i === b ? <svg viewBox="0 0 24 18" class="howto__bubble"><path d="M3 2h18a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H10l-4 3v-3H3a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" /><path d="M6 7h12M6 10h7" /></svg> : null;
    // The vote mark and the trophy reuse the UI icon paths (no extra bytes in the phone core).
    case "vote": return i === 1 && b >= 1 ? <Icon name="x" class="howto__vote" /> : null;
    case "trophy": return i === 1 && b >= 1 ? <Icon name="trophy" class="howto__trophy" /> : null;
  }
}

export function howToKeys(id: GameId): readonly string[] {
  return metaOf(id)?.rules.howToKeys ?? [];
}

export function HowToScene({ index, size }: { index: number; size: number }) {
  const scene = SCENES[index % SCENES.length]!;
  const [beat, setBeat] = useState(0);
  useEffect(() => {
    setBeat(0);
    if (reduced()) { setBeat(scene.beats.length - 1); return; }
    const id = setInterval(() => setBeat((b) => (b + 1) % scene.beats.length), HOWTO_BEAT_MS);
    return () => clearInterval(id);
  }, [index]);
  const cast = scene.beats[beat]!;
  return (
    <div class={`howto__scene howto__scene--${index % SCENES.length}`} aria-hidden="true">
      {cast.map(([e, look, hop], i) => (
        <span key={`${index}:${i}`} class={`howto__actor${hop ? " is-hop" : ""}`} data-beat={beat}>
          <span class="howto__prop" key={`${scene.prop}${beat}`} style={{ height: `${Math.round(size * 0.36)}px` }}>{propFor(scene.prop, i, beat)}</span>
          <Character color={CAST[i]!} size={i === 1 ? Math.round(size * 1.2) : size} expression={e} look={look} />
        </span>
      ))}
    </div>
  );
}

/** One card: the scene, "1/4", the sentence. */
export function HowToCard({ id, index, size, class: cls }: { id: GameId; index: number; size: number; class?: string }) {
  const keys = howToKeys(id);
  if (keys.length === 0) return <div class={`howto__card${cls ? ` ${cls}` : ""}`} data-world={WORLD_OF[id]} />;
  return (
    <div class={`howto__card${cls ? ` ${cls}` : ""}`} data-world={WORLD_OF[id]} key={index}>
      <HowToScene index={index} size={size} />
      <p class="howto__step tnum">{t("setup.introProgress", { current: index + 1, total: keys.length })}</p>
      <p class="howto__text">{t(keys[index] as MessageKey)}</p>
    </div>
  );
}

export function Dots({ n, i }: { n: number; i: number }) {
  return <div class="howto__dots" aria-hidden="true">{Array.from({ length: n }, (_, k) => <i key={k} class={k === i ? "is-on" : undefined} />)}</div>;
}
