import type { GameState, Resources } from "../game/types";
import { RESOURCE_KEYS, formatResourceDelta } from "../utils/resource";

interface HudElements {
  resources: HTMLElement;
  run: HTMLElement;
  breakdown: HTMLElement;
  event: HTMLElement;
  log: HTMLUListElement;
}

export class HUD {
  private readonly elements: HudElements;

  constructor(elements: HudElements) {
    this.elements = elements;
  }

  public render(state: GameState): void {
    this.elements.resources.innerHTML = this.renderResourceRows(state.resources);
    this.elements.run.innerHTML = [
      this.kv("Seed", String(state.rngSeed)),
      this.kv("Turn", String(state.turn)),
      this.kv("Phase", state.phase),
      this.kv("Status", state.status),
      this.kv("Placements", String(state.placementsRemaining)),
      this.kv("Active Mods", String(state.activeModifiers.length)),
      this.kv("Grid", `${state.grid.activeBounds.maxX - state.grid.activeBounds.minX + 1}x${
        state.grid.activeBounds.maxY - state.grid.activeBounds.minY + 1
      }`),
    ].join("");

    const total = state.lastTurnBreakdown.total;
    this.elements.breakdown.innerHTML = [
      this.kv("Base Gold", formatResourceDelta(state.lastTurnBreakdown.base.gold)),
      this.kv("Adj Gold", formatResourceDelta(state.lastTurnBreakdown.adjacency.gold)),
      this.kv("Mod Gold", formatResourceDelta(state.lastTurnBreakdown.modifiers.gold)),
      this.kv("Total Gold", formatResourceDelta(total.gold)),
      this.kv("Total Pop", formatResourceDelta(total.population)),
      this.kv(
        "Total Happ",
        formatResourceDelta(total.happiness - state.lastTurnBreakdown.pollutionPenalty),
      ),
      this.kv("Total Poll", formatResourceDelta(total.pollution)),
      this.kv("Pollution Penalty", `-${state.lastTurnBreakdown.pollutionPenalty}`),
    ].join("");

    const statusLine = state.lossReason
      ? state.lossReason
      : state.lastEventName
        ? `Last event: ${state.lastEventName}`
        : "No event this turn.";
    this.elements.event.textContent = statusLine;

    this.elements.log.innerHTML = "";
    for (const line of state.log) {
      const item = document.createElement("li");
      item.textContent = line;
      this.elements.log.appendChild(item);
    }
  }

  private renderResourceRows(resources: Resources): string {
    return RESOURCE_KEYS.map((key) => this.kv(capitalize(key), String(resources[key]))).join("");
  }

  private kv(label: string, value: string): string {
    const cls = value.startsWith("+") ? "value positive" : value.startsWith("-") ? "value negative" : "value";
    return `<span class="label">${label}</span><span class="${cls}">${value}</span>`;
  }
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
