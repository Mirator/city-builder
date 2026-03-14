import type { Rng } from "../utils/rng";
import { shuffleWithRng } from "../utils/rng";

export interface DeckState {
  deck: string[];
  discard: string[];
}

export function buildDeck(cardIds: string[], copiesPerCard: number): string[] {
  const deck: string[] = [];
  for (const cardId of cardIds) {
    for (let i = 0; i < copiesPerCard; i += 1) {
      deck.push(cardId);
    }
  }
  return deck;
}

function refillDeckFromDiscard(deckState: DeckState, rng: Rng): void {
  if (deckState.deck.length > 0 || deckState.discard.length === 0) {
    return;
  }
  deckState.deck = shuffleWithRng(deckState.discard, rng);
  deckState.discard = [];
}

export function drawCards(deckState: DeckState, count: number, rng: Rng): string[] {
  const drawn: string[] = [];
  while (drawn.length < count) {
    refillDeckFromDiscard(deckState, rng);
    if (deckState.deck.length === 0) {
      break;
    }
    const cardId = deckState.deck.pop();
    if (!cardId) {
      break;
    }
    drawn.push(cardId);
  }
  return drawn;
}

export function discardCards(deckState: DeckState, cards: string[]): void {
  if (cards.length === 0) {
    return;
  }
  deckState.discard.push(...cards);
}
