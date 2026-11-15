// Taqriban content tests: the shipped packs (GAME-TAQRIBAN §11) and the content-lint rules for this game.
import { describe, expect, it } from "vitest";
import { PACKS } from "../index";
import { content } from "../../../shared/src/games/taqriban/content";
import { modeOf, validGuess } from "../../../shared/src/games/taqriban/constants";
import { lintTaqribanRaw } from "../../../tools/content-lint/src/games/taqriban";

const packs = PACKS.map((p) => content.parse(p));

describe("taqriban packs", () => {
  it("parse; ids unique across packs; every item in en/fr/ar/es; ≥ 120 questions", () => {
    const ids = packs.flatMap((p) => p.items.map((i) => i.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(120);
    for (const p of packs) {
      expect(p.locales).toEqual(["en", "fr", "ar", "es"]);
      for (const it of p.items) for (const l of p.locales) expect(it.text[l], `${it.id} ${l}`).toBeTruthy();
    }
  });
  it("every answer is a positive number a phone could type exactly or within 2 % (Bullseye reachable)", () => {
    for (const it of packs.flatMap((p) => p.items)) {
      expect(it.answer).toBeGreaterThan(0);
      expect(validGuess(Math.round(it.answer * 100) / 100), it.id).toBe(true);
    }
  });
  it("mixes the ratio and the absolute rule, and world with Lebanon/Middle East questions", () => {
    const all = packs.flatMap((p) => p.items);
    expect(all.filter((i) => modeOf(i.answer) === "absolute").length).toBeGreaterThan(15);
    expect(all.filter((i) => modeOf(i.answer) === "ratio").length).toBeGreaterThan(60);
    expect(all.filter((i) => i.tags.includes("lebanon")).length).toBeGreaterThanOrEqual(20);
  });
  it("every item is a draft with a source and a checkable reference (truth review pending)", () => {
    for (const it of packs.flatMap((p) => p.items)) {
      expect(it.review.status).toBe("draft");
      expect(it.source.length).toBeGreaterThan(2);
      expect(it.review.ref.length).toBeGreaterThan(2);
    }
  });
  it("content-lint: no error; drafts are an error only with --release", () => {
    const raw = PACKS.map((p, i) => ({ file: `p${i}`, raw: p }));
    expect(lintTaqribanRaw(raw).errors).toEqual([]);
    expect(lintTaqribanRaw(raw, { release: true }).errors.length).toBeGreaterThan(0);
  });
});
