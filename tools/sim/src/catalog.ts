import type { Catalog } from "@jamaa/shared/engine";
import { loadContent } from "@jamaa/shared/content";
import type { ContentCatalog } from "@jamaa/shared/content";
import { CONTENT } from "@jamaa/content";

let full: ContentCatalog | null = null;

/** Every game's real content (schema-validated through each game's ContentAdapter), as the server builds it (§5.3). */
export function realContent(): ContentCatalog {
  return (full ??= loadContent(CONTENT));
}

/** The real Mish Ana! word-pack catalog. */
export function realCatalog(): Catalog {
  return realContent().mishana;
}
