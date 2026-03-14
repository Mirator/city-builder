import type { CardDefinition } from "../cards/Card";
import type { GameStatus } from "./types";
import { Game } from "./Game";
import { getOrthogonalNeighbors, isOccupied, isUnlocked } from "../world/Grid";

export interface SimulationResult {
  seed: number;
  turn: number;
  status: GameStatus;
  reason: string | null;
  population: number;
  gold: number;
  happiness: number;
  pollution: number;
}

export interface SimulationBatchSummary {
  count: number;
  wins: number;
  losses: number;
  averageTurn: number;
  minTurn: number;
  maxTurn: number;
  results: SimulationResult[];
}

export function runDeterministicSimulation(seed: number, maxTurns = 500): SimulationResult {
  const game = new Game(seed);
  const cardDatabase = game.getCardDatabase();

  while (game.getState().status === "running" && game.getState().turn <= maxTurns) {
    const state = game.getState();
    while (state.phase === "placement" && state.placementsRemaining > 0) {
      const bestIndex = pickBestCardIndex(state.hand, state.resources.gold, cardDatabase);
      if (bestIndex === null) {
        break;
      }
      const cardId = state.hand[bestIndex];
      const target = findBestPlacement(state, cardId, cardDatabase);
      if (!target) {
        break;
      }
      game.selectHandIndex(bestIndex);
      const placed = game.placeSelectedAt(target.x, target.y);
      if (!placed) {
        break;
      }
    }

    if (game.getState().status === "running" && game.getState().phase === "placement") {
      game.endPlacementPhase();
    }
  }

  const state = game.getState();
  return {
    seed,
    turn: state.turn,
    status: state.status,
    reason: state.lossReason,
    population: state.resources.population,
    gold: state.resources.gold,
    happiness: state.resources.happiness,
    pollution: state.resources.pollution,
  };
}

export function runDeterministicBatch(
  startSeed: number,
  count: number,
  maxTurns = 500,
): SimulationBatchSummary {
  const results: SimulationResult[] = [];
  for (let i = 0; i < count; i += 1) {
    const seed = (startSeed + i) >>> 0;
    results.push(runDeterministicSimulation(seed, maxTurns));
  }

  const wins = results.filter((result) => result.status === "won").length;
  const losses = results.length - wins;
  const turns = results.map((result) => result.turn);
  const totalTurns = turns.reduce((sum, turn) => sum + turn, 0);

  return {
    count: results.length,
    wins,
    losses,
    averageTurn: results.length > 0 ? totalTurns / results.length : 0,
    minTurn: results.length > 0 ? Math.min(...turns) : 0,
    maxTurn: results.length > 0 ? Math.max(...turns) : 0,
    results,
  };
}

function pickBestCardIndex(
  hand: string[],
  currentGold: number,
  cardDatabase: Record<string, CardDefinition>,
): number | null {
  let bestIndex: number | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < hand.length; index += 1) {
    const cardId = hand[index];
    const card = cardDatabase[cardId];
    if (!card || card.cost > currentGold) {
      continue;
    }
    const score =
      card.baseYield.population * 3 +
      card.baseYield.happiness * 2 +
      card.baseYield.gold -
      card.baseYield.pollution -
      card.cost;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }

  return bestIndex;
}

function findBestPlacement(
  state: ReturnType<Game["getState"]>,
  cardId: string,
  cardDatabase: Record<string, CardDefinition>,
): { x: number; y: number } | null {
  const card = cardDatabase[cardId];
  if (!card) {
    return null;
  }

  let best: { x: number; y: number; score: number } | null = null;

  for (let y = state.grid.activeBounds.minY; y <= state.grid.activeBounds.maxY; y += 1) {
    for (let x = state.grid.activeBounds.minX; x <= state.grid.activeBounds.maxX; x += 1) {
      if (!isUnlocked(state.grid, x, y) || isOccupied(state.grid, x, y)) {
        continue;
      }
      const neighbors = getOrthogonalNeighbors(state.grid, x, y);
      let score = 0;

      for (const neighbor of neighbors) {
        if (!neighbor.cardId) {
          continue;
        }
        const neighborCard = cardDatabase[neighbor.cardId];
        if (!neighborCard) {
          continue;
        }
        for (const rule of card.adjacencyRules) {
          const byId = rule.neighborCardId === neighbor.cardId;
          const byCategory = rule.neighborCategory === neighborCard.category;
          if (!byId && !byCategory) {
            continue;
          }
          score += (rule.effect.population ?? 0) * 3;
          score += (rule.effect.happiness ?? 0) * 2;
          score += rule.effect.gold ?? 0;
          score -= rule.effect.pollution ?? 0;
        }
      }

      if (!best || score > best.score) {
        best = { x, y, score };
      }
    }
  }

  return best ? { x: best.x, y: best.y } : null;
}
