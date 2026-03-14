import type { Resources } from "../game/types";

export type CardCategory =
  | "Residential"
  | "Industry"
  | "Services"
  | "Infrastructure"
  | "Culture";

export interface AdjacencyRule {
  neighborCardId?: string;
  neighborCategory?: CardCategory;
  effect: Partial<Resources>;
}

export interface CardDefinition {
  id: string;
  name: string;
  category: CardCategory;
  cost: number;
  baseYield: Resources;
  upkeep?: Partial<Resources>;
  adjacencyRules: AdjacencyRule[];
}
