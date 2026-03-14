import { describe, expect, it } from "vitest";
import { CARD_DATABASE } from "../cards/CardDatabase";
import { calculateAdjacencyYield } from "./AdjacencySystem";
import { createGrid, placeCard } from "../world/Grid";

describe("AdjacencySystem", () => {
  it("applies only orthogonal adjacency, not diagonal", () => {
    const grid = createGrid(10, 4);
    const x = grid.activeBounds.minX + 1;
    const y = grid.activeBounds.minY + 1;

    placeCard(grid, x, y, "apartment");
    placeCard(grid, x + 1, y, "school");
    placeCard(grid, x + 1, y + 1, "factory");

    const yieldFromAdjacency = calculateAdjacencyYield(grid, CARD_DATABASE);
    expect(yieldFromAdjacency.population).toBe(3);
    expect(yieldFromAdjacency.happiness).toBe(0);
  });
});
