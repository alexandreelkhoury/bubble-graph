import { buildCatalog } from "../engine/catalog";
import type { Catalog } from "../engine/catalog";
import { WordPackSchema } from "./schema";

export { WordSideSchema, PairSchema, WordPackSchema, type WordPack } from "./schema";

/** Schema-validates raw packs and builds the catalog (§7.8). Throws on the first invalid pack. */
export function loadCatalog(packs: readonly unknown[]): Catalog {
  return buildCatalog(packs.map((p) => WordPackSchema.parse(p)));
}
