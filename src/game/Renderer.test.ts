import { describe, expect, it, vi } from "vitest";
import { Renderer } from "./Renderer";
import { CARD_DATABASE } from "../cards/CardDatabase";
import type { GameState } from "./types";

function createState(): GameState {
  return {
    turn: 1,
    phase: "placement",
    status: "running",
    lossReason: null,
    resources: { gold: 20, population: 30, happiness: 60, pollution: 0 },
    deck: [],
    discard: [],
    hand: ["house", "park", "market"],
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
    log: ["Run started."],
    rngSeed: 123,
  };
}

function createRenderer(): Renderer {
  const canvas = document.createElement("canvas");
  const context = createMockContext();
  vi.spyOn(canvas, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D);
  return new Renderer(canvas, CARD_DATABASE);
}

function createMockContext(): Partial<CanvasRenderingContext2D> {
  const gradient = { addColorStop: vi.fn() };
  return {
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
    createLinearGradient: vi.fn(() => gradient),
    measureText: vi.fn((value: string) => ({ width: value.length * 7 } as unknown as TextMetrics)),
    font: "",
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    textAlign: "left",
    textBaseline: "alphabetic",
  };
}

function createUiState() {
  return {
    overlays: null,
    slotCount: 5,
    sessionStatus: "Started new run.",
    feedbackMessage: null,
    showDevTools: false,
    showHelp: false,
    balanceReportOutput: "No report yet.",
  };
}

describe("Renderer", () => {
  it("keeps computed layout inside viewport bounds on common desktop sizes", () => {
    const renderer = createRenderer();
    const state = createState();
    const ui = createUiState();

    const viewports = [
      { width: 1366, height: 768 },
      { width: 1920, height: 1080 },
    ];
    for (const viewport of viewports) {
      renderer.resize(viewport.width, viewport.height, 1);
      renderer.render(state, ui);
      const layout = renderer.getLayoutSnapshot();
      expect(layout).not.toBeNull();
      if (!layout) {
        continue;
      }
      expect(rectWithin(layout.topHud, layout.viewport)).toBe(true);
      expect(rectWithin(layout.boardPanel, layout.viewport)).toBe(true);
      expect(rectWithin(layout.gridRect, layout.viewport)).toBe(true);
      expect(rectWithin(layout.bottomDock, layout.viewport)).toBe(true);
      expect(rectWithin(layout.actionRow, layout.viewport)).toBe(true);
      expect(rectWithin(layout.handArea, layout.viewport)).toBe(true);
    }
  });

  it("hit-tests board tiles and hand/actions deterministically", () => {
    const renderer = createRenderer();
    const state = createState();
    const ui = createUiState();
    renderer.resize(1366, 768, 1);
    renderer.render(state, ui);

    const layout = renderer.getLayoutSnapshot();
    expect(layout).not.toBeNull();
    if (!layout) {
      return;
    }

    const boardHit = renderer.hitTest(layout.gridRect.x + 20, layout.gridRect.y + 20);
    expect(boardHit.type).toBe("board_tile");

    const handHit = renderer.hitTest(layout.handArea.x + 12, layout.handArea.y + 12);
    expect(handHit).toEqual({ type: "hand_card", index: 0 });

    const actionHit = renderer.hitTest(layout.actionRow.x + layout.actionRow.width - 20, layout.actionRow.y + 10);
    expect(actionHit.type).toBe("action");
  });

  it("locks interactions to dev modal controls when overlay is open", () => {
    const renderer = createRenderer();
    const state = createState();
    const ui = { ...createUiState(), showDevTools: true };
    renderer.resize(1366, 768, 1);
    renderer.render(state, ui);

    const panelX = Math.round(1366 * 0.12);
    const panelY = Math.round(768 * 0.08);
    const panelW = Math.round(1366 * 0.76);
    const closeHit = renderer.hitTest(panelX + panelW - 100, panelY + 24);
    expect(closeHit).toEqual({ type: "action", action: "toggle_dev_tools" });

    const boardHit = renderer.hitTest(683, 384);
    expect(boardHit).toEqual({ type: "none" });
  });
});

function rectWithin(rect: { x: number; y: number; width: number; height: number }, viewport: { width: number; height: number }): boolean {
  return (
    rect.x >= 0 &&
    rect.y >= 0 &&
    rect.width >= 0 &&
    rect.height >= 0 &&
    rect.x + rect.width <= viewport.width &&
    rect.y + rect.height <= viewport.height
  );
}
