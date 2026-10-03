// §7.6 room codes: uniform over ROOM_CODE_ALPHABET by rejection sampling over bytes.
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from "@mishana/shared/constants";

const ACCEPT_BELOW = 230; // §7.6: accept b < 230 (= 10 × 23), use ALPHABET[b % 23]

/** Draws a room code; `randomBytes` is called again whenever a batch runs out of accepted bytes. */
export function generateRoomCode(randomBytes: (n: number) => Uint8Array): string {
  let code = "";
  while (code.length < ROOM_CODE_LENGTH) {
    for (const b of randomBytes(8)) {
      if (b < ACCEPT_BELOW) code += ROOM_CODE_ALPHABET[b % ROOM_CODE_ALPHABET.length];
      if (code.length === ROOM_CODE_LENGTH) break;
    }
  }
  return code;
}
