// taqriban packs (JAMAA-PLATFORM §5.1; GAME-TAQRIBAN §11). Sorted, explicit imports (content-lint warns when a pack
// file under content/taqriban/ is not listed here). Every item is a draft until a native review checks the wording
// and a second person re-checks the number against `review.ref`.
import taqribanLevant from "./taqriban-levant.json";
import taqribanWorld from "./taqriban-world.json";

export const PACKS: readonly unknown[] = [taqribanLevant, taqribanWorld];
