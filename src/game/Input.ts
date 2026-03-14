import type { GameState } from "./types";

export interface InputGameController {
  getState(): GameState;
  moveCursor(dx: number, dy: number): void;
  selectHandIndex(index: number): void;
  clearSelection(): void;
  placeSelectedAtCursor(): boolean;
  placeSelectedAt(x: number, y: number): boolean;
  endPlacementPhase(): void;
}

export interface InputRendererController {
  getTileAtPoint(px: number, py: number): { x: number; y: number } | null;
}

export class Input {
  private readonly game: InputGameController;
  private readonly renderer: InputRendererController;
  private readonly canvas: HTMLCanvasElement;
  private readonly onKeyDown: (event: KeyboardEvent) => void;
  private readonly onMouseDown: (event: MouseEvent) => void;

  constructor(
    game: InputGameController,
    renderer: InputRendererController,
    canvas: HTMLCanvasElement,
  ) {
    this.game = game;
    this.renderer = renderer;
    this.canvas = canvas;
    this.onKeyDown = (event) => this.handleKeyDown(event);
    this.onMouseDown = (event) => this.handleMouseDown(event);

    window.addEventListener("keydown", this.onKeyDown);
    this.canvas.addEventListener("mousedown", this.onMouseDown);
  }

  public dispose(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    this.canvas.removeEventListener("mousedown", this.onMouseDown);
  }

  private handleKeyDown(event: KeyboardEvent): void {
    const state = this.game.getState();
    if (state.status !== "running") {
      return;
    }

    const key = event.key.toLowerCase();
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
    const state = this.game.getState();
    if (state.status !== "running") {
      return;
    }

    const rect = this.canvas.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * this.canvas.width;
    const py = ((event.clientY - rect.top) / rect.height) * this.canvas.height;
    const tile = this.renderer.getTileAtPoint(px, py);
    if (!tile) {
      return;
    }

    this.game.placeSelectedAt(tile.x, tile.y);
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
