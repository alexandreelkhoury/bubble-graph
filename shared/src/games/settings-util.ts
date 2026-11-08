// Zod-free helpers for GameDefinition.settings (JAMAA-PLATFORM §2.2). Server, sim and tests only.

/** Deep copy of a plain JSON value. */
export function cloneJson<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/**
 * `normalize` for flat settings objects: every key of `defaults`, in its order, taken from `raw` when `valid(key, value)`
 * accepts it, else a fresh copy of the default. Extra keys are dropped; a non-object `raw` gives the defaults.
 */
export function normalizeByDefaults<S extends object>(raw: unknown, defaults: S, valid: (key: keyof S, value: unknown) => boolean): S {
  const src = raw !== null && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const out = {} as Record<string, unknown>;
  for (const k of Object.keys(defaults) as (keyof S & string)[]) {
    const v = src[k];
    out[k] = v !== undefined && valid(k, v) ? cloneJson(v) : cloneJson(defaults[k]);
  }
  return out as S;
}

export const oneOf = (xs: readonly unknown[]) => (v: unknown): boolean => xs.includes(v);
export const isBool = (v: unknown): v is boolean => typeof v === "boolean";
export const isStringArray = (re: RegExp, max: number) => (v: unknown): boolean =>
  Array.isArray(v) && v.length <= max && new Set(v).size === v.length && v.every((x) => typeof x === "string" && re.test(x));
