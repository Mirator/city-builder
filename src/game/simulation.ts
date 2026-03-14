import type { CardDefinition } from "../cards/Card";
import type { GameConfig, Resources } from "./types";
import type { GameStatus } from "./types";
import { Game } from "./Game";
import { canExpandGridRing, getOrthogonalNeighbors, isOccupied, isUnlocked } from "../world/Grid";
import { addResources, zeroResources } from "../utils/resource";

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
  const config = game.getConfig();

  while (game.getState().status === "running" && game.getState().turn <= maxTurns) {
    const state = game.getState();
    while (state.phase === "placement" && state.placementsRemaining > 0) {
      const bestIndex = pickBestCardIndex(state.hand, state.resources, cardDatabase, config);
      if (bestIndex === null) {
        break;
      }
      const cardId = state.hand[bestIndex];
      const target = findBestPlacement(state, cardId, cardDatabase, config);
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
  resources: Resources,
  cardDatabase: Record<string, CardDefinition>,
  config: GameConfig,
): number | null {
  let bestIndex: number | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < hand.length; index += 1) {
    const cardId = hand[index];
    const card = cardDatabase[cardId];
    if (!card || card.cost > resources.gold) {
      continue;
    }
    const upkeep = card.upkeep ?? {};
    const populationWeight =
      resources.population < config.victoryRequirements.population ? 3 : 1.5;
    const happinessWeight =
      resources.happiness < config.victoryRequirements.minHappiness ? 3 : 2;
    const goldWeight = resources.gold < 8 ? 2 : 1;
    const pollutionWeight =
      resources.pollution >= config.victoryRequirements.maxPollution ? 4 : 2;
    const score =
      card.baseYield.population * populationWeight +
      (card.baseYield.happiness + (upkeep.happiness ?? 0)) * happinessWeight +
      (card.baseYield.gold + (upkeep.gold ?? 0)) * goldWeight -
      (card.baseYield.pollution + (upkeep.pollution ?? 0)) * pollutionWeight -
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
  config: GameConfig,
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
      const delta = calculatePlacementDelta(state, card, neighbors, cardDatabase, config);
      const score = scoreDelta(delta, state.resources, config);

      if (!best || score > best.score) {
        best = { x, y, score };
      }
    }
  }

  return best ? { x: best.x, y: best.y } : null;
}

function calculatePlacementDelta(
  state: ReturnType<Game["getState"]>,
  card: CardDefinition,
  neighbors: ReturnType<typeof getOrthogonalNeighbors>,
  cardDatabase: Record<string, CardDefinition>,
  config: GameConfig,
): Resources {
  let delta = zeroResources();
  delta = addResources(delta, card.baseYield);
  delta = addResources(delta, card.upkeep ?? {});
  delta.gold -= card.cost;

  for (const neighbor of neighbors) {
    if (!neighbor.cardId) {
      continue;
    }
    const neighborCard = cardDatabase[neighbor.cardId];
    if (!neighborCard) {
      continue;
    }

    for (const rule of card.adjacencyRules) {
      if (ruleMatchesCard(rule.neighborCardId, rule.neighborCategory, neighborCard)) {
        delta = addResources(delta, rule.effect);
      }
    }

    for (const rule of neighborCard.adjacencyRules) {
      if (ruleMatchesCard(rule.neighborCardId, rule.neighborCategory, card)) {
        delta = addResources(delta, rule.effect);
      }
    }
  }

  const expandsCity =
    card.category === "Infrastructure" &&
    (state.infrastructurePlaced + 1) % 2 === 0 &&
    canExpandGridRing(state.grid);
  if (expandsCity) {
    delta.gold -= config.expansionGoldCost;
  }

  return delta;
}

function scoreDelta(delta: Resources, resources: Resources, config: GameConfig): number {
  const populationWeight = resources.population < config.victoryRequirements.population ? 3 : 1.5;
  const happinessWeight = resources.happiness < config.victoryRequirements.minHappiness ? 3 : 2;
  const goldWeight = resources.gold < 8 ? 2 : 1;
  const pollutionWeight =
    resources.pollution >= config.victoryRequirements.maxPollution ? 4 : 2;
  return (
    delta.population * populationWeight +
    delta.happiness * happinessWeight +
    delta.gold * goldWeight -
    delta.pollution * pollutionWeight
  );
}

function ruleMatchesCard(
  neighborCardId: string | undefined,
  neighborCategory: string | undefined,
  targetCard: CardDefinition,
): boolean {
  const byId = neighborCardId !== undefined && neighborCardId === targetCard.id;
  const byCategory = neighborCategory !== undefined && neighborCategory === targetCard.category;
  return byId || byCategory;
}
