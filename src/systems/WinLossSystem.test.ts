import { describe, expect, it } from "vitest";
import { GAME_CONFIG } from "../game/config";
import type { GameState } from "../game/types";
import { createGrid } from "../world/Grid";
import { evaluateStatus } from "./WinLossSystem";

function baseState(): GameState {
  const grid = createGrid(10, 4);
  return {
    turn: 1,
    phase: "placement",
    status: "running",
    lossReason: null,
    resources: { gold: 20, population: 30, happiness: 60, pollution: 0 },
    deck: [],
    discard: [],
    hand: [],
    eventDeck: [],
    eventDiscard: [],
    lastEventName: null,
    activeModifiers: [],
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
    rngSeed: 1,
  };
}

describe("WinLossSystem", () => {
  it("flags bankruptcy when gold drops below zero", () => {
    const state = baseState();
    state.resources.gold = -1;
    const result = evaluateStatus(state, GAME_CONFIG);
    expect(result.status).toBe("lost");
    expect(result.reason).toContain("Bankruptcy");
  });

  it("flags civil unrest when happiness is zero or less", () => {
    const state = baseState();
    state.resources.happiness = 0;
    const result = evaluateStatus(state, GAME_CONFIG);
    expect(result.status).toBe("lost");
    expect(result.reason).toContain("Civil unrest");
  });

  it("flags population collapse after threshold turn", () => {
    const state = baseState();
    state.turn = 10;
    state.resources.population = 49;
    const result = evaluateStatus(state, GAME_CONFIG);
    expect(result.status).toBe("lost");
    expect(result.reason).toContain("Population collapse");
  });

  it("returns victory when population target is reached", () => {
    const state = baseState();
    state.resources.population = GAME_CONFIG.victoryPopulation;
    const result = evaluateStatus(state, GAME_CONFIG);
    expect(result.status).toBe("won");
  });
});
