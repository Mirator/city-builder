import type { GameState, PlacementBlockReason, PlacementPreview, Resources } from "../game/types";
import { RESOURCE_KEYS, formatResourceDelta } from "../utils/resource";

interface HudElements {
  resources: HTMLElement;
  run: HTMLElement;
  breakdown: HTMLElement;
  event: HTMLElement;
  log: HTMLUListElement;
  preview: HTMLElement;
}

export interface HudRenderOptions {
  placementPreview: PlacementPreview | null;
  selectedCardName: string | null;
  selectedCardIndex: number | null;
}

export class HUD {
  private readonly elements: HudElements;

  constructor(elements: HudElements) {
    this.elements = elements;
  }

  public render(state: GameState, options: HudRenderOptions): void {
    this.elements.resources.innerHTML = this.renderResourcePills(state.resources);
    this.elements.run.innerHTML = [
      this.kv("Seed", String(state.rngSeed)),
      this.kv("Turn", String(state.turn)),
      this.kv("Phase", state.phase),
      this.kv("Status", state.status),
      this.kv("Placements", String(state.placementsRemaining)),
      this.kv("Modifiers", String(state.activeModifiers.length)),
      this.kv(
        "Grid",
        `${state.grid.activeBounds.maxX - state.grid.activeBounds.minX + 1}x${
          state.grid.activeBounds.maxY - state.grid.activeBounds.minY + 1
        }`,
      ),
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

    this.elements.preview.innerHTML = this.renderPreview(options);

    this.elements.log.innerHTML = "";
    for (const line of state.log) {
      const item = document.createElement("li");
      item.textContent = line;
      this.elements.log.appendChild(item);
    }
  }

  private renderResourcePills(resources: Resources): string {
    return RESOURCE_KEYS.map((key) => {
      return [
        `<article class="resource-pill resource-pill--${key}">`,
        `<span class="resource-name">${capitalize(key)}</span>`,
        `<strong class="resource-value">${resources[key]}</strong>`,
        "</article>",
      ].join("");
    }).join("");
  }

  private renderPreview(options: HudRenderOptions): string {
    if (options.selectedCardIndex === null || !options.selectedCardName) {
      return `<p class="small-text">Select a card to view placement preview.</p>`;
    }

    if (!options.placementPreview) {
      return `<p class="small-text">Move the cursor over an unlocked tile for details.</p>`;
    }

    const preview = options.placementPreview;
    const reason = preview.reason ? `<p class="preview-reason">${blockReasonLabel(preview.reason)}</p>` : "";

    return [
      `<p class="preview-heading">Card ${options.selectedCardIndex + 1}: ${options.selectedCardName}</p>`,
      `<p class="preview-meta">Tile (${preview.x}, ${preview.y}) | ${preview.canPlace ? "Placeable" : "Blocked"}</p>`,
      `<div class="preview-grid">`,
      this.previewDelta("Gold", preview.immediateDelta.gold),
      this.previewDelta("Population", preview.immediateDelta.population),
      this.previewDelta("Happiness", preview.immediateDelta.happiness),
      this.previewDelta("Pollution", preview.immediateDelta.pollution),
      `</div>`,
      reason,
    ].join("");
  }

  private previewDelta(label: string, value: number): string {
    const signed = formatResourceDelta(value);
    const cls = value > 0 ? "preview-value positive" : value < 0 ? "preview-value negative" : "preview-value";
    return `<span class="preview-label">${label}</span><span class="${cls}">${signed}</span>`;
  }

  private kv(label: string, value: string): string {
    const cls = value.startsWith("+") ? "value positive" : value.startsWith("-") ? "value negative" : "value";
    return `<span class="label">${label}</span><span class="${cls}">${value}</span>`;
  }
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function blockReasonLabel(reason: PlacementBlockReason): string {
  if (reason === "insufficient_gold") {
    return "Need more gold before placing this card.";
  }
  if (reason === "occupied") {
    return "Tile is occupied.";
  }
  if (reason === "locked") {
    return "Tile is locked. Expand city bounds with Infrastructure cards.";
  }
  if (reason === "out_of_bounds") {
    return "Select a tile inside the city grid.";
  }
  return "Select a card before placing.";
}
