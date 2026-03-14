import type { CardDefinition } from "./Card";

export const CARD_DEFINITIONS: CardDefinition[] = [
  {
    id: "house",
    name: "House",
    category: "Residential",
    cost: 2,
    baseYield: { gold: 0, population: 2, happiness: 1, pollution: 0 },
    adjacencyRules: [
      { neighborCategory: "Services", effect: { happiness: 1 } },
      { neighborCardId: "factory", effect: { happiness: -3 } },
      { neighborCardId: "power_plant", effect: { happiness: -2 } },
    ],
  },
  {
    id: "apartment",
    name: "Apartment",
    category: "Residential",
    cost: 3,
    baseYield: { gold: 1, population: 4, happiness: 0, pollution: 0 },
    adjacencyRules: [
      { neighborCardId: "park", effect: { happiness: 2 } },
      { neighborCardId: "school", effect: { population: 1 } },
      { neighborCardId: "factory", effect: { happiness: -3 } },
    ],
  },
  {
    id: "high_rise",
    name: "HighRise",
    category: "Residential",
    cost: 5,
    baseYield: { gold: 2, population: 8, happiness: -1, pollution: 0 },
    adjacencyRules: [
      { neighborCardId: "cultural_center", effect: { happiness: 2 } },
      { neighborCardId: "school", effect: { population: 2 } },
      { neighborCategory: "Industry", effect: { happiness: -2 } },
    ],
  },
  {
    id: "factory",
    name: "Factory",
    category: "Industry",
    cost: 4,
    baseYield: { gold: 4, population: 0, happiness: -1, pollution: 3 },
    adjacencyRules: [
      { neighborCardId: "market", effect: { gold: 2 } },
      { neighborCategory: "Residential", effect: { happiness: -3 } },
    ],
  },
  {
    id: "workshop",
    name: "Workshop",
    category: "Industry",
    cost: 3,
    baseYield: { gold: 3, population: 0, happiness: 0, pollution: 1 },
    adjacencyRules: [
      { neighborCardId: "road_hub", effect: { gold: 1 } },
      { neighborCategory: "Residential", effect: { happiness: -1 } },
    ],
  },
  {
    id: "power_plant",
    name: "PowerPlant",
    category: "Industry",
    cost: 6,
    baseYield: { gold: 6, population: 0, happiness: -2, pollution: 5 },
    adjacencyRules: [
      { neighborCategory: "Industry", effect: { gold: 2 } },
      { neighborCategory: "Residential", effect: { happiness: -2 } },
    ],
  },
  {
    id: "park",
    name: "Park",
    category: "Services",
    cost: 2,
    baseYield: { gold: 0, population: 0, happiness: 3, pollution: -1 },
    adjacencyRules: [{ neighborCategory: "Residential", effect: { happiness: 1 } }],
  },
  {
    id: "school",
    name: "School",
    category: "Services",
    cost: 4,
    baseYield: { gold: -1, population: 1, happiness: 2, pollution: 0 },
    adjacencyRules: [{ neighborCategory: "Residential", effect: { population: 2 } }],
  },
  {
    id: "market",
    name: "Market",
    category: "Services",
    cost: 4,
    baseYield: { gold: 3, population: 0, happiness: 1, pollution: 0 },
    adjacencyRules: [
      { neighborCategory: "Residential", effect: { gold: 2 } },
      { neighborCategory: "Industry", effect: { gold: 1 } },
    ],
  },
  {
    id: "road_hub",
    name: "RoadHub",
    category: "Infrastructure",
    cost: 2,
    baseYield: { gold: 1, population: 0, happiness: 0, pollution: 0 },
    adjacencyRules: [
      { neighborCategory: "Industry", effect: { gold: 1 } },
      { neighborCategory: "Services", effect: { gold: 1 } },
    ],
  },
  {
    id: "utility_node",
    name: "UtilityNode",
    category: "Infrastructure",
    cost: 3,
    baseYield: { gold: 0, population: 0, happiness: 1, pollution: -2 },
    adjacencyRules: [
      { neighborCategory: "Residential", effect: { happiness: 1 } },
      { neighborCategory: "Industry", effect: { pollution: -1 } },
    ],
  },
  {
    id: "cultural_center",
    name: "CulturalCenter",
    category: "Culture",
    cost: 5,
    baseYield: { gold: 0, population: 0, happiness: 4, pollution: 0 },
    adjacencyRules: [
      { neighborCategory: "Residential", effect: { happiness: 2 } },
      { neighborCardId: "market", effect: { gold: 1 } },
    ],
  },
];

export const CARD_DATABASE: Record<string, CardDefinition> =
  Object.fromEntries(CARD_DEFINITIONS.map((card) => [card.id, card])) as Record<
    string,
    CardDefinition
  >;
