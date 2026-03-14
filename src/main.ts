import "./style.css";
import { Game } from "./game/Game";
import { Input } from "./game/Input";
import { Renderer } from "./game/Renderer";
import { clearSavedRun, createDebouncedAction, loadSavedRun, saveRun } from "./game/persistence";
import { runDeterministicBatch } from "./game/simulation";
import { CardHand } from "./ui/CardHand";
import { HUD } from "./ui/HUD";

const canvas = must(document.querySelector<HTMLCanvasElement>("#game-canvas"));
const resourcesEl = must(document.querySelector<HTMLElement>("#hud-resources"));
const runEl = must(document.querySelector<HTMLElement>("#hud-run"));
const breakdownEl = must(document.querySelector<HTMLElement>("#hud-breakdown"));
const eventEl = must(document.querySelector<HTMLElement>("#hud-event"));
const logEl = must(document.querySelector<HTMLUListElement>("#hud-log"));
const handEl = must(document.querySelector<HTMLElement>("#card-hand"));
const newRunButton = must(document.querySelector<HTMLButtonElement>("#btn-new-run"));
const newRunCtaButton = must(document.querySelector<HTMLButtonElement>("#btn-new-run-cta"));
const gameOverPanel = must(document.querySelector<HTMLElement>("#game-over-panel"));
const gameOverMessage = must(document.querySelector<HTMLElement>("#game-over-message"));
const sessionStatusEl = must(document.querySelector<HTMLElement>("#session-status"));
const controlRangeEl = must(document.querySelector<HTMLElement>("#control-hand-range"));
const runBalanceReportButton = must(document.querySelector<HTMLButtonElement>("#btn-run-balance-report"));
const balanceReportOutput = must(document.querySelector<HTMLElement>("#balance-report-output"));

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
const hud = new HUD({
  resources: resourcesEl,
  run: runEl,
  breakdown: breakdownEl,
  event: eventEl,
  log: logEl,
});
const hand = new CardHand(handEl, (index) => game.selectHandIndex(index));
const input = new Input(game, renderer, canvas);
const autoSave = createDebouncedAction(() => {
  saveRun(game.toSnapshot());
}, 280);

function render(): void {
  const state = game.getState();
  const cardsPerTurn = game.getConfig().cardsPerTurn;
  renderer.render(state);
  hud.render(state);
  hand.render(
    state.hand,
    state.selectedHandIndex,
    game.getCardDatabase(),
    state.resources.gold,
    cardsPerTurn,
  );
  gameOverPanel.hidden = state.status === "running";
  if (state.status === "won") {
    gameOverMessage.textContent = "Victory reached. Start a new run to play again.";
  } else if (state.status === "lost") {
    gameOverMessage.textContent = state.lossReason ?? "Run ended. Start a new run.";
  } else {
    gameOverMessage.textContent = "";
  }
  controlRangeEl.textContent = formatHandRange(cardsPerTurn);
  handEl.style.setProperty("--hand-columns", String(Math.max(1, Math.min(cardsPerTurn, 10))));
}

const unsubscribe = game.subscribe(() => {
  render();
  autoSave.schedule();
});

sessionStatusEl.textContent = resumedRun
  ? `Resumed run from turn ${game.getState().turn} (seed ${game.getState().rngSeed}).`
  : `Started new run (seed ${game.getState().rngSeed}).`;

const onStartNewRun = () => {
  clearSavedRun();
  game.reset();
  sessionStatusEl.textContent = `Started new run (seed ${game.getState().rngSeed}).`;
};

const onRunBalanceReport = () => {
  balanceReportOutput.textContent = "Running report...";
  const config = game.getConfig();
  const summary = runDeterministicBatch(1, 100, 600);
  const winRate = summary.count > 0 ? Math.round((summary.wins / summary.count) * 100) : 0;
  balanceReportOutput.textContent = [
    `Runs: ${summary.count} (seeds 1-${summary.count})`,
    `Win rate: ${winRate}%`,
    `Avg turn: ${summary.averageTurn.toFixed(2)} (min ${summary.minTurn}, max ${summary.maxTurn})`,
    `Config: victory=${config.victoryPopulation}, cards/turn=${config.cardsPerTurn}, placements/turn=${config.maxPlacementsPerTurn}, event every ${config.eventCadenceTurns} turns`,
  ].join("\n");
};

newRunButton.addEventListener("click", onStartNewRun);
newRunCtaButton.addEventListener("click", onStartNewRun);
runBalanceReportButton.addEventListener("click", onRunBalanceReport);

window.addEventListener("beforeunload", () => {
  autoSave.flush();
  input.dispose();
  unsubscribe();
  newRunButton.removeEventListener("click", onStartNewRun);
  newRunCtaButton.removeEventListener("click", onStartNewRun);
  runBalanceReportButton.removeEventListener("click", onRunBalanceReport);
});

function must<T>(value: T | null): T {
  if (!value) {
    throw new Error("Missing required DOM element.");
  }
  return value;
}

function formatHandRange(cardsPerTurn: number): string {
  const bounded = Math.max(1, Math.floor(cardsPerTurn));
  if (bounded <= 9) {
    return `1-${bounded}`;
  }
  if (bounded === 10) {
    return "1-9 and 0";
  }
  return "1-9";
}
