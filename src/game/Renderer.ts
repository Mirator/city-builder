import type { CardDefinition } from "../cards/Card";
import type { GameState, PlacementPreview } from "./types";
import { formatResourceDelta } from "../utils/resource";

const CATEGORY_COLORS: Record<string, string> = {
  Residential: "#6bc4e6",
  Industry: "#d9835b",
  Services: "#95c485",
  Infrastructure: "#dab36a",
  Culture: "#c5a2d1",
};

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface HitRegion {
  rect: Rect;
  target: UiHitTarget;
}

interface CanvasLayout {
  viewport: Rect;
  topHud: Rect;
  boardPanel: Rect;
  gridRect: Rect;
  bottomDock: Rect;
  actionRow: Rect;
  handArea: Rect;
}

export interface LayoutSnapshot {
  viewport: Rect;
  topHud: Rect;
  boardPanel: Rect;
  gridRect: Rect;
  bottomDock: Rect;
  actionRow: Rect;
  handArea: Rect;
}

export interface RenderOverlayState {
  tilePreviews: PlacementPreview[];
  cursorPreview: PlacementPreview | null;
}

export type CanvasUiAction =
  | "new_run"
  | "clear_selection"
  | "end_turn"
  | "toggle_help"
  | "toggle_dev_tools"
  | "run_balance_report";

export type UiHitTarget =
  | { type: "none" }
  | { type: "board_tile"; x: number; y: number }
  | { type: "hand_card"; index: number }
  | { type: "action"; action: CanvasUiAction };

export interface CanvasUiRenderState {
  overlays: RenderOverlayState | null;
  slotCount: number;
  sessionStatus: string;
  feedbackMessage: string | null;
  showDevTools: boolean;
  showHelp: boolean;
  balanceReportOutput: string;
}

