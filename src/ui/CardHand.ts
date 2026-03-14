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
        empty.className = "hand-card";
        empty.disabled = true;
        empty.textContent = `${index + 1}. Empty`;
        this.root.appendChild(empty);
        continue;
      }

      const card = cardDatabase[cardId];
      const button = document.createElement("button");
      button.className = "hand-card";
      if (selectedIndex === index) {
        button.classList.add("selected");
      }
      const adjacencySummary = summarizeAdjacency(card, cardDatabase);
      button.innerHTML = [
        `<strong>${index + 1}. ${card.name}</strong>`,
        `<div class="meta">${card.category} | Cost: ${card.cost}</div>`,
        `<div class="meta">G ${card.baseYield.gold}, P ${card.baseYield.population}, H ${card.baseYield.happiness}, Pol ${card.baseYield.pollution}</div>`,
        `<div class="meta">${adjacencySummary}</div>`,
      ].join("");
      if (currentGold < card.cost) {
        button.disabled = true;
      } else {
        button.addEventListener("click", () => this.onSelect(index));
      }
      this.root.appendChild(button);
    }
  }
}

function summarizeAdjacency(
  card: CardDefinition,
  cardDatabase: Record<string, CardDefinition>,
): string {
  if (card.adjacencyRules.length === 0) {
    return "Adj: None";
  }

  const summaries = card.adjacencyRules.slice(0, 2).map((rule) => {
    const target = rule.neighborCardId
      ? cardDatabase[rule.neighborCardId]?.name ?? rule.neighborCardId
      : rule.neighborCategory ?? "Any";
    const effect = formatEffect(rule.effect);
    return `${target} ${effect}`;
  });
  const overflow =
    card.adjacencyRules.length > 2 ? ` (+${card.adjacencyRules.length - 2} more)` : "";
  return `Adj: ${summaries.join(" | ")}${overflow}`;
}

function formatEffect(effect: Partial<Record<"gold" | "population" | "happiness" | "pollution", number>>): string {
  const parts = Object.entries(effect)
    .filter((entry): entry is [string, number] => typeof entry[1] === "number")
    .map(([resource, amount]) => `${amount >= 0 ? "+" : ""}${amount} ${resource}`);
  return parts.join(", ");
}
