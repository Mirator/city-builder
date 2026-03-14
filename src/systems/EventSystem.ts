import type { CardCategory, CardDefinition } from "../cards/Card";
import type { EventDefinition, EventWeightTag } from "../events/Event";
import type { GameConfig, GameState, Resources } from "../game/types";
import { addResources, clampPollution } from "../utils/resource";
import type { Rng } from "../utils/rng";
import { shuffleWithRng } from "../utils/rng";
import { getPlacedCards } from "../world/Grid";
import { buildDeck } from "./DeckSystem";

interface WeightedEventCandidate {
  id: string;
  weight: number;
}

interface EventProfile {
  counts: Record<CardCategory, number>;
  gold: number;
  population: number;
  happiness: number;
  pollution: number;
}

export function buildEventDeck(eventIds: string[]): string[] {
  return buildDeck(eventIds, 1);
}

export function shouldTriggerEvent(turn: number, config: GameConfig): boolean {
  return turn > 0 && turn % config.eventCadenceTurns === 0;
}

function drawEventId(
  state: GameState,
  eventDatabase: Record<string, EventDefinition>,
  cardDatabase: Record<string, CardDefinition>,
  rng: Rng,
): string | null {
  refillEventDeck(state, rng);

  let eligible = getWeightedCandidates(state.eventDeck, state, eventDatabase, cardDatabase);
  if (eligible.length === 0 && state.eventDiscard.length > 0) {
    state.eventDeck = shuffleWithRng([...state.eventDiscard], rng);
    state.eventDiscard = [];
    eligible = getWeightedCandidates(state.eventDeck, state, eventDatabase, cardDatabase);
  }
  if (eligible.length === 0) {
    return null;
  }

  const eventId = pickWeightedEventId(eligible, rng);
  state.eventDeck = state.eventDeck.filter((id) => id !== eventId);
  state.eventDiscard.push(eventId);
  return eventId;
}

export function triggerEvent(
  state: GameState,
  eventDatabase: Record<string, EventDefinition>,
  cardDatabase: Record<string, CardDefinition>,
  rng: Rng,
): EventDefinition | null {
  const eventId = drawEventId(state, eventDatabase, cardDatabase, rng);
  if (!eventId) {
    return null;
  }

  const event = eventDatabase[eventId];
  if (!event) {
    return null;
  }

  state.lastEventName = event.name;
  const payload = scalePayloadForTurn(event.payload, state.turn);
  if (event.effectType === "immediate") {
    state.resources = clampPollution(addResources(state.resources, payload));
  } else {
    state.activeModifiers.push({
      id: event.id,
      name: event.name,
      effect: payload,
      remainingTurns: event.durationTurns ?? 1,
    });
  }

  state.log.unshift(`Event: ${event.name} (${event.description})`);
  state.log = state.log.slice(0, 10);

  return event;
}

function refillEventDeck(state: GameState, rng: Rng): void {
  if (state.eventDeck.length > 0 || state.eventDiscard.length === 0) {
    return;
  }
  state.eventDeck = shuffleWithRng([...state.eventDiscard], rng);
  state.eventDiscard = [];
}

function getWeightedCandidates(
  eventIds: string[],
  state: GameState,
  eventDatabase: Record<string, EventDefinition>,
  cardDatabase: Record<string, CardDefinition>,
): WeightedEventCandidate[] {
  const profile = buildEventProfile(state, cardDatabase);
  return eventIds
    .map((id) => {
      const event = eventDatabase[id];
      if (!event || state.turn < event.minTurn) {
        return null;
      }
      const weight = event.weightTags.reduce(
        (sum, tag) => sum + tagWeight(tag, profile),
        1,
      );
      return { id, weight: Math.max(1, weight) };
    })
    .filter((candidate): candidate is WeightedEventCandidate => candidate !== null);
}

function buildEventProfile(
  state: GameState,
  cardDatabase: Record<string, CardDefinition>,
): EventProfile {
  const counts: Record<CardCategory, number> = {
    Residential: 0,
    Industry: 0,
    Services: 0,
    Infrastructure: 0,
    Culture: 0,
  };

  for (const placed of getPlacedCards(state.grid)) {
    const card = cardDatabase[placed.cardId];
    if (!card) {
      continue;
    }
    counts[card.category] += 1;
  }

  return {
    counts,
    gold: state.resources.gold,
    population: state.resources.population,
    happiness: state.resources.happiness,
    pollution: state.resources.pollution,
  };
}

function tagWeight(tag: EventWeightTag, profile: EventProfile): number {
  if (tag === "industry") {
    return profile.counts.Industry >= 2 ? 3 + profile.counts.Industry : 0;
  }
  if (tag === "services") {
    return profile.counts.Services >= 2 ? 3 + profile.counts.Services : profile.counts.Services;
  }
  if (tag === "culture") {
    return profile.counts.Culture > 0 ? 3 + profile.counts.Culture : 0;
  }
  if (tag === "residential") {
    return profile.counts.Residential >= 2 ? 2 + Math.floor(profile.counts.Residential / 2) : 0;
  }
  if (tag === "infrastructure") {
    return profile.counts.Infrastructure >= 2 ? 2 + profile.counts.Infrastructure : profile.counts.Infrastructure;
  }
  if (tag === "growth") {
    if (profile.population >= 250) {
      return 4;
    }
    if (profile.population >= 120 || profile.counts.Residential >= 3) {
      return 2;
    }
    return 0;
  }
  if (tag === "pollution_high") {
    if (profile.pollution >= 30) {
      return 6;
    }
    if (profile.pollution >= 20) {
      return 4;
    }
    if (profile.pollution >= 10) {
      return 2;
    }
    return 0;
  }
  if (tag === "stability") {
    if (profile.happiness >= 55 && profile.pollution <= 15 && profile.gold >= 0) {
      return 4;
    }
    if (profile.happiness >= 45 && profile.pollution <= 25) {
      return 2;
    }
    return 0;
  }
  if (profile.happiness < 35) {
    return 5;
  }
  if (profile.happiness < 45) {
    return 3;
  }
  return 0;
}

function pickWeightedEventId(candidates: WeightedEventCandidate[], rng: Rng): string {
  const totalWeight = candidates.reduce((sum, candidate) => sum + candidate.weight, 0);
  let roll = rng() * totalWeight;
  for (const candidate of candidates) {
    roll -= candidate.weight;
    if (roll <= 0) {
      return candidate.id;
    }
  }
  return candidates[candidates.length - 1].id;
}

function scalePayloadForTurn(payload: Partial<Resources>, turn: number): Partial<Resources> {
  const multiplier = turn >= 11 ? 2 : turn >= 6 ? 1.5 : 1;
  return {
    gold: scaleSignedValue(payload.gold, multiplier),
    population: scaleSignedValue(payload.population, multiplier),
    happiness: scaleSignedValue(payload.happiness, multiplier),
    pollution: scaleSignedValue(payload.pollution, multiplier),
  };
}

function scaleSignedValue(value: number | undefined, multiplier: number): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  return Math.sign(value) * Math.round(Math.abs(value) * multiplier);
}
