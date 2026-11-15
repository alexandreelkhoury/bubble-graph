// JAMAA-PLATFORM §8.6 content stats: which pack item a host intent skips, voids or hides, read from the game state
// BEFORE the intent (RoomCore#action emits it only when the intent was accepted and changed the room). Ids only: the
// game, the pack and the item. Never a player id, a name or a player's own text (a hidden player lie is not reported).
// Mish Ana! has no content skip (its pause "skip" ends a timer), so it never flags.
import type { ContentCatalog } from "@jamaa/shared/content";
import type { GameId } from "@jamaa/shared/games/ids";
import type { ContentAction } from "./events";

export interface ContentFlag { action: ContentAction; packId: string; itemId: string }

type Obj = Record<string, unknown>;
const obj = (x: unknown): Obj | null => (typeof x === "object" && x !== null ? (x as Obj) : null);
const str = (x: unknown): string | null => (typeof x === "string" && x.length > 0 ? x : null);
const flag = (action: ContentAction, packId: unknown, itemId: unknown): ContentFlag | null => {
  const p = str(packId);
  const i = str(itemId);
  return p !== null && i !== null ? { action, packId: p, itemId: i } : null;
};

/** The first pack of `packs` (restricted to `only` when given) whose `key` list holds an item with this id. */
function packOf(packs: unknown, key: "items" | "questions", itemId: string, only: readonly string[] | null): string | null {
  if (!Array.isArray(packs)) return null;
  for (const p of packs as Obj[]) {
    if (only && !only.includes(String(p.id))) continue;
    const items = p[key];
    if (Array.isArray(items) && items.some((it) => obj(it)?.id === itemId)) return str(p.id);
  }
  return null;
}

/** The content item a host intent `i` acts on, or null (not a content intent, or the state has no such item). */
export function contentFlag(gameId: GameId, gameState: unknown, i: unknown, content: ContentCatalog): ContentFlag | null {
  const s = obj(gameState);
  const intent = obj(i);
  if (!s || !intent) return null;
  switch (`${gameId}:${String(intent.type)}`) {
    case "bluff:SKIP_PROMPT": {
      const p = obj(s.prompt);
      return p ? flag("skip", p.packId, p.itemId) : null;
    }
    case "bluff:HIDE_OPTION": {
      const p = obj(s.prompt);
      const o = Array.isArray(s.options) ? (s.options as Obj[]).find((x) => x.id === intent.optionId) : undefined;
      if (!p || !o || (o.kind !== "truth" && o.kind !== "house")) return null;
      return flag(o.kind === "truth" ? "hide_truth" : "hide_house", p.packId, p.itemId);
    }
    case "likely:SKIP_CARD": {
      const c = obj(s.card);
      return c ? flag("skip", c.packId, c.cardId) : null;
    }
    case "trivia:VOID_QUESTION": {
      const last = obj(s.last);
      return last && last.voided !== true ? flag("void", obj(s.quiz)?.packId, last.questionId) : null;
    }
    case "taqriban:SKIP_QUESTION": {
      const id = str(obj(s.cur)?.id);
      if (id === null) return null;
      const only = obj(s.settings)?.packIds;
      const pack = packOf(content.taqriban.packs, "items", id, Array.isArray(only) && only.length > 0 ? (only as string[]) : null)
        ?? packOf(content.taqriban.packs, "items", id, null);
      return flag("skip", pack ?? "?", id);
    }
    default:
      return null;
  }
}
