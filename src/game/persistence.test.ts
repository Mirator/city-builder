import { describe, expect, it } from "vitest";
import { Game } from "./Game";
import { RUN_SAVE_KEY, clearSavedRun, loadSavedRun, saveRun } from "./persistence";

function createStorageMock(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key: string) {
      return values.has(key) ? values.get(key)! : null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    },
  };
}

describe("run persistence", () => {
  it("serializes and restores a valid snapshot", () => {
    const storage = createStorageMock();
    const game = new Game(99);
    game.endPlacementPhase();
    const snapshot = game.toSnapshot();

    expect(saveRun(snapshot, storage)).toBe(true);
    const loaded = loadSavedRun(storage);

    expect(loaded).not.toBeNull();
    expect(loaded?.version).toBe(snapshot.version);
    expect(loaded?.rngSeed).toBe(snapshot.rngSeed);
    expect(loaded?.rngCalls).toBe(snapshot.rngCalls);
    expect(loaded?.state.turn).toBe(snapshot.state.turn);
    expect(loaded?.state.resources).toEqual(snapshot.state.resources);
  });

  it("returns null for version mismatches", () => {
    const game = new Game(123);
    const snapshot = game.toSnapshot();
    const storage = createStorageMock({
      [RUN_SAVE_KEY]: JSON.stringify({ ...snapshot, version: 999 }),
    });

    const loaded = loadSavedRun(storage);
    expect(loaded).toBeNull();
  });

  it("restores equivalent state after a save/load cycle", () => {
    const storage = createStorageMock();
    const game = new Game(2024);
    game.endPlacementPhase();
    game.endPlacementPhase();

    const snapshot = game.toSnapshot();
    expect(saveRun(snapshot, storage)).toBe(true);
    const loaded = loadSavedRun(storage);
    expect(loaded).not.toBeNull();

    const resumed = new Game(1);
    expect(resumed.fromSnapshot(loaded!)).toBe(true);
    expect(resumed.getState()).toEqual(game.getState());
  });

  it("clears the save slot", () => {
    const game = new Game(50);
    const storage = createStorageMock({
      [RUN_SAVE_KEY]: JSON.stringify(game.toSnapshot()),
    });

    expect(loadSavedRun(storage)).not.toBeNull();
    expect(clearSavedRun(storage)).toBe(true);
    expect(loadSavedRun(storage)).toBeNull();
  });
});
