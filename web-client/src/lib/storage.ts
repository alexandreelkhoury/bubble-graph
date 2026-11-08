// §8.6 Storage keys. Every access is wrapped in try/catch (private mode, blocked storage, quota).
import { BRAND } from "@jamaa/shared/brand";
import { COLORS, LOCALES } from "@jamaa/shared/constants";
import type { ColorId, Locale } from "@jamaa/shared/constants";

export const RESUME_MAX_AGE_MS = 6 * 60 * 60_000;
const P = BRAND.storagePrefix; // "jamaa"

export const KEYS = {
  resume: (code: string) => `${P}:resume:${code}`,
  locale: `${P}:locale`,
  name: `${P}:name`,
  color: `${P}:color`,
  // SPEC-GAP: §8.6 lists no key for the PH-17 vibration toggle; stored under this extra key.
  vibration: `${P}:vibration`,
  // JAMAA-PLATFORM §3.3: per-device first-time how-to and coach marks, per game.
  introSeen: (gameId: string) => `${P}:introSeen:${gameId}`,
  coached: (gameId: string) => `${P}:coached:${gameId}`,
  // JAMAA-PLATFORM §3.8: the hub Settings "Calm animations" row (a platform setting, per device).
  calm: `${P}:calm`,
} as const;

export interface ResumeRecord { playerId: string; resumeToken: string; savedAt: number }

function store(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function readRaw(key: string): string | null {
  try {
    return store()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writeRaw(key: string, value: string): void {
  try {
    store()?.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function removeRaw(key: string): void {
  try {
    store()?.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** Returns the resume record for `code`, deleting it when it is malformed or older than 6 h. */
/**
 * JAMAA-PLATFORM §1.5: one-time migration from the pre-JAMAA prefix. Preferences are copied when the new key is not
 * set yet (a new key always wins); every other legacy key (resume tokens, the TV mock's fake-billing cache) is dropped,
 * since v1 resume tokens cannot join a v2 room and fake billing state is disposable. Every legacy key is removed, so a
 * second run finds nothing to do. Never throws.
 */
export const LEGACY_PREFIX: string = "mishana";
/** The preference keys carried over (§1.5 lists locale, name, color, tvSound; vibration is the SPEC-GAP key above). */
export const MIGRATED_KEYS = ["locale", "name", "color", "tvSound", "vibration"] as const;

export function migrateLegacyKeys(): void {
  try {
    const s = store();
    if (!s || P === LEGACY_PREFIX) return;
    const legacy: string[] = [];
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (k !== null && k.startsWith(`${LEGACY_PREFIX}:`)) legacy.push(k);
    }
    for (const k of MIGRATED_KEYS) {
      const old = s.getItem(`${LEGACY_PREFIX}:${k}`);
      if (old !== null && s.getItem(`${P}:${k}`) === null) s.setItem(`${P}:${k}`, old);
    }
    for (const k of legacy) s.removeItem(k);
  } catch {
    /* blocked storage or quota: the old keys stay, the app reads the new (empty) ones */
  }
}
// Runs once when this module is first evaluated: every reader imports this module, so this is before any read.
migrateLegacyKeys();

export function loadResume(code: string, now: number = Date.now()): ResumeRecord | null {
  const raw = readRaw(KEYS.resume(code));
  if (raw === null) return null;
  try {
    const r = JSON.parse(raw) as Partial<ResumeRecord>;
    if (
      typeof r.playerId === "string" && typeof r.resumeToken === "string" && typeof r.savedAt === "number" &&
      /^[0-9a-f]{32}$/.test(r.resumeToken) && now - r.savedAt <= RESUME_MAX_AGE_MS && r.savedAt <= now + 60_000
    ) {
      return { playerId: r.playerId, resumeToken: r.resumeToken, savedAt: r.savedAt };
    }
  } catch {
    /* fall through */
  }
  removeRaw(KEYS.resume(code));
  return null;
}

export function saveResume(code: string, playerId: string, resumeToken: string, now: number = Date.now()): void {
  writeRaw(KEYS.resume(code), JSON.stringify({ playerId, resumeToken, savedAt: now }));
}

export function clearResume(code: string): void {
  removeRaw(KEYS.resume(code));
}

export function loadLocale(): Locale | null {
  const v = readRaw(KEYS.locale);
  return v !== null && (LOCALES as readonly string[]).includes(v) ? (v as Locale) : null;
}
export function saveLocale(l: Locale): void { writeRaw(KEYS.locale, l); }

export function loadName(): string { return readRaw(KEYS.name) ?? ""; }
export function saveName(n: string): void { writeRaw(KEYS.name, n); }

export function loadColor(): ColorId | null {
  const v = readRaw(KEYS.color);
  return COLORS.some((c) => c.id === v) ? (v as ColorId) : null;
}
export function saveColor(c: ColorId): void { writeRaw(KEYS.color, c); }

export function loadVibration(): boolean { return readRaw(KEYS.vibration) !== "off"; }
export function saveVibration(on: boolean): void { writeRaw(KEYS.vibration, on ? "on" : "off"); }

/** JAMAA-PLATFORM §3.3: whether this device has seen `gameId`'s first-time how-to. */
export function introSeen(gameId: string): boolean {
  return readRaw(KEYS.introSeen(gameId)) === "1";
}
export function markIntroSeen(gameId: string): void {
  writeRaw(KEYS.introSeen(gameId), "1");
}
export function coached(gameId: string): boolean {
  return readRaw(KEYS.coached(gameId)) === "1";
}
export function markCoached(gameId: string): void {
  writeRaw(KEYS.coached(gameId), "1");
}
/** "Show how-to again" (hub Settings, phone ⋯): clears every `introSeen:*` and `coached:*` flag. */
export function clearHowToFlags(): void {
  const s = store();
  if (!s) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (k && (k.startsWith(`${P}:introSeen:`) || k.startsWith(`${P}:coached:`))) keys.push(k);
    }
    for (const k of keys) s.removeItem(k);
  } catch {
    /* ignore */
  }
}
