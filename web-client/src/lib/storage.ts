// §8.6 Storage keys. Every access is wrapped in try/catch (private mode, blocked storage, quota).
import { BRAND } from "@mishana/shared/brand";
import { COLORS, LOCALES } from "@mishana/shared/constants";
import type { ColorId, Locale } from "@mishana/shared/constants";

export const RESUME_MAX_AGE_MS = 6 * 60 * 60_000;
const P = BRAND.storagePrefix; // "mishana"

export const KEYS = {
  resume: (code: string) => `${P}:resume:${code}`,
  locale: `${P}:locale`,
  name: `${P}:name`,
  color: `${P}:color`,
  // SPEC-GAP: §8.6 lists no key for the PH-17 vibration toggle; stored under this extra key.
  vibration: `${P}:vibration`,
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
