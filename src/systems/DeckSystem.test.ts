import { describe, expect, it } from "vitest";
import { buildDeck, discardCards, drawCards } from "./DeckSystem";
import { createSeededRng } from "../utils/rng";

describe("DeckSystem", () => {
  it("builds a deck with configured copies per card", () => {
    const deck = buildDeck(["a", "b"], 3);
    expect(deck).toHaveLength(6);
    expect(deck.filter((card) => card === "a")).toHaveLength(3);
    expect(deck.filter((card) => card === "b")).toHaveLength(3);
  });

  it("draws, discards, and reshuffles discard into deck", () => {
    const rng = createSeededRng(123);
    const state = {
      deck: ["x"],
      discard: ["a", "b", "c"],
    };

    const drawn = drawCards(state, 3, rng);
    expect(drawn).toHaveLength(3);
    expect(new Set(drawn).size).toBe(3);
    expect(state.discard).toHaveLength(0);

    discardCards(state, ["q", "r"]);
    expect(state.discard).toEqual(["q", "r"]);
  });
});
