import type { Resources } from "../game/types";

export type EventEffectType = "immediate" | "turnModifier";
export type EventWeightTag =
  | "industry"
  | "services"
  | "culture"
  | "residential"
  | "infrastructure"
  | "growth"
  | "pollution_high"
  | "stability"
  | "happiness_low";

export interface EventDefinition {
  id: string;
  name: string;
  description: string;
  effectType: EventEffectType;
  payload: Partial<Resources>;
  durationTurns?: number;
  weightTags: EventWeightTag[];
  minTurn: number;
}
