export type ResourceKey = "gold" | "population" | "happiness" | "pollution";

export interface Resources {
  gold: number;
  population: number;
  happiness: number;
  pollution: number;
}

export type PlacementBlockReason =
  | "no_selection"
  | "out_of_bounds"
  | "locked"
  | "occupied"
  | "insufficient_gold";

export interface PlacementPreview {
  handIndex: number;
  x: number;
  y: number;
  cardId: string | null;
  cardName: string | null;
  canPlace: boolean;
  reason: PlacementBlockReason | null;
  immediateDelta: Resources;
}

export interface Cursor {
  x: number;
  y: number;
}

export interface ActiveBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface PlacedCard {
  cardId: string;
  x: number;
  y: number;
}

export interface TileState {
  cardId: string | null;
}

export interface GridState {
  maxSize: number;
  activeBounds: ActiveBounds;
  tiles: TileState[][];
}

export interface ActiveEventModifier {
  id: string;
  name: string;
  effect: Partial<Resources>;
  remainingTurns: number;
}

export interface TurnBreakdown {
  base: Resources;
  adjacency: Resources;
  modifiers: Resources;
  total: Resources;
  pollutionPenalty: number;
}

export type GameStatus = "running" | "won" | "lost";
export type GamePhase = "draw" | "placement" | "resolution" | "end" | "game_over";

export interface GameConfig {
  startingResources: Resources;
  victoryPopulation: number;
  populationCollapseTurn: number;
  populationCollapseThreshold: number;
  pollutionPenaltyStep: number;
  initialGridSize: number;
  maxGridSize: number;
  cardsPerTurn: number;
  maxPlacementsPerTurn: number;
  eventCadenceTurns: number;
  copiesPerCard: number;
}

export interface GameState {
  turn: number;
  phase: GamePhase;
  status: GameStatus;
  lossReason: string | null;
  resources: Resources;
  deck: string[];
  discard: string[];
  hand: string[];
  eventDeck: string[];
  eventDiscard: string[];
  lastEventName: string | null;
  activeModifiers: ActiveEventModifier[];
  grid: GridState;
  placedCards: PlacedCard[];
  cursor: Cursor;
  selectedHandIndex: number | null;
  placementsRemaining: number;
  infrastructurePlaced: number;
  lastTurnBreakdown: TurnBreakdown;
  log: string[];
  rngSeed: number;
}

export const SAVED_RUN_VERSION = 1;

export interface SavedRunV1 {
  version: typeof SAVED_RUN_VERSION;
  savedAt: number;
  rngSeed: number;
  rngCalls: number;
  state: GameState;
}
