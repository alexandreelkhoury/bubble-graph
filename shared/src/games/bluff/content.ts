// JAMAA-PLATFORM §5.2: this game's content adapter. STUB created in P (no packs yet; `content/<id>/` is empty); the G
// lane of this game replaces it with its pack schema (game doc §11).
import type { ContentAdapter, PackMeta } from "../../content/types";

/** Stub pack type: no pack of this game exists yet. */
export type StubPack = never;

export const content: ContentAdapter<StubPack> = {
  parse(): StubPack {
    throw new Error("no content schema yet (stub game)");
  },
  meta(p: StubPack): PackMeta {
    return p;
  },
  playable(p: StubPack): StubPack | null {
    return p;
  },
};
