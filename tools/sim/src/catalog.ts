import type { Catalog } from "@jamaa/shared/engine";
import { loadCatalog } from "@jamaa/shared/packs";
import { PACKS } from "@jamaa/content";

/** The real word-pack catalog (schema-validated), as the server builds it (§7.8). */
export function realCatalog(): Catalog {
  return loadCatalog(PACKS);
}
