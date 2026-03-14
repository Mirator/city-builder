import { describe, expect, it } from "vitest";
import { activeGridSize, createGrid, expandGridRing } from "./Grid";

describe("Grid expansion", () => {
  it("expands 4x4 -> 6x6 -> 8x8 -> 10x10 and then stops", () => {
    const grid = createGrid(10, 4);
    expect(activeGridSize(grid)).toBe(4);

    expect(expandGridRing(grid)).toBe(true);
    expect(activeGridSize(grid)).toBe(6);

    expect(expandGridRing(grid)).toBe(true);
    expect(activeGridSize(grid)).toBe(8);

    expect(expandGridRing(grid)).toBe(true);
    expect(activeGridSize(grid)).toBe(10);

    expect(expandGridRing(grid)).toBe(false);
    expect(activeGridSize(grid)).toBe(10);
  });
});
