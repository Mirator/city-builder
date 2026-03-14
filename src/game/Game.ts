import type { CardDefinition } from "../cards/Card";
import { CARD_DATABASE, CARD_DEFINITIONS } from "../cards/CardDatabase";
import type { EventDefinition } from "../events/Event";
import { EVENT_DATABASE, EVENT_DEFINITIONS } from "../events/EventDatabase";
import { buildEventDeck, shouldTriggerEvent, triggerEvent } from "../systems/EventSystem";
import { buildDeck, discardCards, drawCards } from "../systems/DeckSystem";
import { resolveTurnResources, emptyBreakdown } from "../systems/ResourceSystem";
import { evaluateStatus } from "../systems/WinLossSystem";
import { createSeededRng, shuffleWithRng } from "../utils/rng";
import { createGrid, expandGridRing, getPlacedCards, isUnlocked, placeCard } from "../world/Grid";
import { GAME_CONFIG } from "./config";
import { SAVED_RUN_VERSION } from "./types";
import type { GameConfig, GameState, SavedRunV1 } from "./types";

type StateListener = (state: GameState) => void;

export class Game {
  private readonly config: GameConfig;
  private readonly cardDatabase: Record<string, CardDefinition>;
  private readonly eventDatabase: Record<string, EventDefinition>;
  private rng: () => number;
  private rngSeed: number;
  private rngCalls: number;
  private readonly listeners = new Set<StateListener>();
  private state: GameState;

  constructor(seed = Date.now()) {
    this.config = GAME_CONFIG;
    this.cardDatabase = CARD_DATABASE;
    this.eventDatabase = EVENT_DATABASE;
    const normalizedSeed = seed >>> 0;
    this.rngSeed = normalizedSeed;
    this.rngCalls = 0;
    this.rng = createSeededRng(normalizedSeed);
    this.state = this.createInitialState(normalizedSeed);
  }

  public getState(): GameState {
    return this.state;
  }

  public getConfig(): GameConfig {
    return this.config;
  }

  public getCardDatabase(): Record<string, CardDefinition> {
    return this.cardDatabase;
  }

  public reset(seed = Date.now()): void {
    const normalizedSeed = seed >>> 0;
    this.resetRng(normalizedSeed);
    this.state = this.createInitialState(normalizedSeed);
    this.emit();
  }

  public toSnapshot(): SavedRunV1 {
    return {
      version: SAVED_RUN_VERSION,
      savedAt: Date.now(),
      rngSeed: this.rngSeed,
      rngCalls: this.rngCalls,
      state: cloneGameState(this.state),
    };
  }

  public fromSnapshot(snapshot: SavedRunV1): boolean {
    if (snapshot.version !== SAVED_RUN_VERSION) {
      return false;
    }
    if (!Number.isFinite(snapshot.rngSeed) || !Number.isFinite(snapshot.rngCalls)) {
      return false;
    }

    const normalizedSeed = snapshot.rngSeed >>> 0;
    const normalizedCalls = Math.max(0, Math.floor(snapshot.rngCalls));
    this.resetRng(normalizedSeed, normalizedCalls);
    this.state = cloneGameState(snapshot.state);
    this.state.rngSeed = normalizedSeed;
    this.emit();
    return true;
  }

  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public moveCursor(dx: number, dy: number): void {
    if (this.state.status !== "running") {
      return;
    }
    const x = this.state.cursor.x + dx;
    const y = this.state.cursor.y + dy;
    if (!isUnlocked(this.state.grid, x, y)) {
      return;
    }
    this.state.cursor = { x, y };
    this.emit();
  }

  public selectHandIndex(index: number): void {
    if (this.state.status !== "running" || this.state.phase !== "placement") {
      return;
    }
    if (index < 0 || index >= this.state.hand.length) {
      return;
    }
    this.state.selectedHandIndex = index;
    this.emit();
  }

  public clearSelection(): void {
    if (this.state.selectedHandIndex === null) {
      return;
    }
    this.state.selectedHandIndex = null;
    this.emit();
  }

  public placeSelectedAtCursor(): boolean {
    if (this.state.selectedHandIndex === null) {
      return false;
    }
    const { x, y } = this.state.cursor;
    return this.placeFromHand(this.state.selectedHandIndex, x, y);
  }

  public placeSelectedAt(x: number, y: number): boolean {
    if (this.state.selectedHandIndex === null) {
      return false;
    }
    return this.placeFromHand(this.state.selectedHandIndex, x, y);
  }

