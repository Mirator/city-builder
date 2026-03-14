import { describe, expect, it, vi } from "vitest";
import { Renderer } from "./Renderer";
import { CARD_DATABASE } from "../cards/CardDatabase";
import type { GameState } from "./types";

type MockCanvasContext = Partial<CanvasRenderingContext2D> & {
  fillText: ReturnType<typeof vi.fn>;
  measureText: ReturnType<typeof vi.fn>;
};

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
    lastEventSummary: null,
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
    log: ["Run started."],
    rngSeed: 123,
  };
}

function createRendererHarness(): { renderer: Renderer; context: MockCanvasContext } {
  const canvas = document.createElement("canvas");
  const context = createMockContext();
  vi.spyOn(canvas, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D);
  return {
    renderer: new Renderer(canvas, CARD_DATABASE),
    context,
  };
}

function createRenderer(): Renderer {
  return createRendererHarness().renderer;
}

function createMockContext(): MockCanvasContext {
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

function createEventSummary(overrides: Partial<NonNullable<GameState["lastEventSummary"]>> = {}) {
  return {
    id: "tax_windfall",
    name: "Tax Windfall",
    description: "Unexpected tax surplus boosts the treasury.",
    effectType: "immediate" as const,
    triggeredOnTurn: 3,
    immediateDelta: { gold: 8, population: 0, happiness: 0, pollution: 0 },
    queuedModifier: null,
    ...overrides,
  };
}

describe("Renderer", () => {
  it("keeps computed layout inside viewport bounds and compact dock limits on desktop sizes", () => {
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
      expect(rectWithin(layout.eventPanel, layout.viewport)).toBe(true);
      expect(rectWithin(layout.resourcePanel, layout.viewport)).toBe(true);
      expect(rectWithin(layout.boardPanel, layout.viewport)).toBe(true);
      expect(rectWithin(layout.gridRect, layout.viewport)).toBe(true);
      expect(rectWithin(layout.bottomDock, layout.viewport)).toBe(true);
      expect(rectWithin(layout.actionRow, layout.viewport)).toBe(true);
      expect(rectWithin(layout.handArea, layout.viewport)).toBe(true);
      expect(layout.resourcePanel.x + layout.resourcePanel.width).toBeLessThan(layout.boardPanel.x);
      expect(layout.boardPanel.x + layout.boardPanel.width).toBeLessThan(layout.eventPanel.x);
      expect(layout.topHud.height).toBeGreaterThanOrEqual(54);
      expect(layout.topHud.height).toBeLessThanOrEqual(66);
      expect(layout.bottomDock.height).toBeGreaterThanOrEqual(136);
      expect(layout.bottomDock.height).toBeLessThanOrEqual(188);
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

    const handHit = renderer.hitTest(layout.handArea.x + 100, layout.handArea.y + 20);
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

  it("locks interactions to game-over modal and exposes New Run action", () => {
    const renderer = createRenderer();
    const state = createState();
    state.status = "won";
    state.phase = "game_over";
    state.lossReason = "Victory: Balanced city sustained for 3 turns.";
    const ui = createUiState();
    renderer.resize(1366, 768, 1);
    renderer.render(state, ui);

    const panelWidth = clamp(Math.round(1366 * 0.44), 360, 620);
    const panelHeight = 236;
    const panelX = Math.round((1366 - panelWidth) / 2);
    const panelY = Math.round((768 - panelHeight) / 2);
    const buttonX = panelX + Math.round((panelWidth - 156) / 2) + 12;
    const buttonY = panelY + panelHeight - 30;

    const newRunHit = renderer.hitTest(buttonX, buttonY);
    expect(newRunHit).toEqual({ type: "action", action: "new_run" });

    const boardHit = renderer.hitTest(683, 384);
    expect(boardHit).toEqual({ type: "none" });
  });

  it("renders outcome copy and board coordinates", () => {
    const { renderer, context } = createRendererHarness();
    const state = createState();
    state.status = "won";
    state.phase = "game_over";
    state.lossReason = "Victory: Balanced city sustained for 3 turns.";
    const ui = createUiState();
    renderer.resize(1366, 768, 1);
    renderer.render(state, ui);

    const texts = context.fillText.mock.calls.map((call) => String(call[0]));
    expect(texts).toContain("Victory");
    expect(texts.some((value) => value.includes("Balanced city sustained"))).toBe(true);
    expect(texts).toContain("A");
    expect(texts).toContain("1");
  });

  it("renders resource delta inline with value and removes Delta label text", () => {
    const { renderer, context } = createRendererHarness();
    const state = createState();
    state.resources.gold = 13;
    state.lastTurnBreakdown.final.gold = -1;
    const ui = createUiState();

    renderer.resize(1366, 768, 1);
    renderer.render(state, ui);

    const calls = context.fillText.mock.calls;
    const valueCall = calls.find((call) => String(call[0]) === "13");
    const deltaCall = calls.find((call) => String(call[0]) === "-1");
    expect(valueCall).toBeDefined();
    expect(deltaCall).toBeDefined();
    if (!valueCall || !deltaCall) {
      return;
    }
    expect(valueCall[2]).toBe(deltaCall[2]);

    const texts = calls.map((call) => String(call[0]));
    expect(texts.some((value) => value.includes("Delta"))).toBe(false);
  });

  it("keeps the top hud title-only", () => {
    const { renderer, context } = createRendererHarness();
    const state = createState();
    const ui = createUiState();

    renderer.resize(1366, 768, 1);
    renderer.render(state, ui);

    const texts = context.fillText.mock.calls.map((call) => String(call[0]));
    expect(texts).toContain("Card City Builder");
    expect(texts).not.toContain("Sustain a balanced city for three turns");
  });

  it("renders recent event details and immediate impact chips in the event panel", () => {
    const { renderer, context } = createRendererHarness();
    const state = createState();
    state.lastEventName = "Tax Windfall";
    state.lastEventSummary = createEventSummary();
    const ui = createUiState();

    renderer.resize(1366, 768, 1);
    renderer.render(state, ui);

    const texts = context.fillText.mock.calls.map((call) => String(call[0]));
    expect(texts).toContain("Tax Windfall");
    expect(texts.some((value) => value.includes("Unexpected tax surplus"))).toBe(true);
    expect(texts).toContain("Gold +8");
  });

  it("renders next-turn modifier copy in the event panel", () => {
    const { renderer, context } = createRendererHarness();
    const state = createState();
    state.lastEventName = "Housing Grant";
    state.lastEventSummary = createEventSummary({
      id: "housing_grant",
      name: "Housing Grant",
      description: "Temporary grants accelerate growth next turn.",
      effectType: "turnModifier",
      immediateDelta: { gold: 0, population: 0, happiness: 0, pollution: 0 },
      queuedModifier: {
        effect: { gold: 0, population: 4, happiness: 0, pollution: 0 },
        remainingTurns: 1,
      },
    });
    const ui = createUiState();

    renderer.resize(1366, 768, 1);
    renderer.render(state, ui);

    const texts = context.fillText.mock.calls.map((call) => String(call[0]));
    expect(texts).toContain("No immediate change");
    expect(texts).toContain("Next turn: Pop +4 (1 turn)");
  });

  it("prioritizes action feedback over recent event details", () => {
    const { renderer, context } = createRendererHarness();
    const state = createState();
    state.lastEventName = "Tax Windfall";
    state.lastEventSummary = createEventSummary();
    const ui = {
      ...createUiState(),
      feedbackMessage: "Need more gold before placing.",
    };

    renderer.resize(1366, 768, 1);
    renderer.render(state, ui);

    const texts = context.fillText.mock.calls.map((call) => String(call[0]));
    expect(texts).toContain("Placement blocked");
    expect(texts).toContain("Need more gold before placing.");
    expect(texts).not.toContain("Tax Windfall");
  });

  it("renders placement breakdown with play and adjacency columns", () => {
    const { renderer, context } = createRendererHarness();
    const state = createState();
    state.selectedHandIndex = 0;
    const ui = {
      ...createUiState(),
      overlays: {
        tilePreviews: [],
        cursorPreview: {
          handIndex: 0,
          x: 4,
          y: 5,
          cardId: "house",
          cardName: "House",
          canPlace: true,
          reason: null,
          immediateDelta: { gold: -1, population: 2, happiness: 2, pollution: 0 },
        },
      },
    };

    renderer.resize(1366, 768, 1);
    renderer.render(state, ui);

    const texts = context.fillText.mock.calls.map((call) => String(call[0]));
    expect(texts).toContain("Placement Impact");
    expect(texts).toContain("Play");
    expect(texts).toContain("Adjacency");
    expect(texts).toContain("Total");
    expect(texts.some((value) => value.startsWith("Yield G "))).toBe(true);
    expect(texts).not.toContain("Base");
    expect(texts).not.toContain("Neighbors");
    expect(texts.some((value) => value.startsWith("Tile ("))).toBe(false);
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
