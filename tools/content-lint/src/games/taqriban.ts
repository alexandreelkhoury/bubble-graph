// Taqriban! content rules (GAME-TAQRIBAN §11; JAMAA-PLATFORM §5.5).
//
// The common pass (../common.ts) has already parsed every pack through the Taqriban ContentAdapter (zod: ids, tags,
// positive answer, every listed locale present). This file adds the style and truth-hygiene rules of §11.2. Pure.
import type { Findings } from "../platform";
import type { GameLint, ParsedPack } from "./types";

export const TAQRIBAN_LOCALES = ["en", "fr", "ar", "es"] as const;
type Loc = (typeof TAQRIBAN_LOCALES)[number];

/** §11.2: a playable pack offers enough questions for two Long games (14) without a rerun. */
export const MIN_ITEMS = 28;
/** §11.2: AR uses Western digits like the UI. */
const AR_EASTERN_DIGITS = /[٠-٩]/u;
/** §11.2: a question ends with its language's question mark. */
const QMARK: Readonly<Record<Loc, RegExp>> = { en: /\?$/u, fr: /\?$/u, ar: /؟$/u, es: /¿[^?]*\?$/su };
const FR_SPACE_BEFORE_Q = /\s\?$/u;

interface Item {
  id: string; tier: string; text: Partial<Record<Loc, string>>; answer: number; source: string;
  review: { status: string; ref: string };
}

const norm = (s: string): string => s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

export function lintTaqribanRaw(entries: readonly { file: string; raw: unknown }[], opts: { release?: boolean } = {}): Findings {
  const c: Findings = { errors: [], warnings: [] };
  const seenIds = new Map<string, string>();
  const seenText = new Map<string, string>();
  for (const { file, raw } of entries) {
    const pack = raw as { id?: string; items?: Item[]; locales?: Loc[] };
    const P = pack.id ?? file;
    const items = Array.isArray(pack.items) ? pack.items : [];
    if (items.length < MIN_ITEMS) c.warnings.push(`${P}: ${items.length} questions (< ${MIN_ITEMS}: two Long games would rerun)`);
    let drafts = 0;
    for (const it of items) {
      const at = `${P}/${it.id}`;
      const prev = seenIds.get(it.id);
      if (prev !== undefined) c.errors.push(`${at}: id also used in ${prev} (ids are unique across Taqriban packs)`);
      else seenIds.set(it.id, P);
      // Truth hygiene: every number carries a public source and a checkable reference.
      if (!it.source || it.source.trim().length < 3) c.errors.push(`${at}: missing source`);
      if (!it.review?.ref || it.review.ref.trim().length < 3) c.errors.push(`${at}: missing review.ref (where the number was checked)`);
      // A year as the answer breaks the ratio rule (±2 % of 2007 is ±40 years): ask for a duration instead.
      if (Number.isInteger(it.answer) && it.answer >= 1000 && it.answer <= 2100 && /\b(year|when)\b/i.test(it.text.en ?? "")) {
        c.errors.push(`${at}: a calendar year as the answer (ask for a count or a duration)`);
      }
      if (Math.abs(Math.round(it.answer * 1000) - it.answer * 1000) > 1e-6) c.warnings.push(`${at}: answer ${it.answer} has more than 3 decimals`);
      for (const l of TAQRIBAN_LOCALES) {
        const t = it.text[l];
        if (t === undefined) continue;
        if (!QMARK[l].test(t)) c.errors.push(`${at}: ${l} text must end with ${l === "ar" ? "«؟»" : l === "es" ? "«¿…?»" : "«?»"}`);
        if (l === "fr" && !FR_SPACE_BEFORE_Q.test(t)) c.warnings.push(`${at}: fr wants a space before « ? »`);
        if (l === "ar" && AR_EASTERN_DIGITS.test(t)) c.errors.push(`${at}: ar uses Eastern Arabic digits (use 0–9 like the UI)`);
        const k = `${l}|${norm(t)}`;
        const dup = seenText.get(k);
        if (dup !== undefined) c.errors.push(`${at}: same ${l} question as ${dup}`);
        else seenText.set(k, at);
      }
      if (it.tier === "free" && it.review?.status === "draft") {
        drafts += 1;
        if (opts.release) c.errors.push(`${at}: a free question must be reviewed before release (review.status is "draft")`);
      }
    }
    if (!opts.release && drafts > 0) c.warnings.push(`${P}: ${drafts} free question(s) are still drafts (an error with --release)`);
  }
  return c;
}

export const lint: GameLint = (packs: readonly ParsedPack[], opts) => lintTaqribanRaw(packs.map((p) => ({ file: p.file, raw: p.raw })), opts);
