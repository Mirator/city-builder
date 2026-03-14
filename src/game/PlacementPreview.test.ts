import { describe, expect, it } from "vitest";
import { Game } from "./Game";
import { placeCard } from "../world/Grid";

describe("Game placement preview", () => {
  it("combines cost, base yield, and bidirectional adjacency for valid tiles", () => {
    const game = new Game(101);
    const state = game.getState();
    const x = state.grid.activeBounds.minX;
    const y = state.grid.activeBounds.minY;

    state.resources.gold = 99;
    state.hand = ["apartment"];
    state.selectedHandIndex = 0;

    placeCard(state.grid, x + 1, y, "market");
    placeCard(state.grid, x, y + 1, "park");

    const preview = game.getPlacementPreview(0, x, y);

    expect(preview.canPlace).toBe(true);
    expect(preview.reason).toBeNull();
    expect(preview.immediateDelta).toEqual({
      gold: 0,
      population: 4,
      happiness: 3,
      pollution: 0,
    });
  });

  it("returns deterministic block reasons", () => {
    const game = new Game(102);
    const state = game.getState();
    const x = state.grid.activeBounds.minX;
    const y = state.grid.activeBounds.minY;

    state.hand = ["house"];
    state.resources.gold = 0;

    expect(game.getPlacementPreview(0, x, y).reason).toBe("insufficient_gold");

    state.resources.gold = 20;
    placeCard(state.grid, x, y, "park");
    expect(game.getPlacementPreview(0, x, y).reason).toBe("occupied");
    expect(game.getPlacementPreview(0, x - 1, y).reason).toBe("locked");

    state.hand = [];
    expect(game.getPlacementPreview(0, x, y + 1).reason).toBe("no_selection");
  });

  it("sets cursor directly only on unlocked coordinates", () => {
    const game = new Game(103);
    const state = game.getState();
    const nextX = state.grid.activeBounds.minX + 1;
    const nextY = state.grid.activeBounds.minY;

    expect(game.setCursor(nextX, nextY)).toBe(true);
    expect(game.getState().cursor).toEqual({ x: nextX, y: nextY });

    expect(game.setCursor(state.grid.activeBounds.minX - 1, nextY)).toBe(false);
    expect(game.getState().cursor).toEqual({ x: nextX, y: nextY });
  });
});
