import type { GameConfig } from "./types";
import { zeroResources } from "../utils/resource";

export const GAME_CONFIG: GameConfig = {
  startingResources: {
    gold: 20,
    population: 30,
    happiness: 60,
    pollution: 0,
  },
  victoryPopulation: 1000,
  populationCollapseTurn: 10,
  populationCollapseThreshold: 50,
  pollutionPenaltyStep: 10,
  initialGridSize: 4,
  maxGridSize: 10,
  cardsPerTurn: 5,
  maxPlacementsPerTurn: 2,
  eventCadenceTurns: 3,
  copiesPerCard: 4,
};

export const EMPTY_TURN_BREAKDOWN = {
  base: zeroResources(),
  adjacency: zeroResources(),
  modifiers: zeroResources(),
  total: zeroResources(),
  pollutionPenalty: 0,
};
