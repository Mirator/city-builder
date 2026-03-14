import type { CardCategory, CardDefinition } from "../cards/Card";
import type { EventDefinition, EventResolutionSummary, EventWeightTag } from "../events/Event";
import type { GameConfig, GameState, Resources } from "../game/types";
import { addResources, clampPollution, formatResourceDelta, zeroResources } from "../utils/resource";
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
): EventResolutionSummary | null {
  const eventId = drawEventId(state, eventDatabase, cardDatabase, rng);
  if (!eventId) {
    state.lastEventName = null;
    state.lastEventSummary = null;
    return null;
  }

  const event = eventDatabase[eventId];
  if (!event) {
    state.lastEventName = null;
    state.lastEventSummary = null;
    return null;
  }

  const payload = scalePayloadForTurn(event.payload, state.turn);
  let immediateDelta = zeroResources();
  let queuedModifier: EventResolutionSummary["queuedModifier"] = null;
  if (event.effectType === "immediate") {
    const before = { ...state.resources };
    const after = clampPollution(addResources(state.resources, payload));
    state.resources = after;
    immediateDelta = diffResources(before, after);
  } else {
    const effect = materializeResources(payload);
    const remainingTurns = event.durationTurns ?? 1;
    state.activeModifiers.push({
      id: event.id,
      name: event.name,
      effect,
      remainingTurns,
    });
    queuedModifier = {
      effect,
      remainingTurns,
    };
  }

  const summary: EventResolutionSummary = {
    id: event.id,
    name: event.name,
    description: event.description,
    effectType: event.effectType,
    triggeredOnTurn: state.turn,
    immediateDelta,
    queuedModifier,
  };

  state.lastEventName = summary.name;
  state.lastEventSummary = summary;
  state.log.unshift(formatEventLog(summary));
  state.log = state.log.slice(0, 10);

  return summary;
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

function materializeResources(payload: Partial<Resources>): Resources {
  return {
    gold: payload.gold ?? 0,
    population: payload.population ?? 0,
    happiness: payload.happiness ?? 0,
    pollution: payload.pollution ?? 0,
  };
}

function diffResources(before: Resources, after: Resources): Resources {
  return {
    gold: after.gold - before.gold,
    population: after.population - before.population,
    happiness: after.happiness - before.happiness,
    pollution: after.pollution - before.pollution,
  };
}

function formatEventLog(summary: EventResolutionSummary): string {
  const parts = [`Event: ${summary.name}.`, summary.description];
  const immediate = formatResourceList(summary.immediateDelta, false);
  if (immediate) {
    parts.push(`Impact: ${immediate}.`);
  } else {
    parts.push("Impact: no immediate change.");
  }

  if (summary.queuedModifier) {
    parts.push(
      `Next turn: ${formatResourceList(summary.queuedModifier.effect, false)} (${formatTurnCount(summary.queuedModifier.remainingTurns)}).`,
    );
  }

  return parts.join(" ");
}

function formatResourceList(resources: Resources, compact: boolean): string | null {
  const entries: string[] = [];
  if (resources.gold !== 0) {
    entries.push(`${resourceLabel("gold", compact)} ${formatResourceDelta(resources.gold)}`);
  }
  if (resources.population !== 0) {
    entries.push(`${resourceLabel("population", compact)} ${formatResourceDelta(resources.population)}`);
  }
  if (resources.happiness !== 0) {
    entries.push(`${resourceLabel("happiness", compact)} ${formatResourceDelta(resources.happiness)}`);
  }
  if (resources.pollution !== 0) {
    entries.push(`${resourceLabel("pollution", compact)} ${formatResourceDelta(resources.pollution)}`);
  }
  return entries.length > 0 ? entries.join(", ") : null;
}

function resourceLabel(key: keyof Resources, compact: boolean): string {
  if (compact) {
    if (key === "population") {
      return "Pop";
    }
    if (key === "happiness") {
      return "Happ";
    }
    if (key === "pollution") {
      return "Poll";
    }
  }

  if (key === "gold") {
    return "Gold";
  }
  if (key === "population") {
    return "Population";
  }
  if (key === "happiness") {
    return "Happiness";
  }
  return "Pollution";
}

function formatTurnCount(turns: number): string {
  return turns === 1 ? "1 turn" : `${turns} turns`;
}
