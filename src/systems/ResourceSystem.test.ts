import { describe, expect, it } from "vitest";
import { CARD_DATABASE } from "../cards/CardDatabase";
import { GAME_CONFIG } from "../game/config";
import type { GameState } from "../game/types";
import { resolveTurnResources } from "./ResourceSystem";
import { createGrid, getPlacedCards, placeCard } from "../world/Grid";

function makeState(): GameState {
  const grid = createGrid(10, 4);
  const state: GameState = {
    turn: 3,
    phase: "resolution",
    status: "running",
    lossReason: null,
    resources: { gold: 20, population: 30, happiness: 60, pollution: 9 },
    deck: [],
    discard: [],
    hand: [],
    eventDeck: [],
    eventDiscard: [],
    lastEventName: null,
    activeModifiers: [{ id: "mod1", name: "Boost", effect: { gold: 5 }, remainingTurns: 1 }],
    grid,
    placedCards: [],
    cursor: { x: grid.activeBounds.minX, y: grid.activeBounds.minY },
    selectedHandIndex: null,
    placementsRemaining: 2,
    infrastructurePlaced: 0,
    lastTurnBreakdown: {
      base: { gold: 0, population: 0, happiness: 0, pollution: 0 },
      adjacency: { gold: 0, population: 0, happiness: 0, pollution: 0 },
      modifiers: { gold: 0, population: 0, happiness: 0, pollution: 0 },
      total: { gold: 0, population: 0, happiness: 0, pollution: 0 },
      pollutionPenalty: 0,
    },
    log: [],
    rngSeed: 42,
  };

  const x = grid.activeBounds.minX;
  const y = grid.activeBounds.minY;
  placeCard(grid, x, y, "apartment");
  placeCard(grid, x + 1, y, "park");
  state.placedCards = getPlacedCards(grid);

  return state;
}

describe("ResourceSystem", () => {
  it("combines base, adjacency, modifiers, and pollution penalty", () => {
    const state = makeState();
    const breakdown = resolveTurnResources(state, GAME_CONFIG, CARD_DATABASE);

    expect(breakdown.base).toMatchObject({
      gold: 1,
      population: 4,
      happiness: 3,
      pollution: -1,
    });
    expect(breakdown.adjacency.happiness).toBe(3);
    expect(breakdown.modifiers.gold).toBe(5);
    expect(state.resources.gold).toBe(26);
    expect(state.resources.pollution).toBe(8);
    expect(breakdown.pollutionPenalty).toBe(0);
    expect(state.activeModifiers).toHaveLength(0);
  });
});
