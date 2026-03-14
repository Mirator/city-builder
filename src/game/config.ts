import type { GameConfig } from "./types";
import { zeroResources } from "../utils/resource";

export const GAME_CONFIG: GameConfig = {
  startingResources: {
    gold: 12,
    population: 30,
    happiness: 60,
    pollution: 0,
  },
  victoryRequirements: {
    population: 600,
    minHappiness: 45,
    maxPollution: 25,
    minGold: 0,
    sustainTurns: 3,
  },
  populationCollapseTurn: 10,
  populationCollapseThreshold: 50,
  pollutionPenaltyStep: 10,
  pollutionLossThreshold: 50,
  initialGridSize: 4,
  maxGridSize: 10,
  cardsPerTurn: 4,
  maxPlacementsPerTurn: 2,
  eventCadenceTurns: 3,
  copiesPerCard: 4,
  expansionGoldCost: 3,
};

export const EMPTY_TURN_BREAKDOWN = {
  base: zeroResources(),
  adjacency: zeroResources(),
  upkeep: zeroResources(),
  modifiers: zeroResources(),
  total: zeroResources(),
  pollutionPenalty: zeroResources(),
  final: zeroResources(),
};
