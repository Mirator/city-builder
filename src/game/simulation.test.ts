import { describe, expect, it } from "vitest";
import { runDeterministicBatch, runDeterministicSimulation } from "./simulation";

describe("simulation helpers", () => {
  it("produces deterministic outcomes for the same seed", () => {
    const a = runDeterministicSimulation(1337, 200);
    const b = runDeterministicSimulation(1337, 200);
    expect(a).toEqual(b);
  });

  it("summarizes a deterministic batch", () => {
    const summary = runDeterministicBatch(10, 8, 120);
    expect(summary.count).toBe(8);
    expect(summary.wins + summary.losses).toBe(8);
    expect(summary.results).toHaveLength(8);
    expect(summary.minTurn).toBeLessThanOrEqual(summary.maxTurn);
  });

  it("keeps autoplay win rate at or below 50 percent across 100 seeds", () => {
    const summary = runDeterministicBatch(1, 100, 600);
    expect(summary.wins).toBeLessThanOrEqual(50);
  });
});
