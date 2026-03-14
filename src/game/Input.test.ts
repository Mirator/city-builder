import { beforeEach, describe, expect, it, vi } from "vitest";
import { Input, type InputGameController, type InputRendererController } from "./Input";
import type { GameState } from "./types";

function createState(): GameState {
  return {
    turn: 1,
    phase: "placement",
    status: "running",
    lossReason: null,
    resources: { gold: 10, population: 10, happiness: 10, pollution: 0 },
    deck: [],
    discard: [],
    hand: ["house"],
    eventDeck: [],
    eventDiscard: [],
    lastEventName: null,
    activeModifiers: [],
    grid: {
      maxSize: 10,
      activeBounds: { minX: 3, minY: 3, maxX: 6, maxY: 6 },
      tiles: Array.from({ length: 10 }, () =>
        Array.from({ length: 10 }, () => ({ cardId: null })),
      ),
    },
    placedCards: [],
    cursor: { x: 3, y: 3 },
    selectedHandIndex: null,
    placementsRemaining: 2,
    infrastructurePlaced: 0,
    lastTurnBreakdown: {
      base: { gold: 0, population: 0, happiness: 0, pollution: 0 },
      adjacency: { gold: 0, population: 0, happiness: 0, pollution: 0 },
      modifiers: { gold: 0, population: 0, happiness: 0, pollution: 0 },
      total: { gold: 0, population: 0, happiness: 0, pollution: 0 },
      pollutionPenalty: 0,
    },
    log: [],
    rngSeed: 1,
  };
}

describe("Input", () => {
  let canvas: HTMLCanvasElement;
  let state: GameState;
  let game: InputGameController;
  let renderer: InputRendererController;

  beforeEach(() => {
    canvas = document.createElement("canvas");
    canvas.width = 500;
    canvas.height = 500;
    document.body.appendChild(canvas);
    state = createState();

    game = {
      getState: () => state,
      moveCursor: vi.fn(),
      selectHandIndex: vi.fn(),
      clearSelection: vi.fn(),
      placeSelectedAtCursor: vi.fn(() => true),
      placeSelectedAt: vi.fn(() => true),
      endPlacementPhase: vi.fn(),
    };
    renderer = {
      getTileAtPoint: vi.fn(() => ({ x: 4, y: 4 })),
    };
  });

  it("maps key presses to game actions", () => {
    const input = new Input(game, renderer, canvas);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "1" }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "e" }));

    expect(game.moveCursor).toHaveBeenCalledWith(0, -1);
    expect(game.selectHandIndex).toHaveBeenCalledWith(0);
    expect(game.placeSelectedAtCursor).toHaveBeenCalled();
    expect(game.clearSelection).toHaveBeenCalled();
    expect(game.endPlacementPhase).toHaveBeenCalled();

    input.dispose();
  });

  it("supports dynamic hand shortcuts beyond five slots", () => {
    state.hand = ["a", "b", "c", "d", "e", "f"];
    const input = new Input(game, renderer, canvas);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "6" }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "7" }));

    expect(game.selectHandIndex).toHaveBeenCalledWith(5);
    expect(game.selectHandIndex).toHaveBeenCalledTimes(1);

    input.dispose();
  });

  it("maps canvas click to selected-card placement", () => {
    const input = new Input(game, renderer, canvas);
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      width: 500,
      height: 500,
      top: 0,
      right: 500,
      bottom: 500,
      left: 0,
      toJSON: () => ({}),
    });

    canvas.dispatchEvent(new MouseEvent("mousedown", { clientX: 100, clientY: 120 }));
    expect(game.placeSelectedAt).toHaveBeenCalledWith(4, 4);

    input.dispose();
  });
});
