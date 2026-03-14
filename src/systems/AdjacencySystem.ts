import type { CardDefinition } from "../cards/Card";
import type { GridState, Resources } from "../game/types";
import { addResources, zeroResources } from "../utils/resource";
import { getOrthogonalNeighbors, getPlacedCards } from "../world/Grid";

export function calculateAdjacencyYield(
  grid: GridState,
  cardDatabase: Record<string, CardDefinition>,
): Resources {
  let total = zeroResources();
  const placedCards = getPlacedCards(grid);

  for (const placed of placedCards) {
    const sourceCard = cardDatabase[placed.cardId];
    if (!sourceCard) {
      continue;
    }
    const neighbors = getOrthogonalNeighbors(grid, placed.x, placed.y);
    for (const neighbor of neighbors) {
      if (!neighbor.cardId) {
        continue;
      }
      const neighborCard = cardDatabase[neighbor.cardId];
      if (!neighborCard) {
        continue;
      }
      for (const rule of sourceCard.adjacencyRules) {
        const byId = rule.neighborCardId !== undefined && rule.neighborCardId === neighbor.cardId;
        const byCategory =
          rule.neighborCategory !== undefined && rule.neighborCategory === neighborCard.category;
        if (byId || byCategory) {
          total = addResources(total, rule.effect);
        }
      }
    }
  }

  return total;
}
