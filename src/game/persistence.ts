import { SAVED_RUN_VERSION } from "./types";
import type { GameState, SavedRunSnapshot } from "./types";

export const RUN_SAVE_KEY = "ccb.run.v2";

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface DebouncedAction {
  schedule(): void;
  flush(): void;
  cancel(): void;
}

export function loadSavedRun(storage = getDefaultStorage()): SavedRunSnapshot | null {
  if (!storage) {
    return null;
  }
  try {
    const raw = storage.getItem(RUN_SAVE_KEY);
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!isSavedRunSnapshot(parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveRun(snapshot: SavedRunSnapshot, storage = getDefaultStorage()): boolean {
  if (!storage) {
    return false;
  }
  try {
    storage.setItem(RUN_SAVE_KEY, JSON.stringify(snapshot));
    return true;
  } catch {
    return false;
  }
}

export function clearSavedRun(storage = getDefaultStorage()): boolean {
  if (!storage) {
    return false;
  }
  try {
    storage.removeItem(RUN_SAVE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function createDebouncedAction(action: () => void, delayMs = 250): DebouncedAction {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return {
    schedule() {
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        timer = null;
        action();
      }, delayMs);
    },
    flush() {
      if (!timer) {
        action();
        return;
      }
      clearTimeout(timer);
      timer = null;
      action();
    },
    cancel() {
      if (!timer) {
        return;
      }
      clearTimeout(timer);
      timer = null;
    },
  };
}

export function isSavedRunSnapshot(value: unknown): value is SavedRunSnapshot {
  if (!isRecord(value)) {
    return false;
  }
  if (value.version !== SAVED_RUN_VERSION) {
    return false;
  }
  if (!isFiniteNumber(value.savedAt) || !isFiniteNumber(value.rngSeed) || !isFiniteNumber(value.rngCalls)) {
    return false;
  }
  return isGameState(value.state);
}

function isGameState(value: unknown): value is GameState {
  if (!isRecord(value)) {
    return false;
  }

  const resources = value.resources;
  const lastTurnBreakdown = value.lastTurnBreakdown;
  const grid = value.grid;

  return (
    isFiniteNumber(value.turn) &&
    isString(value.phase) &&
    isString(value.status) &&
    (value.lossReason === null || isString(value.lossReason)) &&
    isResources(resources) &&
    isStringArray(value.deck) &&
    isStringArray(value.discard) &&
    isStringArray(value.hand) &&
    isStringArray(value.eventDeck) &&
    isStringArray(value.eventDiscard) &&
    (value.lastEventName === null || isString(value.lastEventName)) &&
    Array.isArray(value.activeModifiers) &&
    isGridState(grid) &&
    isCursor(value.cursor) &&
    (value.selectedHandIndex === null || isFiniteNumber(value.selectedHandIndex)) &&
    isFiniteNumber(value.placementsRemaining) &&
    isFiniteNumber(value.infrastructurePlaced) &&
    isFiniteNumber(value.victoryProgress) &&
    isTurnBreakdown(lastTurnBreakdown) &&
    isStringArray(value.log) &&
    isFiniteNumber(value.rngSeed)
  );
}

function isGridState(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  if (!isFiniteNumber(value.maxSize) || !isActiveBounds(value.activeBounds) || !Array.isArray(value.tiles)) {
    return false;
  }
  return value.tiles.every(
    (row) =>
      Array.isArray(row) &&
      row.every((tile) => isRecord(tile) && (tile.cardId === null || isString(tile.cardId))),
  );
}

function isTurnBreakdown(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  return (
    isResources(value.base) &&
    isResources(value.adjacency) &&
    isResources(value.upkeep) &&
    isResources(value.modifiers) &&
    isResources(value.total) &&
    isResources(value.pollutionPenalty) &&
    isResources(value.final)
  );
}

function isCursor(value: unknown): boolean {
  return isRecord(value) && isFiniteNumber(value.x) && isFiniteNumber(value.y);
}

function isActiveBounds(value: unknown): boolean {
  return (
    isRecord(value) &&
    isFiniteNumber(value.minX) &&
    isFiniteNumber(value.minY) &&
    isFiniteNumber(value.maxX) &&
    isFiniteNumber(value.maxY)
  );
}

function isResources(value: unknown): boolean {
  return (
    isRecord(value) &&
    isFiniteNumber(value.gold) &&
    isFiniteNumber(value.population) &&
    isFiniteNumber(value.happiness) &&
    isFiniteNumber(value.pollution)
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function getDefaultStorage(): StorageLike | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage;
}
