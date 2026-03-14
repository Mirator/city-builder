import type { CardDefinition } from "../cards/Card";
import type { GameConfig, GameState, Resources, TurnBreakdown } from "../game/types";
import { addManyResources, addResources, clampPollution, zeroResources } from "../utils/resource";
import { getPlacedCards } from "../world/Grid";
import { calculateAdjacencyYield } from "./AdjacencySystem";

function sumBaseYield(
  state: GameState,
  cardDatabase: Record<string, CardDefinition>,
): Resources {
  const baseValues: Array<Partial<Resources>> = [];
  for (const placed of getPlacedCards(state.grid)) {
    const card = cardDatabase[placed.cardId];
    if (!card) {
      continue;
    }
    baseValues.push(card.baseYield);
  }
  return addManyResources(baseValues);
}

function sumUpkeep(
  state: GameState,
  cardDatabase: Record<string, CardDefinition>,
): Resources {
  const upkeepValues: Array<Partial<Resources>> = [];
  for (const placed of getPlacedCards(state.grid)) {
    const card = cardDatabase[placed.cardId];
    if (!card?.upkeep) {
      continue;
    }
    upkeepValues.push(card.upkeep);
  }
  return addManyResources(upkeepValues);
}

function sumActiveModifiers(state: GameState): Resources {
  return addManyResources(state.activeModifiers.map((modifier) => modifier.effect));
}

function consumeActiveModifiers(state: GameState): void {
  state.activeModifiers = state.activeModifiers
    .map((modifier) => ({
      ...modifier,
      remainingTurns: modifier.remainingTurns - 1,
    }))
    .filter((modifier) => modifier.remainingTurns > 0);
}

export function calculateTurnBreakdown(
  state: GameState,
  cardDatabase: Record<string, CardDefinition>,
): TurnBreakdown {
  const base = sumBaseYield(state, cardDatabase);
  const adjacency = calculateAdjacencyYield(state.grid, cardDatabase);
  const upkeep = sumUpkeep(state, cardDatabase);
  const modifiers = sumActiveModifiers(state);
  const total = addManyResources([base, adjacency, upkeep, modifiers]);
  return {
    base,
    adjacency,
    upkeep,
    modifiers,
    total,
    pollutionPenalty: zeroResources(),
    final: total,
  };
}

export function resolveTurnResources(
  state: GameState,
  config: GameConfig,
  cardDatabase: Record<string, CardDefinition>,
): TurnBreakdown {
  const breakdown = calculateTurnBreakdown(state, cardDatabase);
  const startingResources = { ...state.resources };
  let updatedResources = addResources(startingResources, breakdown.total);
  updatedResources = clampPollution(updatedResources);

  const pollutionPenalty = calculatePollutionPenalty(
    updatedResources.pollution,
    config.pollutionPenaltyStep,
  );
  updatedResources = addResources(updatedResources, pollutionPenalty);

  state.resources = updatedResources;
  consumeActiveModifiers(state);

  const final = {
    gold: updatedResources.gold - startingResources.gold,
    population: updatedResources.population - startingResources.population,
    happiness: updatedResources.happiness - startingResources.happiness,
    pollution: updatedResources.pollution - startingResources.pollution,
  };

  const finalBreakdown: TurnBreakdown = {
    ...breakdown,
    pollutionPenalty,
    final,
  };
  state.lastTurnBreakdown = finalBreakdown;
  state.log.unshift(
    `Turn ${state.turn} resolved: G ${formatSigned(finalBreakdown.final.gold)}, P ${formatSigned(
      finalBreakdown.final.population,
    )}, H ${formatSigned(finalBreakdown.final.happiness)}, Pol ${formatSigned(
      finalBreakdown.final.pollution,
    )}`,
  );
  state.log = state.log.slice(0, 10);
  return finalBreakdown;
}

export function emptyBreakdown(): TurnBreakdown {
  return {
    base: zeroResources(),
    adjacency: zeroResources(),
    upkeep: zeroResources(),
    modifiers: zeroResources(),
    total: zeroResources(),
    pollutionPenalty: zeroResources(),
    final: zeroResources(),
  };
}

function calculatePollutionPenalty(pollution: number, step: number): Resources {
  const bands = Math.floor(Math.max(0, pollution) / step);
  return {
    gold: bands >= 2 ? -(bands - 1) : 0,
    population: 0,
    happiness: bands > 0 ? -bands : 0,
    pollution: 0,
  };
}

function formatSigned(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`;
}
