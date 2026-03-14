import type { Resources } from "../game/types";

export const RESOURCE_KEYS: Array<keyof Resources> = [
  "gold",
  "population",
  "happiness",
  "pollution",
];

export function zeroResources(): Resources {
  return {
    gold: 0,
    population: 0,
    happiness: 0,
    pollution: 0,
  };
}

export function addResources(
  base: Resources,
  delta: Partial<Resources>,
): Resources {
  return {
    gold: base.gold + (delta.gold ?? 0),
    population: base.population + (delta.population ?? 0),
    happiness: base.happiness + (delta.happiness ?? 0),
    pollution: base.pollution + (delta.pollution ?? 0),
  };
}

export function addManyResources(values: Array<Partial<Resources>>): Resources {
  const result = zeroResources();
  for (const value of values) {
    result.gold += value.gold ?? 0;
    result.population += value.population ?? 0;
    result.happiness += value.happiness ?? 0;
    result.pollution += value.pollution ?? 0;
  }
  return result;
}

export function clampPollution(resources: Resources): Resources {
  return {
    ...resources,
    pollution: Math.max(0, resources.pollution),
  };
}

export function formatResourceDelta(value: number): string {
  if (value > 0) {
    return `+${value}`;
  }
  return `${value}`;
}
