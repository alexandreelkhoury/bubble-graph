// likely packs (JAMAA-PLATFORM §5.1, §6.1; GAME-LIKELY §11). Owned by the likely milestone's lane D: sorted, explicit
// imports (content-lint warns when a pack file under content/likely/ is not listed here).
import likelyChristmas from "./likely-christmas.json";
import likelyFamily from "./likely-family.json";
import likelySpicy from "./likely-spicy.json";

export const PACKS: readonly unknown[] = [likelyChristmas, likelyFamily, likelySpicy];