  public endPlacementPhase(): void {
    if (this.state.status !== "running" || this.state.phase !== "placement") {
      return;
    }

    const leftovers = [...this.state.hand];
    this.state.hand = [];
    discardCards(this.state, leftovers);
    this.state.selectedHandIndex = null;
    this.state.phase = "resolution";

    resolveTurnResources(this.state, this.config, this.cardDatabase);
    this.state.phase = "end";

    if (shouldTriggerEvent(this.state.turn, this.config)) {
      triggerEvent(this.state, this.eventDatabase, this.nextRandom);
    } else {
      this.state.lastEventName = null;
    }

    const status = evaluateStatus(this.state, this.config);
    this.state.status = status.status;
    this.state.lossReason = status.reason;
    if (status.status === "running") {
      this.startNextTurn();
    } else {
      this.state.phase = "game_over";
      if (status.reason) {
        this.state.log.unshift(status.reason);
        this.state.log = this.state.log.slice(0, 10);
      }
    }
    this.emit();
  }

  private placeFromHand(handIndex: number, x: number, y: number): boolean {
    if (
      this.state.status !== "running" ||
      this.state.phase !== "placement" ||
      this.state.placementsRemaining <= 0
    ) {
      return false;
    }
    const cardId = this.state.hand[handIndex];
    if (!cardId) {
      return false;
    }
    const card = this.cardDatabase[cardId];
    if (!card) {
      return false;
    }
    if (this.state.resources.gold < card.cost) {
      this.state.log.unshift(`Not enough gold for ${card.name}.`);
      this.state.log = this.state.log.slice(0, 10);
      this.emit();
      return false;
    }
    const placed = placeCard(this.state.grid, x, y, card.id);
    if (!placed) {
      return false;
    }

    this.state.resources.gold -= card.cost;
    this.state.hand.splice(handIndex, 1);
    this.state.placementsRemaining -= 1;
    this.state.selectedHandIndex = null;
    this.state.cursor = { x, y };

    if (card.category === "Infrastructure") {
      this.state.infrastructurePlaced += 1;
      if (this.state.infrastructurePlaced % 2 === 0) {
        const expanded = expandGridRing(this.state.grid);
        if (expanded) {
          this.state.log.unshift("City expanded by one ring.");
          this.state.log = this.state.log.slice(0, 10);
        }
      }
    }

    this.state.placedCards = getPlacedCards(this.state.grid);
    this.state.log.unshift(`Placed ${card.name} at (${x}, ${y}).`);
    this.state.log = this.state.log.slice(0, 10);

    this.emit();

    if (this.state.placementsRemaining === 0) {
      this.endPlacementPhase();
    }
    return true;
  }

  private createInitialState(seed: number): GameState {
    const grid = createGrid(this.config.maxGridSize, this.config.initialGridSize);
    const cardIds = CARD_DEFINITIONS.map((card) => card.id);
    const eventIds = EVENT_DEFINITIONS.map((event) => event.id);
    const deck = shuffleWithRng(buildDeck(cardIds, this.config.copiesPerCard), this.nextRandom);
    const eventDeck = shuffleWithRng(buildEventDeck(eventIds), this.nextRandom);

    const state: GameState = {
      turn: 1,
      phase: "draw",
      status: "running",
      lossReason: null,
      resources: { ...this.config.startingResources },
      deck,
      discard: [],
      hand: [],
      eventDeck,
      eventDiscard: [],
      lastEventName: null,
      activeModifiers: [],
      grid,
      placedCards: [],
      cursor: {
        x: grid.activeBounds.minX,
        y: grid.activeBounds.minY,
      },
      selectedHandIndex: null,
      placementsRemaining: this.config.maxPlacementsPerTurn,
      infrastructurePlaced: 0,
      lastTurnBreakdown: emptyBreakdown(),
      log: ["Run started."],
      rngSeed: seed,
    };

    this.state = state;
    this.startTurnDraw();
    return state;
  }

  private startTurnDraw(): void {
    this.state.phase = "draw";
    const drawn = drawCards(this.state, this.config.cardsPerTurn, this.nextRandom);
    this.state.hand = drawn;
    this.state.placementsRemaining = this.config.maxPlacementsPerTurn;
    this.state.selectedHandIndex = null;
    this.state.phase = "placement";
  }

  private startNextTurn(): void {
    this.state.turn += 1;
    this.startTurnDraw();
    this.state.log.unshift(`Turn ${this.state.turn} begins.`);
    this.state.log = this.state.log.slice(0, 10);
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  private readonly nextRandom = (): number => {
    this.rngCalls += 1;
    return this.rng();
  };

  private resetRng(seed: number, calls = 0): void {
    this.rngSeed = seed >>> 0;
    this.rngCalls = 0;
    this.rng = createSeededRng(this.rngSeed);
    for (let i = 0; i < calls; i += 1) {
      this.nextRandom();
    }
  }
}

function cloneGameState(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state)) as GameState;
}
