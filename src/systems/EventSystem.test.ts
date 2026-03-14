import { describe, expect, it } from "vitest";
import { EVENT_DATABASE } from "../events/EventDatabase";
import { GAME_CONFIG } from "../game/config";
import type { GameState } from "../game/types";
import { createSeededRng } from "../utils/rng";
import { createGrid } from "../world/Grid";
import { CARD_DATABASE } from "../cards/CardDatabase";
import { resolveTurnResources } from "./ResourceSystem";
import { triggerEvent } from "./EventSystem";

function createState(eventDeck: string[]): GameState {
  const grid = createGrid(10, 4);
  return {
    turn: 3,
    phase: "end",
    status: "running",
    lossReason: null,
    resources: { gold: 20, population: 30, happiness: 60, pollution: 0 },
    deck: [],
    discard: [],
    hand: [],
    eventDeck: [...eventDeck],
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

describe("EventSystem", () => {
  it("recycles discarded events after the event deck empties", () => {
    const state = createState(["tax_windfall"]);
    const rng = createSeededRng(1);

    const first = triggerEvent(state, EVENT_DATABASE, rng);
    const second = triggerEvent(state, EVENT_DATABASE, rng);

    expect(first?.id).toBe("tax_windfall");
    expect(second?.id).toBe("tax_windfall");
    expect(state.eventDiscard).toEqual(["tax_windfall"]);
  });

  it("applies and expires turn modifiers during resource resolution", () => {
    const state = createState(["housing_grant"]);
    const rng = createSeededRng(7);

    triggerEvent(state, EVENT_DATABASE, rng);
    expect(state.activeModifiers).toHaveLength(1);

    const result = resolveTurnResources(state, GAME_CONFIG, CARD_DATABASE);
    expect(result.modifiers.population).toBe(4);
    expect(state.resources.population).toBe(34);
    expect(state.activeModifiers).toHaveLength(0);
  });
});
