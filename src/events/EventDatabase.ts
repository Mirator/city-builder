import type { EventDefinition } from "./Event";

export const EVENT_DEFINITIONS: EventDefinition[] = [
  {
    id: "tax_windfall",
    name: "Tax Windfall",
    description: "Unexpected tax surplus boosts the treasury.",
    effectType: "immediate",
    payload: { gold: 8 },
  },
  {
    id: "civic_festival",
    name: "Civic Festival",
    description: "Public celebrations increase city morale.",
    effectType: "immediate",
    payload: { happiness: 8 },
  },
  {
    id: "labor_strike",
    name: "Labor Strike",
    description: "Industrial disruption hurts city revenue.",
    effectType: "immediate",
    payload: { gold: -7 },
  },
  {
    id: "smog_alert",
    name: "Smog Alert",
    description: "Air quality decline increases pollution and stress.",
    effectType: "immediate",
    payload: { pollution: 10, happiness: -2 },
  },
  {
    id: "housing_grant",
    name: "Housing Grant",
    description: "Temporary grants accelerate growth next turn.",
    effectType: "turnModifier",
    payload: { population: 4 },
    durationTurns: 1,
  },
  {
    id: "market_boom",
    name: "Market Boom",
    description: "Business confidence raises next turn income.",
    effectType: "turnModifier",
    payload: { gold: 5 },
    durationTurns: 1,
  },
  {
    id: "maintenance_shutdown",
    name: "Maintenance Shutdown",
    description: "Infrastructure maintenance lowers next turn yields.",
    effectType: "turnModifier",
    payload: { gold: -4, happiness: -1 },
    durationTurns: 1,
  },
  {
    id: "cleanup_grant",
    name: "Cleanup Grant",
    description: "Regional funds reduce accumulated pollution.",
    effectType: "immediate",
    payload: { pollution: -8 },
  },
];

export const EVENT_DATABASE: Record<string, EventDefinition> = Object.fromEntries(
  EVENT_DEFINITIONS.map((event) => [event.id, event]),
) as Record<string, EventDefinition>;
