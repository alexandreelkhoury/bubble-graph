export const PROTOCOL_VERSION = 1;
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ"; // 23 letters, no I L O
export const ROOM_CODE_LENGTH = 4;
export const ROOM_CODE_REGEX = new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`);
export const PARTY_NAME = "room";              // kebab of DO binding "Room"
export const WS_PATH_PREFIX = "/parties/room/"; // + CODE
export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 12;
export const NAME_MAX_CHARS = 16;   // graphemes (Intl.Segmenter) after sanitising
export const GUESS_MAX_CHARS = 40;
export const NAME_MAX_CODEPOINTS = 64;  // after sanitising; guards combining-mark abuse
export const SEAT_HOLD_MS = 120_000;    // LOBBY only (§4.8)
export const ELIMINATION_HOLD_MS = 8_000;
export const VERDICT_HOLD_MS = 8_000;
export const CLUE_GRACE_MS = 15_000;    // speaker disconnects mid-turn with the clue timer off
export const TIE_LEAD_IN_MS = 3_000;    // added to the first TIE_BREAK turn so the TV can show the tie
export const MAX_NO_ELIMINATION_STREAK = 3;
export const HEARTBEAT_INTERVAL_MS = 20_000;
export const PONG_TIMEOUT_MS = 10_000;
export const HELLO_TIMEOUT_MS = 10_000;
export const ROOM_EMPTY_TTL_MS = 15 * 60_000;
export const ROOM_IDLE_TTL_MS = 2 * 60 * 60_000;
export const ROOM_RESULTS_TTL_MS = 30 * 60_000;
export const MSG_MAX_BYTES = 4096;          // UTF-8 bytes (TextEncoder)
export const HTTP_BODY_MAX_BYTES = 1024;    // POST /api/rooms
export const RATE_MSGS_PER_SEC = 5;         // token bucket refill / s
export const RATE_BURST = 10;               // bucket capacity
export const JOINS_PER_MIN_PER_IP = 30;     // per room; a whole party shares one NAT IP
export const CREATE_ROOMS_PER_MIN_PER_IP = 10;
export const CONNECTS_PER_MIN_PER_IP = 60;  // Worker-level, all rooms (CONNECT_LIMITER)
export const MAX_CONNECTIONS_PER_ROOM = 40; // includes the new socket
export const MAX_PENDING_CONNECTIONS = 10;  // never-hello'd sockets per room
/** WebSocket close codes (§6.4). protocol/errors.ts maps the fatal error codes onto these. */
export const CLOSE_CODES = {
  BAD_CID: 4000,
  HELLO_TIMEOUT: 4001,
  UNSUPPORTED_VERSION: 4002,
  TV_AUTH_FAILED: 4003,
  ROOM_NOT_FOUND: 4004,
  REPLACED: 4005,
  KICKED: 4006,
  RATE_LIMITED: 4008,
  CAPACITY: 4009,
  ROOM_EXPIRED: 4010,
} as const;
/** Client stops reconnecting: exactly the close codes of the fatal errors in ERROR_INFO (checked by a test). */
export const FATAL_CLOSE_CODES = [
  CLOSE_CODES.UNSUPPORTED_VERSION, CLOSE_CODES.TV_AUTH_FAILED, CLOSE_CODES.ROOM_NOT_FOUND,
  CLOSE_CODES.REPLACED, CLOSE_CODES.KICKED, CLOSE_CODES.ROOM_EXPIRED,
] as const;
/** Reconnect, but wait ≥ SLOW_RECONNECT_MS. */
export const SLOW_RECONNECT_CLOSE_CODES = [CLOSE_CODES.RATE_LIMITED, CLOSE_CODES.CAPACITY] as const;
export const SLOW_RECONNECT_MS = 10_000;
export const PING_FRAME = '{"v":1,"t":"ping"}'; // byte-exact
export const PONG_FRAME = '{"v":1,"t":"pong"}'; // byte-exact
export const LOCALES = ["en", "fr", "ar"] as const;
export type Locale = (typeof LOCALES)[number];
// Player colours: DESIGN §2.3 palette (CVD- and contrast-checked), in pick order. glyph = avatar glyph colour.
export const COLORS = [
  { id: "coral",     hex: "#F0183A", shape: "circle",   glyph: "ink" },
  { id: "azure",     hex: "#478CFF", shape: "square",   glyph: "ink" },
  { id: "lemon",     hex: "#FFF04D", shape: "star",     glyph: "ink" },
  { id: "jade",      hex: "#1FA88A", shape: "triangle", glyph: "ink" },
  { id: "grape",     hex: "#7A43FF", shape: "diamond",  glyph: "cream" },
  { id: "tangerine", hex: "#FF7A1F", shape: "hexagon",  glyph: "ink" },
  { id: "aqua",      hex: "#7BFFF4", shape: "plus",     glyph: "ink" },
  { id: "rose",      hex: "#FF96C5", shape: "drop",     glyph: "ink" },
  { id: "mint",      hex: "#BDF5C8", shape: "crescent", glyph: "ink" },
  { id: "plum",      hex: "#C02A8F", shape: "bolt",     glyph: "cream" },
  { id: "sand",      hex: "#E6C486", shape: "flower",   glyph: "ink" },
  { id: "lilac",     hex: "#C9BFFF", shape: "arch",     glyph: "ink" },
] as const;
export type ColorId = (typeof COLORS)[number]["id"];

/** Longest pack id: WordPackSchema caps authored ids so every shipped pack stays selectable in settings. */
export const PACK_ID_MAX = 40;

// Settings bounds and UI step sizes (TV Left/Right, phone steppers). `off: 0` means 0 is allowed and means "timer off".
export const SETTINGS_BOUNDS = {
  undercoverCount: { min: 1, max: 5, step: 1 },
  blankCount:      { min: 0, max: 2, step: 1 },
  clueSeconds:     { off: 0, min: 10, max: 120, step: 5 },
  voteSeconds:     { off: 0, min: 15, max: 300, step: 15 },
  revealSeconds:   { off: 0, min: 10, max: 120, step: 5 },
  guessSeconds:    { off: 0, min: 10, max: 120, step: 5 },
  points:          { min: 0, max: 20, step: 1 },   // each of civilian/undercover/blank
  packIds:         { maxItems: 50, idRegex: `^[a-z0-9-]{1,${PACK_ID_MAX}}$` },
} as const;
