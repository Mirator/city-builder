import type { ActiveBounds, GridState, PlacedCard, TileState } from "../game/types";

export interface Neighbor {
  x: number;
  y: number;
  cardId: string | null;
}

export function createGrid(maxSize: number, initialSize: number): GridState {
  const tiles: TileState[][] = [];
  for (let y = 0; y < maxSize; y += 1) {
    const row: TileState[] = [];
    for (let x = 0; x < maxSize; x += 1) {
      row.push({ cardId: null });
    }
    tiles.push(row);
  }

  const offset = Math.floor((maxSize - initialSize) / 2);
  const bounds: ActiveBounds = {
    minX: offset,
    minY: offset,
    maxX: offset + initialSize - 1,
    maxY: offset + initialSize - 1,
  };

  return {
    maxSize,
    activeBounds: bounds,
    tiles,
  };
}

export function isInBounds(grid: GridState, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < grid.maxSize && y < grid.maxSize;
}

export function isUnlocked(grid: GridState, x: number, y: number): boolean {
  const { minX, minY, maxX, maxY } = grid.activeBounds;
  return x >= minX && x <= maxX && y >= minY && y <= maxY;
}

export function isOccupied(grid: GridState, x: number, y: number): boolean {
  if (!isInBounds(grid, x, y)) {
    return false;
  }
  return grid.tiles[y][x].cardId !== null;
}

export function getCardId(grid: GridState, x: number, y: number): string | null {
  if (!isInBounds(grid, x, y)) {
    return null;
  }
  return grid.tiles[y][x].cardId;
}

export function placeCard(grid: GridState, x: number, y: number, cardId: string): boolean {
  if (!isInBounds(grid, x, y) || !isUnlocked(grid, x, y) || isOccupied(grid, x, y)) {
    return false;
  }
  grid.tiles[y][x].cardId = cardId;
  return true;
}

export function getPlacedCards(grid: GridState): PlacedCard[] {
  const placed: PlacedCard[] = [];
  for (let y = 0; y < grid.maxSize; y += 1) {
    for (let x = 0; x < grid.maxSize; x += 1) {
      const cardId = grid.tiles[y][x].cardId;
      if (cardId) {
        placed.push({ cardId, x, y });
      }
    }
  }
  return placed;
}

export function getOrthogonalNeighbors(grid: GridState, x: number, y: number): Neighbor[] {
  const deltas = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
  ];

  return deltas
    .map(({ dx, dy }) => ({
      x: x + dx,
      y: y + dy,
    }))
    .filter(({ x: nextX, y: nextY }) => isInBounds(grid, nextX, nextY))
    .map(({ x: nextX, y: nextY }) => ({
      x: nextX,
      y: nextY,
      cardId: grid.tiles[nextY][nextX].cardId,
    }));
}

export function expandGridRing(grid: GridState): boolean {
  if (!canExpandGridRing(grid)) {
    return false;
  }

  const nextBounds = {
    minX: grid.activeBounds.minX - 1,
    minY: grid.activeBounds.minY - 1,
    maxX: grid.activeBounds.maxX + 1,
    maxY: grid.activeBounds.maxY + 1,
  };

  grid.activeBounds = nextBounds;
  return true;
}

export function canExpandGridRing(grid: GridState): boolean {
  const nextBounds = {
    minX: grid.activeBounds.minX - 1,
    minY: grid.activeBounds.minY - 1,
    maxX: grid.activeBounds.maxX + 1,
    maxY: grid.activeBounds.maxY + 1,
  };

  if (
    nextBounds.minX < 0 ||
    nextBounds.minY < 0 ||
    nextBounds.maxX >= grid.maxSize ||
    nextBounds.maxY >= grid.maxSize
  ) {
    return false;
  }
  return true;
}

export function activeGridSize(grid: GridState): number {
  return grid.activeBounds.maxX - grid.activeBounds.minX + 1;
}
