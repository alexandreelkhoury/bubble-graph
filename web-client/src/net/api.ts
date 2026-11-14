import type { CreateRoomResponseBody } from "@jamaa/shared/protocol";
import type { Locale } from "@jamaa/shared/constants";

export type CreateRoomResult = { ok: true; room: CreateRoomResponseBody } | { ok: false; error: string };

/**
 * POST /api/rooms (§6.6). Used by the TV mock only; `entitlement` is the TV's token (PAYMENTS-SPEC §4.3, §5.2), `extra`
 * more body keys (JAMAA-PLATFORM §2.6a `memory`, built by tv-mock/tvMemory.ts so the phone core stays small).
 */
export async function createRoom(locale: Locale, entitlement: string | null = null, extra?: object): Promise<CreateRoomResult> {
  try {
    const res = await fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale, entitlement: entitlement ?? undefined, ...extra }), // undefined keys are dropped
      cache: "no-store",
    });
    if (res.status !== 201) {
      let error = `HTTP_${res.status}`;
      try {
        const j = (await res.json()) as { error?: unknown };
        if (typeof j.error === "string") error = j.error;
      } catch {
        /* keep HTTP code */
      }
      return { ok: false, error };
    }
    return { ok: true, room: (await res.json()) as CreateRoomResponseBody };
  } catch {
    return { ok: false, error: "NETWORK" };
  }
}
