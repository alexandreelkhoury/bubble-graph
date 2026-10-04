import type { Catalog } from "@mishana/shared/engine";
import { loadCatalog } from "@mishana/shared/packs";
import { PACKS } from "@mishana/word-packs";

/** The real word-pack catalog (schema-validated), as the server builds it (§7.8). */
export function realCatalog(): Catalog {
  return loadCatalog(PACKS);
}
