import { describe, expect, it } from "vitest";
import { CONTENT, PACKS } from "../index";
import vocab from "../vocab.json";

describe("content registry (JAMAA-PLATFORM §5.1)", () => {
  it("has one array per game, in GAME_IDS order, with the Mish Ana! packs under mishana", () => {
    expect(Object.keys(CONTENT)).toEqual(["mishana", "bluff", "likely", "trivia"]);
    expect(CONTENT.mishana.length).toBe(23);
    expect(PACKS).toBe(CONTENT.mishana);
    for (const p of CONTENT.mishana) expect((p as { id?: unknown }).id).toBeTypeOf("string");
  });
});

describe("vocab.json (§5.4)", () => {
  const kebab = /^[a-z]+(-[a-z]+)*$/;
  it("lists the decided domains, topics and regions, each kebab-case and unique", () => {
    expect(vocab.domains).toEqual(["lebanon", "middle-east", "arab-world", "france", "world", "general"]);
    expect(vocab.topics).toHaveLength(16);
    expect(vocab.regions).toEqual(["beirut", "mount-lebanon", "north", "south", "bekaa"]);
    for (const list of [vocab.domains, vocab.topics, vocab.regions]) {
      expect(new Set(list).size).toBe(list.length);
      for (const v of list) expect(kebab.test(v), v).toBe(true);
    }
  });
});
