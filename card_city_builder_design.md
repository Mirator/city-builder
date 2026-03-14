# Card City Builder
Target Design for the Next Strategy Prototype

## 1. Current Prototype Snapshot

The current game is already beyond the original minimal prototype.

Implemented today:
- 12 building cards across Residential, Industry, Services, Infrastructure, and Culture
- 4 tracked resources: Gold, Population, Happiness, Pollution
- 10x10 maximum map with a 4x4 starting city and infrastructure-based ring expansion
- 4 cards drawn per turn, up to 2 placements per turn
- adjacency-based card synergies
- recurring city events with deterministic seeds
- autosave and resume in local storage
- balance-report simulation tooling and automated tests

Current technical shape:

```text
src/
  cards/
  events/
  game/
  systems/
  ui/
  world/
```

The live prototype is a web-first TypeScript + Vite + Canvas 2D game. This document is a target-design reference for the next balancing pass, not a frozen description of the current code.

## 2. Known Balance Problems

The prototype has strong readability, but it is too easy to solve through raw growth.

Why it was too easy before this pass:
- starting economy was too generous
- card choice density per turn was too high
- pollution pressure mostly reduced happiness and was easy to absorb
- victory only cared about population, so players could ignore civic health
- large residential cards snowballed faster than support systems could matter
- expansion was pure upside instead of a strategic commitment

Design takeaway:
- keep the fast two-placement rhythm
- make each placement carry sharper opportunity cost
- require a city that is balanced, not merely large

## 3. Next-Milestone Design

### Core Run Shape

Loop:
1. Draw 4 cards
2. Place up to 2 cards
3. Resolve base yield, adjacency, upkeep, and modifiers
4. Apply pollution-band penalties
5. Trigger a state-aware event on cadence turns
6. Check win/loss state
7. Start next turn

Target run feel:
- still quick to read
- harder to brute-force
- more dependent on layout, upkeep planning, and pollution control

### Economy and Resources

Resources:
- Gold: placement and expansion tempo
- Population: growth target
- Happiness: civic stability and victory gate
- Pollution: long-term pressure and hard fail risk

Economy rules:
- start with 12 gold, 30 population, 60 happiness, 0 pollution
- services, culture, and dense residential cards can include upkeep
- pollution uses 10-point bands
- early pollution bands hurt happiness
- higher pollution bands also drain gold
- pollution 50 or higher is an immediate loss

### Card Philosophy

Cards should create role identity instead of flat efficiency.

Residential:
- Houses are efficient early growth
- Apartments and High Rises give stronger population, but demand support through upkeep and civic services

Industry:
- Factories and Power Plants are the main money engines
- they also create the strongest pollution and residential tension

Services and Culture:
- Parks, Schools, Markets, and Cultural Centers are not optional garnish
- they stabilize happiness, improve neighborhoods, and unlock sustainable victory

Infrastructure:
- expansion still happens every second infrastructure placement
- each successful expansion costs 3 gold
- infrastructure should feel like tempo investment, not free scaling

### Victory and Loss

Loss conditions:
- Gold < 0
- Happiness <= 0
- Pollution >= 50
- Population below 50 by turn 10

Victory requires sustaining all of the following for 3 consecutive turns:
- Population >= 600
- Happiness >= 45
- Pollution <= 25
- Gold >= 0

This should block population-only rushing and force players to stabilize the city before closing a run.

### Events

Events should reinforce city identity instead of acting like flat random swings.

Event rules:
- trigger every 3 turns
- each event has a `minTurn`
- each event has weighted tags tied to city state
- industry-heavy cities see more labor and smog pressure
- service/culture-heavy cities are more likely to receive stability and recovery events
- event payloads scale by turn band: turns 1-5, 6-10, and 11+

### Balance Workflow

Balancing should stay simulation-driven.

Required workflow:
- keep deterministic seeds visible in the HUD
- keep the built-in batch simulation report
- use automated tests for upkeep, expansion cost, pollution bands, structured victory, and event weighting/scaling
- monitor autoplay win rate over 100 seeds and keep it at or below 50%

## 4. Implementation Notes

Important shared interfaces:
- `GameConfig.victoryRequirements`
- `GameConfig.pollutionLossThreshold`
- `GameConfig.expansionGoldCost`
- `CardDefinition.upkeep`
- `EventDefinition.weightTags`
- `EventDefinition.minTurn`

The next milestone should continue using the current TypeScript/Vite/Canvas architecture. No desktop packaging work is in scope for this design pass.
