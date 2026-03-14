import type { EventDefinition } from "../events/Event";
import type { GameConfig, GameState } from "../game/types";
import { addResources, clampPollution } from "../utils/resource";
import type { Rng } from "../utils/rng";
import { buildDeck, drawCards } from "./DeckSystem";

export function buildEventDeck(eventIds: string[]): string[] {
  return buildDeck(eventIds, 1);
}

export function shouldTriggerEvent(turn: number, config: GameConfig): boolean {
  return turn > 0 && turn % config.eventCadenceTurns === 0;
}

function drawEventId(state: GameState, rng: Rng): string | null {
  const eventDeckState = {
    deck: [...state.eventDeck],
    discard: [...state.eventDiscard],
  };
  const drawn = drawCards(eventDeckState, 1, rng);
  state.eventDeck = eventDeckState.deck;
  state.eventDiscard = eventDeckState.discard;
  if (drawn.length === 0) {
    return null;
  }
  const eventId = drawn[0];
  state.eventDiscard.push(eventId);
  return eventId;
}

export function triggerEvent(
  state: GameState,
  eventDatabase: Record<string, EventDefinition>,
  rng: Rng,
): EventDefinition | null {
  const eventId = drawEventId(state, rng);
  if (!eventId) {
    return null;
  }

  const event = eventDatabase[eventId];
  if (!event) {
    return null;
  }

  state.lastEventName = event.name;
  if (event.effectType === "immediate") {
    state.resources = clampPollution(addResources(state.resources, event.payload));
  } else {
    state.activeModifiers.push({
      id: event.id,
      name: event.name,
      effect: event.payload,
      remainingTurns: event.durationTurns ?? 1,
    });
  }

  state.log.unshift(`Event: ${event.name} (${event.description})`);
  state.log = state.log.slice(0, 10);

  return event;
}
