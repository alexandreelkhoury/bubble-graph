import type { CreateRoomResponseBody } from "@mishana/shared/protocol";
import type { Locale } from "@mishana/shared/constants";

export type CreateRoomResult = { ok: true; room: CreateRoomResponseBody } | { ok: false; error: string };

/** POST /api/rooms (§6.6). Used by the TV mock only. */
export async function createRoom(locale: Locale): Promise<CreateRoomResult> {
  try {
    const res = await fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale }),
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
