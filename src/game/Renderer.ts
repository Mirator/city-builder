import type { CardDefinition } from "../cards/Card";
import type { GameState } from "./types";

const CATEGORY_COLORS: Record<string, string> = {
  Residential: "#5bc0eb",
  Industry: "#ff7f50",
  Services: "#99d98c",
  Infrastructure: "#f4b942",
  Culture: "#e0aaff",
};

interface BoardRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class Renderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly cardDatabase: Record<string, CardDefinition>;
  private readonly boardRect: BoardRect;
  private readonly tileSize: number;

  constructor(canvas: HTMLCanvasElement, cardDatabase: Record<string, CardDefinition>) {
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas 2D context is unavailable.");
    }
    this.canvas = canvas;
    this.ctx = ctx;
    this.cardDatabase = cardDatabase;
    this.boardRect = {
      x: 60,
      y: 60,
      width: 560,
      height: 560,
    };
    this.tileSize = this.boardRect.width / 10;
  }

  public render(state: GameState): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawBackdrop();
    this.drawGrid(state);
    this.drawCursor(state);
    this.drawStatus(state);
  }

  public getTileAtPoint(px: number, py: number): { x: number; y: number } | null {
    const localX = px - this.boardRect.x;
    const localY = py - this.boardRect.y;
    if (localX < 0 || localY < 0 || localX >= this.boardRect.width || localY >= this.boardRect.height) {
      return null;
    }
    const x = Math.floor(localX / this.tileSize);
    const y = Math.floor(localY / this.tileSize);
    return { x, y };
  }

  private drawBackdrop(): void {
    const gradient = this.ctx.createLinearGradient(0, 0, this.canvas.width, this.canvas.height);
    gradient.addColorStop(0, "#102438");
    gradient.addColorStop(1, "#0d1f31");
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.strokeStyle = "rgba(76, 201, 240, 0.22)";
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(
      this.boardRect.x - 8,
      this.boardRect.y - 8,
      this.boardRect.width + 16,
      this.boardRect.height + 16,
    );
  }

  private drawGrid(state: GameState): void {
    const { minX, minY, maxX, maxY } = state.grid.activeBounds;

    for (let y = 0; y < state.grid.maxSize; y += 1) {
      for (let x = 0; x < state.grid.maxSize; x += 1) {
        const sx = this.boardRect.x + x * this.tileSize;
        const sy = this.boardRect.y + y * this.tileSize;
        const unlocked = x >= minX && x <= maxX && y >= minY && y <= maxY;
        const cardId = state.grid.tiles[y][x].cardId;

        if (!unlocked) {
          this.ctx.fillStyle = "#14273a";
        } else if (cardId) {
          const card = this.cardDatabase[cardId];
          this.ctx.fillStyle = card ? CATEGORY_COLORS[card.category] ?? "#7d8597" : "#7d8597";
        } else {
          this.ctx.fillStyle = "#1d3147";
        }
        this.ctx.fillRect(sx + 1, sy + 1, this.tileSize - 2, this.tileSize - 2);

        this.ctx.strokeStyle = unlocked ? "rgba(244, 185, 66, 0.4)" : "rgba(255,255,255,0.08)";
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(sx + 0.5, sy + 0.5, this.tileSize - 1, this.tileSize - 1);

        if (cardId) {
          this.drawCardLabel(sx, sy, cardId);
        }
      }
    }
  }

  private drawCardLabel(sx: number, sy: number, cardId: string): void {
    const card = this.cardDatabase[cardId];
    if (!card) {
      return;
    }
    const text = card.name.slice(0, 4).toUpperCase();
    this.ctx.fillStyle = "#0b1220";
    this.ctx.font = "bold 12px Trebuchet MS";
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    this.ctx.fillText(text, sx + this.tileSize / 2, sy + this.tileSize / 2);
  }

  private drawCursor(state: GameState): void {
    const sx = this.boardRect.x + state.cursor.x * this.tileSize;
    const sy = this.boardRect.y + state.cursor.y * this.tileSize;
    this.ctx.strokeStyle = "#ffe66d";
    this.ctx.lineWidth = 3;
    this.ctx.strokeRect(sx + 2, sy + 2, this.tileSize - 4, this.tileSize - 4);
  }

  private drawStatus(state: GameState): void {
    this.ctx.fillStyle = "#d6e2ee";
    this.ctx.font = "bold 16px Trebuchet MS";
    this.ctx.textAlign = "left";
    this.ctx.fillText(`Turn ${state.turn} | Placements left: ${state.placementsRemaining}`, 60, 30);

    if (state.status !== "running") {
      this.ctx.fillStyle = state.status === "won" ? "rgba(98, 211, 148, 0.94)" : "rgba(232, 93, 117, 0.94)";
      this.ctx.fillRect(150, 270, 420, 92);
      this.ctx.fillStyle = "#0d1521";
      this.ctx.font = "bold 30px Trebuchet MS";
      this.ctx.textAlign = "center";
      this.ctx.fillText(state.status === "won" ? "VICTORY" : "DEFEAT", 360, 316);
    }
  }
}
