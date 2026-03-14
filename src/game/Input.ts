import type { CanvasUiAction, UiHitTarget } from "./Renderer";
import type { GameState } from "./types";

export interface InputGameController {
  getState(): GameState;
  moveCursor(dx: number, dy: number): void;
  setCursor(x: number, y: number): boolean;
  selectHandIndex(index: number): void;
  clearSelection(): void;
  placeSelectedAtCursor(): boolean;
  placeSelectedAt(x: number, y: number): boolean;
  endPlacementPhase(): void;
}

export interface InputRendererController {
  hitTest(px: number, py: number): UiHitTarget;
}

export interface InputUiCallbacks {
  onNewRun(): void;
  onToggleHelp(): void;
  onToggleDevTools(): void;
  onRunBalanceReport(): void;
}

export class Input {
  private readonly game: InputGameController;
  private readonly renderer: InputRendererController;
  private readonly canvas: HTMLCanvasElement;
  private readonly callbacks: InputUiCallbacks;
  private readonly onKeyDown: (event: KeyboardEvent) => void;
  private readonly onMouseDown: (event: MouseEvent) => void;
  private readonly onMouseMove: (event: MouseEvent) => void;

  constructor(
    game: InputGameController,
    renderer: InputRendererController,
    canvas: HTMLCanvasElement,
    callbacks: InputUiCallbacks,
  ) {
    this.game = game;
    this.renderer = renderer;
    this.canvas = canvas;
    this.callbacks = callbacks;
    this.onKeyDown = (event) => this.handleKeyDown(event);
    this.onMouseDown = (event) => this.handleMouseDown(event);
    this.onMouseMove = (event) => this.handleMouseMove(event);

    window.addEventListener("keydown", this.onKeyDown);
    this.canvas.addEventListener("mousedown", this.onMouseDown);
    this.canvas.addEventListener("mousemove", this.onMouseMove);
  }

  public dispose(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    this.canvas.removeEventListener("mousedown", this.onMouseDown);
    this.canvas.removeEventListener("mousemove", this.onMouseMove);
  }

  private handleKeyDown(event: KeyboardEvent): void {
    const key = event.key.toLowerCase();
    if (key === "f1") {
      this.callbacks.onToggleDevTools();
      event.preventDefault();
      return;
    }
    if (key === "h") {
      this.callbacks.onToggleHelp();
      event.preventDefault();
      return;
    }

    const state = this.game.getState();
    if (state.status !== "running") {
      return;
    }

    const movementMap: Record<string, { dx: number; dy: number }> = {
      arrowup: { dx: 0, dy: -1 },
      w: { dx: 0, dy: -1 },
      arrowdown: { dx: 0, dy: 1 },
      s: { dx: 0, dy: 1 },
      arrowleft: { dx: -1, dy: 0 },
      a: { dx: -1, dy: 0 },
      arrowright: { dx: 1, dy: 0 },
      d: { dx: 1, dy: 0 },
    };

    if (movementMap[key]) {
      const { dx, dy } = movementMap[key];
      this.game.moveCursor(dx, dy);
      event.preventDefault();
      return;
    }

    const handIndex = this.keyToHandIndex(event.key, state.hand.length);
    if (handIndex !== null) {
      this.game.selectHandIndex(handIndex);
      event.preventDefault();
      return;
    }

    if (event.key === "Enter") {
      this.game.placeSelectedAtCursor();
      event.preventDefault();
      return;
    }

    if (event.key === "Escape") {
      this.game.clearSelection();
      event.preventDefault();
      return;
    }

    if (key === "e") {
      this.game.endPlacementPhase();
      event.preventDefault();
    }
  }

  private handleMouseDown(event: MouseEvent): void {
    const { px, py } = this.getCanvasPoint(event);
    const hit = this.renderer.hitTest(px, py);
    this.routeHitTarget(hit);
  }

  private handleMouseMove(event: MouseEvent): void {
    const state = this.game.getState();
    if (state.status !== "running") {
      return;
    }

    const { px, py } = this.getCanvasPoint(event);
    const hit = this.renderer.hitTest(px, py);
    if (hit.type === "board_tile") {
      this.game.setCursor(hit.x, hit.y);
    }
  }

  private routeHitTarget(hit: UiHitTarget): void {
    if (hit.type === "none") {
      return;
    }
    if (hit.type === "board_tile") {
      this.game.setCursor(hit.x, hit.y);
      this.game.placeSelectedAt(hit.x, hit.y);
      return;
    }
    if (hit.type === "hand_card") {
      this.game.selectHandIndex(hit.index);
      return;
    }
    this.handleAction(hit.action);
  }

  private handleAction(action: CanvasUiAction): void {
    if (action === "new_run") {
      this.callbacks.onNewRun();
      return;
    }
    if (action === "clear_selection") {
      this.game.clearSelection();
      return;
    }
    if (action === "end_turn") {
      this.game.endPlacementPhase();
      return;
    }
    if (action === "toggle_help") {
      this.callbacks.onToggleHelp();
      return;
    }
    if (action === "toggle_dev_tools") {
      this.callbacks.onToggleDevTools();
      return;
    }
    this.callbacks.onRunBalanceReport();
  }

  private getCanvasPoint(event: MouseEvent): { px: number; py: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      px: event.clientX - rect.left,
      py: event.clientY - rect.top,
    };
  }

  private keyToHandIndex(key: string, maxSlots: number): number | null {
    if (maxSlots <= 0) {
      return null;
    }
    if (/^[1-9]$/.test(key)) {
      const index = Number(key) - 1;
      return index < maxSlots ? index : null;
    }
    if (key === "0") {
      return maxSlots >= 10 ? 9 : null;
    }
    return null;
  }
}
