import type { Resources } from "../game/types";

export type EventEffectType = "immediate" | "turnModifier";

export interface EventDefinition {
  id: string;
  name: string;
  description: string;
  effectType: EventEffectType;
  payload: Partial<Resources>;
  durationTurns?: number;
}
