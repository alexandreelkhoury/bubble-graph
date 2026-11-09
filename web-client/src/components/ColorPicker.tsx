// The join screen's default pick (PHH-01): the stored colour when free, else the first free one. The protocol and the
// storage keep the field name `color`; the UI calls it the character (JAMAA-PLATFORM §3.7, screens/Join.tsx).
import { COLORS } from "@jamaa/shared/constants";
import type { ColorId } from "@jamaa/shared/constants";

export function firstFree(taken: ReadonlySet<string>, preferred?: ColorId | null): ColorId | null {
  if (preferred && !taken.has(preferred)) return preferred;
  return COLORS.find((c) => !taken.has(c.id))?.id ?? null;
}
