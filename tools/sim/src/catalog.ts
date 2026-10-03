import { buildCatalog } from "@mishana/shared/engine";
import type { Catalog } from "@mishana/shared/engine";
import { WordPackSchema } from "@mishana/shared/packs";
import { PACKS } from "@mishana/word-packs";

/** The real word-pack catalog (schema-validated), as the server builds it (§7.8). */
export function realCatalog(): Catalog {
  return buildCatalog(PACKS.map((p) => WordPackSchema.parse(p)));
}
