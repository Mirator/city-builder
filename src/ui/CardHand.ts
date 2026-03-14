import type { CardDefinition } from "../cards/Card";

export class CardHand {
  private readonly root: HTMLElement;
  private readonly onSelect: (index: number) => void;

  constructor(root: HTMLElement, onSelect: (index: number) => void) {
    this.root = root;
    this.onSelect = onSelect;
  }

  public render(
    hand: string[],
    selectedIndex: number | null,
    cardDatabase: Record<string, CardDefinition>,
    currentGold: number,
    slotCount: number,
  ): void {
    this.root.innerHTML = "";
    for (let index = 0; index < slotCount; index += 1) {
      const cardId = hand[index];
      if (!cardId) {
        const empty = document.createElement("button");
        empty.className = "hand-card hand-card--empty";
        empty.disabled = true;
        empty.textContent = `${index + 1}. Empty slot`;
        this.root.appendChild(empty);
        continue;
      }

      const card = cardDatabase[cardId];
      const button = document.createElement("button");
      button.className = "hand-card";
      button.setAttribute("aria-pressed", selectedIndex === index ? "true" : "false");
      if (selectedIndex === index) {
        button.classList.add("selected");
      }

      const adjacencySummary = summarizeAdjacency(card, cardDatabase);
      const affordable = currentGold >= card.cost;
      const upkeepSummary = card.upkeep?.gold ? ` | Upkeep ${formatSigned(card.upkeep.gold)}` : "";
      button.innerHTML = [
        `<div class="hand-card-top">`,
        `<strong>${index + 1}. ${card.name}</strong>`,
        `<span class="cost-badge">Cost ${card.cost}</span>`,
        `</div>`,
        `<div class="card-badges">`,
        `<span class="category-pill category-pill--${card.category.toLowerCase()}">${card.category}</span>`,
        `</div>`,
        `<div class="meta">Yield G ${formatSigned(card.baseYield.gold)} | P ${formatSigned(card.baseYield.population)} | H ${formatSigned(card.baseYield.happiness)} | Pol ${formatSigned(card.baseYield.pollution)}${upkeepSummary}</div>`,
        `<div class="meta">${adjacencySummary}</div>`,
        affordable ? "" : `<div class="cost-warning">Need more gold</div>`,
      ].join("");

      if (!affordable) {
        button.disabled = true;
      } else {
        button.addEventListener("click", () => this.onSelect(index));
      }

      this.root.appendChild(button);
    }
  }
}

function summarizeAdjacency(card: CardDefinition, cardDatabase: Record<string, CardDefinition>): string {
  if (card.adjacencyRules.length === 0) {
    return "Adjacency: none";
  }

  const summaries = card.adjacencyRules.slice(0, 2).map((rule) => {
    const target = rule.neighborCardId
      ? cardDatabase[rule.neighborCardId]?.name ?? rule.neighborCardId
      : rule.neighborCategory ?? "Any";
    const effect = formatEffect(rule.effect);
    return `${target} ${effect}`;
  });
  const overflow = card.adjacencyRules.length > 2 ? ` (+${card.adjacencyRules.length - 2} more)` : "";
  return `Adjacency: ${summaries.join(" | ")}${overflow}`;
}

function formatEffect(effect: Partial<Record<"gold" | "population" | "happiness" | "pollution", number>>): string {
  const parts = Object.entries(effect)
    .filter((entry): entry is [string, number] => typeof entry[1] === "number")
    .map(([resource, amount]) => `${formatSigned(amount)} ${resource}`);
  return parts.join(", ");
}

function formatSigned(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`;
}
