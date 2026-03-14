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
  const modifiers = sumActiveModifiers(state);
  const total = addManyResources([base, adjacency, modifiers]);
  return {
    base,
    adjacency,
    modifiers,
    total,
    pollutionPenalty: 0,
  };
}

export function resolveTurnResources(
  state: GameState,
  config: GameConfig,
  cardDatabase: Record<string, CardDefinition>,
): TurnBreakdown {
  const breakdown = calculateTurnBreakdown(state, cardDatabase);
  let updatedResources = addResources(state.resources, breakdown.total);
  updatedResources = clampPollution(updatedResources);

  const pollutionPenalty = Math.floor(updatedResources.pollution / config.pollutionPenaltyStep);
  updatedResources.happiness -= pollutionPenalty;

  state.resources = updatedResources;
  consumeActiveModifiers(state);

  const finalBreakdown: TurnBreakdown = {
    ...breakdown,
    pollutionPenalty,
  };
  state.lastTurnBreakdown = finalBreakdown;
  state.log.unshift(
    `Turn ${state.turn} resolved: G ${formatSigned(finalBreakdown.total.gold)}, P ${formatSigned(
      finalBreakdown.total.population,
    )}, H ${formatSigned(
      finalBreakdown.total.happiness - finalBreakdown.pollutionPenalty,
    )}, Pol ${formatSigned(finalBreakdown.total.pollution)}`,
  );
  state.log = state.log.slice(0, 10);
  return finalBreakdown;
}

export function emptyBreakdown(): TurnBreakdown {
  return {
    base: zeroResources(),
    adjacency: zeroResources(),
    modifiers: zeroResources(),
    total: zeroResources(),
    pollutionPenalty: 0,
  };
}

function formatSigned(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`;
}
