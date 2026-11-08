// JAMAA-PLATFORM §5.6: the content the Worker ships, behind an injected loader. The Worker entry installs a loader over
// the text modules `content-lint --emit` writes to server/content-dist/<game>/<id>.txt (content-modules.gen.ts);
// Vitest, the sim and tools install one over the `@jamaa/content` JSON. Nothing here imports `@jamaa/content`, so the
// packs never reach the script as JS object literals. Each game's packs are parsed on first use, once per isolate.
import { GAME_IDS } from "@jamaa/shared/games/ids";
import type { GameId } from "@jamaa/shared/games/ids";
import { loadGameContent } from "@jamaa/shared/content";
import type { ContentCatalog } from "@jamaa/shared/content";

/** Raw packs of one game: JSON strings (text modules) or already-parsed values (JSON imports). */
export type ContentLoader = (game: GameId) => readonly (string | unknown)[];

export interface ServerContent {
  /** One game's raw packs (JSON-parsed, not schema-validated), memoised. */
  raw(game: GameId): readonly unknown[];
  /** The full, schema-validated catalog (every game), memoised. Throws on an invalid pack. */
  catalog(): ContentCatalog;
}

export function createContent(loader: ContentLoader): ServerContent {
  const raws = new Map<GameId, readonly unknown[]>();
  let full: ContentCatalog | null = null;
  const raw = (game: GameId): readonly unknown[] => {
    let r = raws.get(game);
    if (!r) {
      r = loader(game).map((x) => (typeof x === "string" ? (JSON.parse(x) as unknown) : x));
      raws.set(game, r);
    }
    return r;
  };
  return {
    raw,
    catalog() {
      if (!full) {
        const out = {} as Record<GameId, unknown>;
        for (const id of GAME_IDS) out[id] = loadGameContent(id, raw(id));
        full = out as unknown as ContentCatalog;
      }
      return full;
    },
  };
}

let installed: ServerContent | null = null;

/** Called once by the Worker entry (or a test setup file) before any request is handled. */
export function installContent(loader: ContentLoader): ServerContent {
  installed = createContent(loader);
  return installed;
}

export function serverContent(): ServerContent {
  if (!installed) throw new Error("content loader not installed");
  return installed;
}
