// JAMAA-PLATFORM §8.6: host skips / voids / hides emit one `content_flag` event (game, pack, item; never player data).
import { describe, expect, it } from "vitest";
import type { ContentCatalog } from "@jamaa/shared/content";
import { contentCatalog } from "@jamaa/shared/content";
import type { RoomIntentMsg } from "@jamaa/shared/protocol/v2";
import { TEST_CATALOG } from "@jamaa/shared/testing";
import type { LikelyState } from "../../../shared/src/games/likely/engine/state";
import { likelyTokenCatalog } from "../../../shared/src/testing/catalogs/likely";
import { contentFlag } from "../../src/monitor/content-flags";
import { roomEventPoint } from "../../src/monitor/events";
import type { RoomEvent } from "../../src/monitor/events";
import { Harness, ROOM } from "../support/fakes";

const NO_CONTENT = contentCatalog(TEST_CATALOG);
const TAQ = { ...NO_CONTENT, taqriban: { packs: [{ id: "taq-a", items: [{ id: "x-1" }] }, { id: "taq-b", items: [{ id: "tl-007" }] }] } } as unknown as ContentCatalog;

describe("contentFlag (pure)", () => {
  it("Bluff: SKIP_PROMPT → skip; HIDE_OPTION → hide_truth / hide_house; a hidden player lie is never reported", () => {
    const s = { prompt: { id: "r1", itemId: "odd-12", packId: "bluff-odd-facts" }, options: [{ id: "o1", kind: "truth" }, { id: "o2", kind: "house" }, { id: "o3", kind: "lie" }] };
    expect(contentFlag("bluff", s, { type: "SKIP_PROMPT", promptId: "r1" }, NO_CONTENT)).toEqual({ action: "skip", packId: "bluff-odd-facts", itemId: "odd-12" });
    expect(contentFlag("bluff", s, { type: "HIDE_OPTION", optionId: "o1" }, NO_CONTENT)).toEqual({ action: "hide_truth", packId: "bluff-odd-facts", itemId: "odd-12" });
    expect(contentFlag("bluff", s, { type: "HIDE_OPTION", optionId: "o2" }, NO_CONTENT)?.action).toBe("hide_house");
    expect(contentFlag("bluff", s, { type: "HIDE_OPTION", optionId: "o3" }, NO_CONTENT)).toBeNull();
    expect(contentFlag("bluff", { prompt: null }, { type: "SKIP_PROMPT", promptId: "r1" }, NO_CONTENT)).toBeNull();
  });

  it("Likely SKIP_CARD, Trivia VOID_QUESTION (once), Taqriban SKIP_QUESTION (pack looked up); others → null", () => {
    expect(contentFlag("likely", { card: { cardId: "c9", packId: "likely-family" } }, { type: "SKIP_CARD", cardId: "c9" }, NO_CONTENT)).toEqual({ action: "skip", packId: "likely-family", itemId: "c9" });
    const tr = { quiz: { packId: "world-mix-01-en" }, last: { questionId: "q007", voided: false } };
    expect(contentFlag("trivia", tr, { type: "VOID_QUESTION" }, NO_CONTENT)).toEqual({ action: "void", packId: "world-mix-01-en", itemId: "q007" });
    expect(contentFlag("trivia", { ...tr, last: { questionId: "q007", voided: true } }, { type: "VOID_QUESTION" }, NO_CONTENT)).toBeNull();
    expect(contentFlag("taqriban", { cur: { id: "tl-007" }, settings: { packIds: [] } }, { type: "SKIP_QUESTION" }, TAQ)).toEqual({ action: "skip", packId: "taq-b", itemId: "tl-007" });
    expect(contentFlag("taqriban", { cur: { id: "nope" }, settings: { packIds: ["taq-a"] } }, { type: "SKIP_QUESTION" }, TAQ)).toEqual({ action: "skip", packId: "?", itemId: "nope" });
    expect(contentFlag("mishana", { phase: "CLUES" }, { type: "HOST_ADVANCE" }, NO_CONTENT)).toBeNull();
    expect(contentFlag("likely", { card: { cardId: "c9", packId: "p" } }, { type: "VOTE" }, NO_CONTENT)).toBeNull();
    expect(contentFlag("likely", null, { type: "SKIP_CARD" }, NO_CONTENT)).toBeNull();
  });

  it("AE layout: blob5 action, blob7 pack, blob8 item; no player field", () => {
    const ev: RoomEvent = { t: "content_flag", room: "KXRT:1", at: 1, gameId: "likely", action: "skip", packId: "likely-family", itemId: "c9", locale: "en", platform: "tv-web" };
    expect(roomEventPoint(ev)).toEqual({ indexes: ["content_flag"], blobs: ["content_flag", "likely", "en", "tv-web", "skip", "", "likely-family", "c9"], doubles: [0, 0, 1] });
  });
});

describe("RoomCore emits content_flag on an accepted host skip", () => {
  it("Likely SKIP_CARD from the TV → one event with the skipped card's pack and id; a refused skip emits nothing", async () => {
    const content = { ...contentCatalog(TEST_CATALOG), likely: likelyTokenCatalog() } as unknown as ContentCatalog;
    const h = await new Harness({ enabledGames: ["mishana", "likely"], content }).init();
    const tv = await h.tv();
    const ps = [await h.player(0), await h.player(1), await h.player(2)];
    await h.open(tv, "likely");
    await h.act(tv, { type: "START_GAME" });
    const card = (h.room.game!.state as LikelyState).card!;
    const flags = (): RoomEvent[] => h.events.filter((e) => e.t === "content_flag");
    // Player 1 is not the host: refused, no event.
    await h.act(ps[1]!.conn, { type: "GAME", gameId: "likely", i: { type: "SKIP_CARD", cardId: card.cardId } } as RoomIntentMsg);
    expect(flags()).toEqual([]);
    await h.act(tv, { type: "GAME", gameId: "likely", i: { type: "SKIP_CARD", cardId: card.cardId } } as RoomIntentMsg);
    expect(flags()).toEqual([{ t: "content_flag", room: `${ROOM}:${h.core.peek().meta!.createdAt}`, at: h.now, gameId: "likely", action: "skip", packId: card.packId, itemId: card.cardId, locale: "en", platform: "unknown" }]);
    const json = JSON.stringify(flags());
    for (const p of ps) expect(json).not.toContain(p.pid);
  });
});
