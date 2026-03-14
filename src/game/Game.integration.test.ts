import { describe, expect, it } from "vitest";
import { Game } from "./Game";
import { GAME_CONFIG } from "./config";
import { activeGridSize } from "../world/Grid";

describe("Game integration", () => {
  it("triggers an event every third turn", () => {
    const game = new Game(1234);

    game.endPlacementPhase();
    expect(game.getState().turn).toBe(2);
    expect(game.getState().lastEventName).toBeNull();

    game.endPlacementPhase();
    expect(game.getState().turn).toBe(3);
    expect(game.getState().lastEventName).toBeNull();

    game.endPlacementPhase();
    expect(game.getState().turn).toBe(4);
    expect(game.getState().lastEventName).not.toBeNull();
  });

  it("expands the grid after placing 2 infrastructure cards", () => {
    const game = new Game(7);
    const state = game.getState();

    state.resources.gold = 99;
    state.hand = ["road_hub", "utility_node", "house"];
    state.placementsRemaining = 3;

    const x = state.grid.activeBounds.minX;
    const y = state.grid.activeBounds.minY;

    game.selectHandIndex(0);
    expect(game.placeSelectedAt(x, y)).toBe(true);

    game.selectHandIndex(0);
    expect(game.placeSelectedAt(x + 1, y)).toBe(true);

    expect(state.infrastructurePlaced).toBe(2);
    expect(activeGridSize(state.grid)).toBe(6);
    expect(state.resources.gold).toBe(91);
  });

  it("restores a run snapshot with equivalent state", () => {
    const original = new Game(42);
    original.endPlacementPhase();
    original.endPlacementPhase();
    const snapshot = original.toSnapshot();

    const restored = new Game(77);
    expect(restored.fromSnapshot(snapshot)).toBe(true);
    expect(restored.getState()).toEqual(snapshot.state);
  });

  it("resets the game to a fresh run", () => {
    const game = new Game(100);
    game.endPlacementPhase();
    expect(game.getState().turn).toBeGreaterThan(1);

    game.reset(2026);
    const state = game.getState();

    expect(state.turn).toBe(1);
    expect(state.phase).toBe("placement");
    expect(state.status).toBe("running");
    expect(state.resources).toEqual(GAME_CONFIG.startingResources);
    expect(state.rngSeed).toBe(2026);
    expect(state.log[0]).toBe("Run started.");
  });
});