export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly cardDatabase: Record<string, CardDefinition>;
  private viewportWidth = 860;
  private viewportHeight = 640;
  private dpr = 1;
  private layout: CanvasLayout | null = null;
  private tileSize = 0;
  private normalHitRegions: HitRegion[] = [];
  private modalHitRegions: HitRegion[] = [];
  private lastState: GameState | null = null;
  private lastUiState: CanvasUiRenderState | null = null;

  constructor(canvas: HTMLCanvasElement, cardDatabase: Record<string, CardDefinition>) {
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas 2D context is unavailable.");
    }
    this.ctx = ctx;
    this.cardDatabase = cardDatabase;
    this.layout = this.computeLayout();
  }

  public resize(viewportWidth: number, viewportHeight: number, dpr: number): void {
    this.viewportWidth = Math.max(1, Math.floor(viewportWidth));
    this.viewportHeight = Math.max(1, Math.floor(viewportHeight));
    this.dpr = Math.max(1, dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.layout = this.computeLayout();
  }

  public render(state: GameState, ui: CanvasUiRenderState): void {
    if (!this.layout) {
      this.layout = this.computeLayout();
    }
    this.lastState = state;
    this.lastUiState = ui;
    this.normalHitRegions = [];
    this.modalHitRegions = [];

    const layout = this.layout;
    this.ctx.clearRect(0, 0, this.viewportWidth, this.viewportHeight);
    this.drawBackdrop(layout.viewport);
    this.drawTopHud(state, ui, layout);
    this.drawBoard(state, ui, layout);
    this.drawBottomDock(state, ui, layout);
    this.drawHoverPreview(state, ui, layout);
    this.drawHelpOverlay(ui, layout);
    this.drawDevOverlay(state, ui);
  }

  public hitTest(px: number, py: number): UiHitTarget {
    const ui = this.lastUiState;
    if (!ui) {
      return { type: "none" };
    }

    const regions = ui.showDevTools ? this.modalHitRegions : this.normalHitRegions;
    for (let i = regions.length - 1; i >= 0; i -= 1) {
      if (contains(regions[i].rect, px, py)) {
        return regions[i].target;
      }
    }

    if (!ui.showDevTools) {
      const tile = this.getTileAtPoint(px, py);
      if (tile) {
        return { type: "board_tile", x: tile.x, y: tile.y };
      }
    }

    return { type: "none" };
  }

  public getTileAtPoint(px: number, py: number): { x: number; y: number } | null {
    const layout = this.layout;
    const state = this.lastState;
    if (!layout || !state) {
      return null;
    }
    const { gridRect } = layout;
    const localX = px - gridRect.x;
    const localY = py - gridRect.y;
    if (localX < 0 || localY < 0 || localX >= gridRect.width || localY >= gridRect.height) {
      return null;
    }
    const x = Math.floor(localX / this.tileSize);
    const y = Math.floor(localY / this.tileSize);
    if (x < 0 || y < 0 || x >= state.grid.maxSize || y >= state.grid.maxSize) {
      return null;
    }
    return { x, y };
  }

  public getLayoutSnapshot(): LayoutSnapshot | null {
    if (!this.layout) {
      return null;
    }
    return {
      viewport: { ...this.layout.viewport },
      topHud: { ...this.layout.topHud },
      boardPanel: { ...this.layout.boardPanel },
      gridRect: { ...this.layout.gridRect },
      bottomDock: { ...this.layout.bottomDock },
      actionRow: { ...this.layout.actionRow },
      handArea: { ...this.layout.handArea },
    };
  }

  private drawBackdrop(viewport: Rect): void {
    const gradient = this.ctx.createLinearGradient(0, 0, viewport.width, viewport.height);
    gradient.addColorStop(0, "#f0e3cb");
    gradient.addColorStop(1, "#dbc39c");
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(viewport.x, viewport.y, viewport.width, viewport.height);
  }

  private drawTopHud(state: GameState, ui: CanvasUiRenderState, layout: CanvasLayout): void {
    const { topHud } = layout;
    drawRoundedRect(this.ctx, topHud, 14, "rgba(252, 245, 231, 0.95)", "rgba(148, 112, 78, 0.64)");

    const resourceGap = 8;
    const inset = 12;
    const titleWidth = Math.min(220, Math.max(160, topHud.width * 0.2));
    const statusWidth = Math.min(250, Math.max(190, topHud.width * 0.22));
    const resourcesWidth = Math.max(320, topHud.width - inset * 2 - titleWidth - statusWidth - resourceGap * 2);
    const resourceCellWidth = (resourcesWidth - resourceGap * 3) / 4;
    const resourceY = topHud.y + 12;
    const resourceHeight = 56;

    this.ctx.fillStyle = "#2f241d";
    this.ctx.font = "700 34px Palatino Linotype";
    this.ctx.textAlign = "left";
    this.ctx.textBaseline = "top";
    this.ctx.fillText("Card City Builder", topHud.x + inset, topHud.y + 8);

    this.ctx.fillStyle = "#5f4b3d";
    this.ctx.font = "500 14px Segoe UI";
    this.ctx.fillText("Single-canvas desktop prototype", topHud.x + inset, topHud.y + 50);

    const deltas = {
      gold: state.lastTurnBreakdown.total.gold,
      population: state.lastTurnBreakdown.total.population,
      happiness: state.lastTurnBreakdown.total.happiness - state.lastTurnBreakdown.pollutionPenalty,
      pollution: state.lastTurnBreakdown.total.pollution,
    };
    const resources = [
      { key: "Gold", value: state.resources.gold, delta: deltas.gold },
      { key: "Population", value: state.resources.population, delta: deltas.population },
      { key: "Happiness", value: state.resources.happiness, delta: deltas.happiness },
      { key: "Pollution", value: state.resources.pollution, delta: deltas.pollution },
    ];

    const resourcesStartX = topHud.x + inset + titleWidth + resourceGap;
    for (let i = 0; i < resources.length; i += 1) {
      const cellRect: Rect = {
        x: resourcesStartX + i * (resourceCellWidth + resourceGap),
        y: resourceY,
        width: resourceCellWidth,
        height: resourceHeight,
      };
      drawRoundedRect(
        this.ctx,
        cellRect,
        10,
        "rgba(255, 251, 243, 0.9)",
        i === 0 ? "rgba(196, 150, 70, 0.6)" : "rgba(145, 112, 78, 0.44)",
      );
      this.ctx.fillStyle = "#6f5645";
      this.ctx.font = "600 11px Segoe UI";
      this.ctx.fillText(resources[i].key.toUpperCase(), cellRect.x + 8, cellRect.y + 8);
      this.ctx.fillStyle = "#2f241d";
      this.ctx.font = "700 30px Segoe UI";
      this.ctx.fillText(String(resources[i].value), cellRect.x + 8, cellRect.y + 22);
      this.ctx.font = "600 12px Segoe UI";
      this.ctx.fillStyle =
        resources[i].delta > 0 ? "#2f7d44" : resources[i].delta < 0 ? "#b34a45" : "#6f5645";
      this.ctx.fillText(`Δ ${formatResourceDelta(resources[i].delta)}`, cellRect.x + 8, cellRect.y + 44);
    }

    const statusRect: Rect = {
      x: topHud.x + topHud.width - inset - statusWidth,
      y: topHud.y + 10,
      width: statusWidth,
      height: resourceHeight + 4,
    };
    drawRoundedRect(this.ctx, statusRect, 10, "rgba(240, 228, 206, 0.8)", "rgba(145, 112, 78, 0.44)");
    this.ctx.fillStyle = "#2f241d";
    this.ctx.font = "700 14px Segoe UI";
    this.ctx.fillText(`Turn ${state.turn}`, statusRect.x + 10, statusRect.y + 8);
    this.ctx.fillText(`Placements ${state.placementsRemaining}`, statusRect.x + 10, statusRect.y + 27);
    this.ctx.fillText(`Phase ${state.phase}`, statusRect.x + 10, statusRect.y + 46);

    const statusLineY = topHud.y + topHud.height - 31;
    this.ctx.fillStyle = "#5b4d42";
    this.ctx.font = "500 13px Segoe UI";
    this.ctx.fillText(trimForWidth(this.ctx, ui.sessionStatus, topHud.width - 24), topHud.x + 12, statusLineY);

    const alertText = ui.feedbackMessage ?? (state.lastEventName ? `Event: ${state.lastEventName}` : "No alerts.");
    this.ctx.fillStyle = ui.feedbackMessage ? "#b3473e" : "#5b4d42";
    this.ctx.font = "600 13px Segoe UI";
    this.ctx.fillText(trimForWidth(this.ctx, alertText, topHud.width - 24), topHud.x + 12, statusLineY + 16);
  }

  private drawBoard(state: GameState, ui: CanvasUiRenderState, layout: CanvasLayout): void {
    const { boardPanel, gridRect } = layout;
    drawRoundedRect(
      this.ctx,
      boardPanel,
      16,
      "linear",
      "rgba(67, 107, 102, 0.95)",
      "rgba(42, 74, 72, 0.96)",
      "rgba(196, 168, 129, 0.44)",
    );
    drawRoundedRect(this.ctx, gridRect, 12, "rgba(15, 39, 56, 0.92)", "rgba(103, 141, 163, 0.38)");

    const previewMap = new Map<string, PlacementPreview>();
    if (ui.overlays) {
      for (const preview of ui.overlays.tilePreviews) {
        previewMap.set(`${preview.x}:${preview.y}`, preview);
      }
    }

    const { minX, minY, maxX, maxY } = state.grid.activeBounds;
    for (let y = 0; y < state.grid.maxSize; y += 1) {
      for (let x = 0; x < state.grid.maxSize; x += 1) {
        const sx = gridRect.x + x * this.tileSize;
        const sy = gridRect.y + y * this.tileSize;
        const unlocked = x >= minX && x <= maxX && y >= minY && y <= maxY;
        const cardId = state.grid.tiles[y][x].cardId;

        if (!unlocked) {
          this.ctx.fillStyle = "#172f45";
        } else if (cardId) {
          const card = this.cardDatabase[cardId];
          this.ctx.fillStyle = card ? CATEGORY_COLORS[card.category] ?? "#8ea1b3" : "#8ea1b3";
        } else {
          this.ctx.fillStyle = "#1f3e58";
        }
        this.ctx.fillRect(sx + 1, sy + 1, this.tileSize - 2, this.tileSize - 2);

        const preview = previewMap.get(`${x}:${y}`);
        if (preview && unlocked) {
          this.ctx.fillStyle = preview.canPlace ? "rgba(98, 211, 148, 0.26)" : "rgba(232, 93, 117, 0.24)";
          this.ctx.fillRect(sx + 3, sy + 3, this.tileSize - 6, this.tileSize - 6);
        }

        this.ctx.strokeStyle = unlocked ? "rgba(237, 199, 120, 0.5)" : "rgba(255,255,255,0.08)";
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(sx + 0.5, sy + 0.5, this.tileSize - 1, this.tileSize - 1);

        if (cardId) {
          const card = this.cardDatabase[cardId];
          if (card) {
            this.ctx.fillStyle = "#101921";
            this.ctx.font = "700 11px Segoe UI";
            this.ctx.textAlign = "center";
            this.ctx.textBaseline = "middle";
            this.ctx.fillText(card.name.slice(0, 4).toUpperCase(), sx + this.tileSize / 2, sy + this.tileSize / 2);
          }
        }
      }
    }

    const cursorPreview = ui.overlays?.cursorPreview ?? null;
    const cursorColor = cursorPreview === null ? "#ffe66d" : cursorPreview.canPlace ? "#62d394" : "#e85d75";
    const cursorSx = gridRect.x + state.cursor.x * this.tileSize;
    const cursorSy = gridRect.y + state.cursor.y * this.tileSize;
    this.ctx.strokeStyle = cursorColor;
    this.ctx.lineWidth = 3;
    this.ctx.strokeRect(cursorSx + 2, cursorSy + 2, this.tileSize - 4, this.tileSize - 4);
  }

  private drawHoverPreview(state: GameState, ui: CanvasUiRenderState, layout: CanvasLayout): void {
    if (state.selectedHandIndex === null) {
      return;
    }
    const preview = ui.overlays?.cursorPreview ?? null;
    if (!preview) {
      return;
    }

    const tooltipWidth = 246;
    const tooltipHeight = 122;
    const anchorX = layout.gridRect.x + (preview.x + 1) * this.tileSize + 8;
    const anchorY = layout.gridRect.y + preview.y * this.tileSize + 8;
    const x = clamp(anchorX, 12, this.viewportWidth - tooltipWidth - 12);
    const y = clamp(anchorY, 12, this.viewportHeight - tooltipHeight - 12);

    drawRoundedRect(
      this.ctx,
      { x, y, width: tooltipWidth, height: tooltipHeight },
      10,
      "rgba(255, 249, 235, 0.96)",
      preview.canPlace ? "rgba(92, 164, 108, 0.55)" : "rgba(182, 76, 72, 0.55)",
    );
    this.ctx.fillStyle = "#31261f";
    this.ctx.font = "700 13px Segoe UI";
    this.ctx.fillText(
      preview.canPlace ? "Placement Impact" : "Placement Blocked",
      x + 10,
      y + 9,
    );
    this.ctx.font = "600 12px Segoe UI";
    this.ctx.fillText(`Tile (${preview.x}, ${preview.y})`, x + 10, y + 30);
    this.ctx.fillText(`Gold ${formatResourceDelta(preview.immediateDelta.gold)}`, x + 10, y + 52);
    this.ctx.fillText(`Population ${formatResourceDelta(preview.immediateDelta.population)}`, x + 10, y + 70);
    this.ctx.fillText(`Happiness ${formatResourceDelta(preview.immediateDelta.happiness)}`, x + 10, y + 88);
    this.ctx.fillText(`Pollution ${formatResourceDelta(preview.immediateDelta.pollution)}`, x + 10, y + 106);
    if (!preview.canPlace && preview.reason) {
      this.ctx.fillStyle = "#b34a45";
      this.ctx.font = "600 12px Segoe UI";
      this.ctx.fillText(reasonLabel(preview.reason), x + 120, y + 106);
    }
  }

  private drawBottomDock(state: GameState, ui: CanvasUiRenderState, layout: CanvasLayout): void {
    const { bottomDock, actionRow, handArea } = layout;
    drawRoundedRect(
      this.ctx,
      bottomDock,
      14,
      "linear",
      "rgba(89, 63, 43, 0.95)",
      "rgba(64, 44, 30, 0.96)",
      "rgba(204, 171, 125, 0.5)",
    );

    this.ctx.fillStyle = "#f7ebd7";
    this.ctx.font = "600 13px Segoe UI";
    this.ctx.fillText(
      "Controls: Arrow/WASD move | 1-0 select | Enter place | Esc clear | E end turn | H help | F1 dev",
      actionRow.x + 4,
      actionRow.y + 14,
    );

    const buttons = [
      { label: "New Run", action: "new_run" as CanvasUiAction, enabled: true, width: 108 },
      {
        label: "Clear",
        action: "clear_selection" as CanvasUiAction,
        enabled: state.selectedHandIndex !== null,
        width: 92,
      },
      {
        label: "End Turn",
        action: "end_turn" as CanvasUiAction,
        enabled: state.status === "running" && state.phase === "placement",
        width: 110,
      },
      {
        label: ui.showHelp ? "Hide Help" : "Help (H)",
        action: "toggle_help" as CanvasUiAction,
        enabled: true,
        width: 110,
      },
      {
        label: ui.showDevTools ? "Hide Dev" : "Dev (F1)",
        action: "toggle_dev_tools" as CanvasUiAction,
        enabled: true,
        width: 110,
      },
    ];

    let buttonX = actionRow.x + actionRow.width;
    for (const button of buttons) {
      buttonX -= button.width;
      const rect: Rect = {
        x: buttonX,
        y: actionRow.y + 2,
        width: button.width,
        height: actionRow.height - 4,
      };
      this.drawButton(rect, button.label, button.enabled, button.enabled ? "#f8ebd7" : "#c5b7a4");
      if (button.enabled) {
        this.normalHitRegions.push({
          rect,
          target: { type: "action", action: button.action },
        });
      }
      buttonX -= 8;
    }

    const slotCount = Math.max(1, ui.slotCount);
    const gap = 8;
    const minCardWidth = 130;
    const columns = Math.max(1, Math.min(slotCount, Math.floor((handArea.width + gap) / (minCardWidth + gap))));
    const rows = Math.max(1, Math.ceil(slotCount / columns));
    const cardWidth = (handArea.width - (columns - 1) * gap) / columns;
    const cardHeight = (handArea.height - (rows - 1) * gap) / rows;

    for (let index = 0; index < slotCount; index += 1) {
      const row = Math.floor(index / columns);
      const col = index % columns;
      const rect: Rect = {
        x: handArea.x + col * (cardWidth + gap),
        y: handArea.y + row * (cardHeight + gap),
        width: cardWidth,
        height: cardHeight,
      };
      const cardId = state.hand[index];
      if (!cardId) {
        drawRoundedRect(this.ctx, rect, 10, "rgba(255, 244, 227, 0.27)", "rgba(255, 255, 255, 0.2)");
        this.ctx.fillStyle = "rgba(245, 229, 205, 0.65)";
        this.ctx.font = "600 13px Segoe UI";
        this.ctx.fillText(`${index + 1}. Empty`, rect.x + 10, rect.y + 22);
        continue;
      }

      const card = this.cardDatabase[cardId];
      const affordable = state.resources.gold >= card.cost;
      const selected = state.selectedHandIndex === index;
      drawRoundedRect(
        this.ctx,
        rect,
        10,
        "rgba(255, 249, 237, 0.95)",
        selected ? "rgba(236, 202, 122, 0.95)" : "rgba(214, 184, 145, 0.8)",
      );
      this.ctx.fillStyle = "#2f241d";
      this.ctx.font = "700 13px Segoe UI";
      this.ctx.fillText(`${index + 1}. ${trimForWidth(this.ctx, card.name, rect.width - 18)}`, rect.x + 8, rect.y + 18);
      this.ctx.fillStyle = "#5c4a3e";
      this.ctx.font = "600 11px Segoe UI";
      this.ctx.fillText(`${card.category} | Cost ${card.cost}`, rect.x + 8, rect.y + 37);
      this.ctx.fillText(
        `G ${formatResourceDelta(card.baseYield.gold)}  P ${formatResourceDelta(card.baseYield.population)}  H ${formatResourceDelta(card.baseYield.happiness)}  Pol ${formatResourceDelta(card.baseYield.pollution)}`,
        rect.x + 8,
        rect.y + 55,
      );
      if (!affordable) {
        this.ctx.fillStyle = "#b44d46";
        this.ctx.font = "700 12px Segoe UI";
        this.ctx.fillText("Need more gold", rect.x + 8, rect.y + 74);
      } else {
        this.normalHitRegions.push({
          rect,
          target: { type: "hand_card", index },
        });
      }
    }
  }

  private drawHelpOverlay(ui: CanvasUiRenderState, layout: CanvasLayout): void {
    if (!ui.showHelp) {
      return;
    }
    const rect: Rect = {
      x: this.viewportWidth - 360,
      y: layout.topHud.y + layout.topHud.height + 12,
      width: 348,
      height: 176,
    };
    drawRoundedRect(this.ctx, rect, 12, "rgba(255, 250, 239, 0.95)", "rgba(165, 129, 89, 0.55)");
    this.ctx.fillStyle = "#2f241d";
    this.ctx.font = "700 16px Palatino Linotype";
    this.ctx.fillText("Quick Help", rect.x + 12, rect.y + 12);
    this.ctx.font = "600 12px Segoe UI";
    this.ctx.fillText("1) Select card with click or number keys.", rect.x + 12, rect.y + 42);
    this.ctx.fillText("2) Hover/move cursor on board to inspect impact.", rect.x + 12, rect.y + 62);
    this.ctx.fillText("3) Click/Enter to place selected card.", rect.x + 12, rect.y + 82);
    this.ctx.fillText("4) End turn with E or End Turn button.", rect.x + 12, rect.y + 102);
    this.ctx.fillText("5) Open dev overlay with F1.", rect.x + 12, rect.y + 122);

    const closeRect: Rect = {
      x: rect.x + rect.width - 110,
      y: rect.y + rect.height - 38,
      width: 96,
      height: 26,
    };
    this.drawButton(closeRect, "Close Help", true, "#3f3026");
    this.normalHitRegions.push({
      rect: closeRect,
      target: { type: "action", action: "toggle_help" },
    });
  }

  private drawDevOverlay(state: GameState, ui: CanvasUiRenderState): void {
    if (!ui.showDevTools) {
      return;
    }

    this.ctx.fillStyle = "rgba(14, 18, 24, 0.62)";
    this.ctx.fillRect(0, 0, this.viewportWidth, this.viewportHeight);

    const panel: Rect = {
      x: Math.round(this.viewportWidth * 0.12),
      y: Math.round(this.viewportHeight * 0.08),
      width: Math.round(this.viewportWidth * 0.76),
      height: Math.round(this.viewportHeight * 0.84),
    };
    drawRoundedRect(this.ctx, panel, 14, "rgba(248, 241, 228, 0.98)", "rgba(151, 116, 80, 0.72)");

    this.ctx.fillStyle = "#2f241d";
    this.ctx.font = "700 24px Palatino Linotype";
    this.ctx.fillText("Developer Tools", panel.x + 16, panel.y + 14);
    this.ctx.font = "600 13px Segoe UI";
    this.ctx.fillText("Run state and diagnostics are hidden from normal gameplay.", panel.x + 16, panel.y + 44);

    const closeRect: Rect = {
      x: panel.x + panel.width - 118,
      y: panel.y + 14,
      width: 102,
      height: 30,
    };
    this.drawButton(closeRect, "Close (F1)", true, "#3f3026");
    this.modalHitRegions.push({
      rect: closeRect,
      target: { type: "action", action: "toggle_dev_tools" },
    });

    const sectionY = panel.y + 64;
    const colGap = 16;
    const colWidth = (panel.width - 48 - colGap) / 2;
    const leftCol: Rect = { x: panel.x + 16, y: sectionY, width: colWidth, height: panel.height - 82 };
    const rightCol: Rect = { x: leftCol.x + colWidth + colGap, y: sectionY, width: colWidth, height: panel.height - 82 };

    drawRoundedRect(this.ctx, leftCol, 10, "rgba(255, 251, 242, 0.9)", "rgba(181, 150, 115, 0.55)");
    drawRoundedRect(this.ctx, rightCol, 10, "rgba(255, 251, 242, 0.9)", "rgba(181, 150, 115, 0.55)");

    const leftTextX = leftCol.x + 12;
    let textY = leftCol.y + 12;
    this.ctx.fillStyle = "#2f241d";
    this.ctx.font = "700 15px Segoe UI";
    this.ctx.fillText("Run State", leftTextX, textY);
    textY += 22;
    this.ctx.font = "600 13px Segoe UI";
    const runLines = [
      `Seed: ${state.rngSeed}`,
      `Turn: ${state.turn}`,
      `Phase: ${state.phase}`,
      `Status: ${state.status}`,
      `Placements: ${state.placementsRemaining}`,
      `Modifiers: ${state.activeModifiers.length}`,
      `Grid: ${state.grid.activeBounds.maxX - state.grid.activeBounds.minX + 1}x${
        state.grid.activeBounds.maxY - state.grid.activeBounds.minY + 1
      }`,
    ];
    for (const line of runLines) {
      this.ctx.fillText(line, leftTextX, textY);
      textY += 18;
    }

    textY += 6;
    this.ctx.font = "700 15px Segoe UI";
    this.ctx.fillText("Turn Breakdown", leftTextX, textY);
    textY += 22;
    this.ctx.font = "600 13px Segoe UI";
    const total = state.lastTurnBreakdown.total;
    const breakdownLines = [
      `Base Gold: ${formatResourceDelta(state.lastTurnBreakdown.base.gold)}`,
      `Adj Gold: ${formatResourceDelta(state.lastTurnBreakdown.adjacency.gold)}`,
      `Mod Gold: ${formatResourceDelta(state.lastTurnBreakdown.modifiers.gold)}`,
      `Total Gold: ${formatResourceDelta(total.gold)}`,
      `Total Pop: ${formatResourceDelta(total.population)}`,
      `Total Happ: ${formatResourceDelta(total.happiness - state.lastTurnBreakdown.pollutionPenalty)}`,
      `Total Poll: ${formatResourceDelta(total.pollution)}`,
      `Pollution Penalty: -${state.lastTurnBreakdown.pollutionPenalty}`,
    ];
    for (const line of breakdownLines) {
      this.ctx.fillText(line, leftTextX, textY);
      textY += 18;
      if (textY > leftCol.y + leftCol.height - 40) {
        break;
      }
    }

    const rightTextX = rightCol.x + 12;
    let rightY = rightCol.y + 12;
    this.ctx.fillStyle = "#2f241d";
    this.ctx.font = "700 15px Segoe UI";
    this.ctx.fillText("Recent Log", rightTextX, rightY);
    rightY += 22;
    this.ctx.font = "600 13px Segoe UI";
    for (const line of state.log.slice(0, 8)) {
      this.ctx.fillText(trimForWidth(this.ctx, line, rightCol.width - 24), rightTextX, rightY);
      rightY += 18;
    }

    rightY += 8;
    this.ctx.font = "700 15px Segoe UI";
    this.ctx.fillText("Balance Report", rightTextX, rightY);
    rightY += 22;

    const reportButtonRect: Rect = {
      x: rightCol.x + rightCol.width - 166,
      y: rightY - 19,
      width: 154,
      height: 26,
    };
    this.drawButton(reportButtonRect, "Run Report", true, "#3f3026");
    this.modalHitRegions.push({
      rect: reportButtonRect,
      target: { type: "action", action: "run_balance_report" },
    });
    rightY += 14;

    this.ctx.font = "600 12px Consolas";
    const reportLines = wrapText(this.ctx, ui.balanceReportOutput, rightCol.width - 24);
    for (const line of reportLines.slice(0, 16)) {
      this.ctx.fillText(line, rightTextX, rightY);
      rightY += 16;
      if (rightY > rightCol.y + rightCol.height - 10) {
        break;
      }
    }
  }

  private drawButton(rect: Rect, label: string, enabled: boolean, textColor: string): void {
    drawRoundedRect(
      this.ctx,
      rect,
      8,
      enabled ? "rgba(199, 142, 71, 0.95)" : "rgba(177, 155, 125, 0.6)",
      enabled ? "rgba(125, 81, 36, 0.9)" : "rgba(130, 110, 90, 0.65)",
    );
    this.ctx.fillStyle = textColor;
    this.ctx.font = "700 12px Segoe UI";
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    this.ctx.fillText(label, rect.x + rect.width / 2, rect.y + rect.height / 2);
    this.ctx.textAlign = "left";
    this.ctx.textBaseline = "alphabetic";
  }

  private computeLayout(): CanvasLayout {
    const viewport: Rect = {
      x: 0,
      y: 0,
      width: this.viewportWidth,
      height: this.viewportHeight,
    };

    const padding = clamp(Math.round(Math.min(viewport.width, viewport.height) * 0.015), 10, 20);
    const gap = clamp(Math.round(Math.min(viewport.width, viewport.height) * 0.012), 8, 14);
    let topHudHeight = clamp(Math.round(viewport.height * 0.16), 96, 138);
    let bottomDockHeight = clamp(Math.round(viewport.height * 0.3), 190, 260);
    const minBoardHeight = 220;
    const availableHeight = viewport.height - padding * 2;
    const desired = topHudHeight + bottomDockHeight + gap * 2 + minBoardHeight;
    if (desired > availableHeight) {
      const overflow = desired - availableHeight;
      bottomDockHeight = Math.max(150, bottomDockHeight - Math.round(overflow * 0.7));
      topHudHeight = Math.max(84, topHudHeight - Math.round(overflow * 0.3));
    }

    const topHud: Rect = {
      x: padding,
      y: padding,
      width: viewport.width - padding * 2,
      height: topHudHeight,
    };
    const bottomDock: Rect = {
      x: padding,
      y: viewport.height - padding - bottomDockHeight,
      width: viewport.width - padding * 2,
      height: bottomDockHeight,
    };

    const boardAreaY = topHud.y + topHud.height + gap;
    const boardAreaHeight = Math.max(220, bottomDock.y - gap - boardAreaY);
    const boardSize = Math.min(boardAreaHeight, viewport.width - padding * 2);
    const boardPanel: Rect = {
      x: Math.round((viewport.width - boardSize) / 2),
      y: Math.round(boardAreaY + (boardAreaHeight - boardSize) / 2),
      width: Math.round(boardSize),
      height: Math.round(boardSize),
    };

    const gridInset = Math.max(12, Math.round(boardPanel.width * 0.03));
    const gridRect: Rect = {
      x: boardPanel.x + gridInset,
      y: boardPanel.y + gridInset,
      width: boardPanel.width - gridInset * 2,
      height: boardPanel.height - gridInset * 2,
    };

    const actionRow: Rect = {
      x: bottomDock.x + 12,
      y: bottomDock.y + 10,
      width: bottomDock.width - 24,
      height: 44,
    };
    const handArea: Rect = {
      x: bottomDock.x + 12,
      y: actionRow.y + actionRow.height + 8,
      width: bottomDock.width - 24,
      height: bottomDock.height - actionRow.height - 20,
    };

    this.tileSize = gridRect.width / 10;
    return {
      viewport,
      topHud,
      boardPanel,
      gridRect,
      bottomDock,
      actionRow,
      handArea,
    };
  }
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  radius: number,
  fill: string,
  stroke: string,
  fillB?: string,
  strokeOverride?: string,
): void {
  ctx.beginPath();
  ctx.moveTo(rect.x + radius, rect.y);
  ctx.lineTo(rect.x + rect.width - radius, rect.y);
  ctx.quadraticCurveTo(rect.x + rect.width, rect.y, rect.x + rect.width, rect.y + radius);
  ctx.lineTo(rect.x + rect.width, rect.y + rect.height - radius);
  ctx.quadraticCurveTo(
    rect.x + rect.width,
    rect.y + rect.height,
    rect.x + rect.width - radius,
    rect.y + rect.height,
  );
  ctx.lineTo(rect.x + radius, rect.y + rect.height);
  ctx.quadraticCurveTo(rect.x, rect.y + rect.height, rect.x, rect.y + rect.height - radius);
  ctx.lineTo(rect.x, rect.y + radius);
  ctx.quadraticCurveTo(rect.x, rect.y, rect.x + radius, rect.y);
  ctx.closePath();

  if (fill === "linear" && fillB) {
    const gradient = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.height);
    gradient.addColorStop(0, stroke);
    gradient.addColorStop(1, fillB);
    ctx.fillStyle = gradient;
  } else {
    ctx.fillStyle = fill;
  }
  ctx.fill();

  ctx.strokeStyle = strokeOverride ?? stroke;
  ctx.lineWidth = 1.2;
  ctx.stroke();
}

function contains(rect: Rect, x: number, y: number): boolean {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function trimForWidth(ctx: CanvasRenderingContext2D, value: string, maxWidth: number): string {
  if (ctx.measureText(value).width <= maxWidth) {
    return value;
  }
  let trimmed = value;
  while (trimmed.length > 0 && ctx.measureText(`${trimmed}...`).width > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return `${trimmed}...`;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const baseLine of text.split("\n")) {
    const words = baseLine.split(" ");
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth) {
        current = candidate;
      } else {
        if (current) {
          lines.push(current);
        }
        current = word;
      }
    }
    lines.push(current);
  }
  return lines;
}

function reasonLabel(reason: PlacementPreview["reason"]): string {
  if (reason === "insufficient_gold") {
    return "Need gold";
  }
  if (reason === "occupied") {
    return "Occupied";
  }
  if (reason === "locked") {
    return "Locked";
  }
  if (reason === "out_of_bounds") {
    return "Out of bounds";
  }
  return "No selection";
}
