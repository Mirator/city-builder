import "./style.css";
import { Game } from "./game/Game";
import { Input } from "./game/Input";
import type { PlacementPreview } from "./game/types";
import { Renderer, type RenderOverlayState } from "./game/Renderer";
import { clearSavedRun, createDebouncedAction, loadSavedRun, saveRun } from "./game/persistence";
import { runDeterministicBatch } from "./game/simulation";

const canvas = must(document.querySelector<HTMLCanvasElement>("#game-canvas"));

const game = new Game();
let resumedRun = false;
const savedRun = loadSavedRun();
if (savedRun) {
  resumedRun = game.fromSnapshot(savedRun);
  if (!resumedRun) {
    clearSavedRun();
  }
}

const renderer = new Renderer(canvas, game.getCardDatabase());
let sessionStatus = resumedRun
  ? `Resumed run from turn ${game.getState().turn} (seed ${game.getState().rngSeed}).`
  : `Started new run (seed ${game.getState().rngSeed}).`;
let showDevTools = false;
let showHelp = false;
let balanceReportOutput = "No report yet.";

const input = new Input(game, renderer, canvas, {
  onNewRun: () => startNewRun(),
  onToggleHelp: () => {
    showHelp = !showHelp;
    render();
  },
  onToggleDevTools: () => {
    showDevTools = !showDevTools;
    render();
  },
  onRunBalanceReport: () => runBalanceReport(),
});

const autoSave = createDebouncedAction(() => {
  saveRun(game.toSnapshot());
}, 280);

const unsubscribe = game.subscribe(() => {
  render();
  autoSave.schedule();
});

const onResize = () => {
  syncCanvasToViewport();
  render();
};
window.addEventListener("resize", onResize);
syncCanvasToViewport();
render();

window.addEventListener("beforeunload", () => {
  autoSave.flush();
  input.dispose();
  unsubscribe();
  window.removeEventListener("resize", onResize);
});

function render(): void {
  const state = game.getState();
  const overlays = buildRenderOverlays(game, state.selectedHandIndex);
  renderer.render(state, {
    overlays,
    slotCount: game.getConfig().cardsPerTurn,
    sessionStatus,
    feedbackMessage: game.getActionFeedback(),
    showDevTools,
    showHelp,
    balanceReportOutput,
  });
}

function startNewRun(): void {
  clearSavedRun();
  game.reset();
  sessionStatus = `Started new run (seed ${game.getState().rngSeed}).`;
}

function runBalanceReport(): void {
  balanceReportOutput = "Running report...";
  render();
  const config = game.getConfig();
  const summary = runDeterministicBatch(1, 100, 600);
  const winRate = summary.count > 0 ? Math.round((summary.wins / summary.count) * 100) : 0;
  balanceReportOutput = [
    `Runs: ${summary.count} (seeds 1-${summary.count})`,
    `Win rate: ${winRate}%`,
    `Avg turn: ${summary.averageTurn.toFixed(2)} (min ${summary.minTurn}, max ${summary.maxTurn})`,
    `Config: victory=${config.victoryPopulation}, cards/turn=${config.cardsPerTurn}, placements/turn=${config.maxPlacementsPerTurn}, event every ${config.eventCadenceTurns} turns`,
  ].join("\n");
  render();
}

function syncCanvasToViewport(): void {
  const width = Math.max(1, window.innerWidth);
  const height = Math.max(1, window.innerHeight);
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.max(1, Math.floor(width * dpr));
  canvas.height = Math.max(1, Math.floor(height * dpr));
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  renderer.resize(width, height, dpr);
}

function must<T>(value: T | null): T {
  if (!value) {
    throw new Error("Missing required DOM element.");
  }
  return value;
}

function buildRenderOverlays(gameInstance: Game, selectedHandIndex: number | null): RenderOverlayState | null {
  if (selectedHandIndex === null) {
    return null;
  }

  const state = gameInstance.getState();
  const previews: PlacementPreview[] = [];
  for (let y = state.grid.activeBounds.minY; y <= state.grid.activeBounds.maxY; y += 1) {
    for (let x = state.grid.activeBounds.minX; x <= state.grid.activeBounds.maxX; x += 1) {
      previews.push(gameInstance.getPlacementPreview(selectedHandIndex, x, y));
    }
  }

  return {
    tilePreviews: previews,
    cursorPreview: gameInstance.getPlacementPreview(
      selectedHandIndex,
      state.cursor.x,
      state.cursor.y,
    ),
  };
}
