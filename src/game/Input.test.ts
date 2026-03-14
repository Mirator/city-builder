import { beforeEach, describe, expect, it, vi } from "vitest";
import { Input, type InputGameController, type InputRendererController } from "./Input";
import type { GameState } from "./types";
import type { UiHitTarget } from "./Renderer";

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
    victoryProgress: 0,
    lastTurnBreakdown: {
      base: { gold: 0, population: 0, happiness: 0, pollution: 0 },
      adjacency: { gold: 0, population: 0, happiness: 0, pollution: 0 },
      upkeep: { gold: 0, population: 0, happiness: 0, pollution: 0 },
      modifiers: { gold: 0, population: 0, happiness: 0, pollution: 0 },
      total: { gold: 0, population: 0, happiness: 0, pollution: 0 },
      pollutionPenalty: { gold: 0, population: 0, happiness: 0, pollution: 0 },
      final: { gold: 0, population: 0, happiness: 0, pollution: 0 },
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
  let nextHit: UiHitTarget;
  const callbacks = {
    onNewRun: vi.fn(),
    onToggleHelp: vi.fn(),
    onToggleDevTools: vi.fn(),
    onRunBalanceReport: vi.fn(),
  };

  beforeEach(() => {
    canvas = document.createElement("canvas");
    canvas.width = 500;
    canvas.height = 500;
    document.body.appendChild(canvas);
    state = createState();
    nextHit = { type: "none" };
    callbacks.onNewRun.mockReset();
    callbacks.onToggleHelp.mockReset();
    callbacks.onToggleDevTools.mockReset();
    callbacks.onRunBalanceReport.mockReset();

    game = {
      getState: () => state,
      moveCursor: vi.fn(),
      setCursor: vi.fn(() => true),
      selectHandIndex: vi.fn(),
      clearSelection: vi.fn(),
      placeSelectedAtCursor: vi.fn(() => true),
      placeSelectedAt: vi.fn(() => true),
      endPlacementPhase: vi.fn(),
    };
    renderer = {
      hitTest: vi.fn(() => nextHit),
    };
  });

  it("maps gameplay keys to game actions", () => {
    const input = new Input(game, renderer, canvas, callbacks);

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
    const input = new Input(game, renderer, canvas, callbacks);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "6" }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "7" }));

    expect(game.selectHandIndex).toHaveBeenCalledWith(5);
    expect(game.selectHandIndex).toHaveBeenCalledTimes(1);

    input.dispose();
  });

  it("routes F1 and H to canvas overlay toggles", () => {
    const input = new Input(game, renderer, canvas, callbacks);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "F1" }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "h" }));

    expect(callbacks.onToggleDevTools).toHaveBeenCalledTimes(1);
    expect(callbacks.onToggleHelp).toHaveBeenCalledTimes(1);
    input.dispose();
  });

  it("routes board and hand clicks via renderer hit testing", () => {
    const input = new Input(game, renderer, canvas, callbacks);
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

    nextHit = { type: "board_tile", x: 4, y: 4 };
    canvas.dispatchEvent(new MouseEvent("mousedown", { clientX: 100, clientY: 120 }));

    nextHit = { type: "hand_card", index: 0 };
    canvas.dispatchEvent(new MouseEvent("mousedown", { clientX: 100, clientY: 120 }));

    expect(game.setCursor).toHaveBeenCalledWith(4, 4);
    expect(game.placeSelectedAt).toHaveBeenCalledWith(4, 4);
    expect(game.selectHandIndex).toHaveBeenCalledWith(0);

    input.dispose();
  });

  it("routes action clicks from canvas to callbacks and game actions", () => {
    const input = new Input(game, renderer, canvas, callbacks);
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

    nextHit = { type: "action", action: "new_run" };
    canvas.dispatchEvent(new MouseEvent("mousedown", { clientX: 10, clientY: 10 }));
    nextHit = { type: "action", action: "clear_selection" };
    canvas.dispatchEvent(new MouseEvent("mousedown", { clientX: 10, clientY: 10 }));
    nextHit = { type: "action", action: "end_turn" };
    canvas.dispatchEvent(new MouseEvent("mousedown", { clientX: 10, clientY: 10 }));
    nextHit = { type: "action", action: "toggle_help" };
    canvas.dispatchEvent(new MouseEvent("mousedown", { clientX: 10, clientY: 10 }));
    nextHit = { type: "action", action: "toggle_dev_tools" };
    canvas.dispatchEvent(new MouseEvent("mousedown", { clientX: 10, clientY: 10 }));
    nextHit = { type: "action", action: "run_balance_report" };
    canvas.dispatchEvent(new MouseEvent("mousedown", { clientX: 10, clientY: 10 }));

    expect(callbacks.onNewRun).toHaveBeenCalledTimes(1);
    expect(game.clearSelection).toHaveBeenCalledTimes(1);
    expect(game.endPlacementPhase).toHaveBeenCalledTimes(1);
    expect(callbacks.onToggleHelp).toHaveBeenCalledTimes(1);
    expect(callbacks.onToggleDevTools).toHaveBeenCalledTimes(1);
    expect(callbacks.onRunBalanceReport).toHaveBeenCalledTimes(1);

    input.dispose();
  });

  it("updates cursor on board hover by hit test", () => {
    const input = new Input(game, renderer, canvas, callbacks);
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
    nextHit = { type: "board_tile", x: 5, y: 6 };

    canvas.dispatchEvent(new MouseEvent("mousemove", { clientX: 250, clientY: 220 }));

    expect(game.setCursor).toHaveBeenCalledWith(5, 6);
    input.dispose();
  });
});
