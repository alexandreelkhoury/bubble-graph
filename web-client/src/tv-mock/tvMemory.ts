// JAMAA-PLATFORM §2.6a: the browser TV's no-repeat memory across rooms, in localStorage `jamaa:tvMemory` (every access
// try/catch, via lib/storage). POST /api/rooms sends it (`memory`), the room starts from it, and each `memory` frame
// (TV socket only) is merged back: games in the frame replace the stored list, the others stay.
import { BRAND } from "@jamaa/shared/brand";
import { mergeMemoryWire, sanitizeMemoryWire } from "@jamaa/shared/room/memory";
import type { MemoryWire } from "@jamaa/shared/room/memory";
import { readRaw, writeRaw } from "../lib/storage";
import type { SocketFactory } from "../net/connection";

export const TV_MEMORY_KEY = `${BRAND.storagePrefix}:tvMemory`;

/** The stored memory, sanitized (missing, corrupt or blocked storage → `{}`). */
export function loadTvMemory(): MemoryWire {
  const raw = readRaw(TV_MEMORY_KEY);
  if (raw === null) return {};
  try {
    return sanitizeMemoryWire(JSON.parse(raw));
  } catch {
    return {};
  }
}

/** The POST /api/rooms body keys for the stored memory: `{memory}`, or none when it is empty. */
export function tvMemoryBody(): { memory?: MemoryWire } {
  const memory = loadTvMemory();
  return Object.keys(memory).length > 0 ? { memory } : {};
}

/** A `memory` frame from the room: merged into the stored memory (never throws). */
export function saveTvMemory(incoming: unknown): void {
  writeRaw(TV_MEMORY_KEY, JSON.stringify(mergeMemoryWire(loadTvMemory(), sanitizeMemoryWire(incoming))));
}

/**
 * The TV socket with a tap for `memory` frames (TV-only, so the phone's Connection stays unchanged: it ignores an
 * unknown `t`). A cheap prefix check first; only a `memory` frame is parsed here.
 */
export function withMemoryTap(factory: SocketFactory, onMemory: (memory: unknown) => void = saveTvMemory): SocketFactory {
  return (h) => factory({
    ...h,
    message: (data) => {
      if (typeof data === "string" && data.includes('"t":"memory"')) {
        try {
          const m = JSON.parse(data) as { t?: unknown; memory?: unknown };
          if (m.t === "memory") onMemory(m.memory);
        } catch {
          /* not JSON: the Connection ignores it too */
        }
      }
      h.message(data);
    },
  });
}
