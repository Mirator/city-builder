# Card City Builder

Web-first 2D card-based city-builder prototype built with TypeScript, Vite, Canvas 2D, and Vitest.

## Scripts

- `npm install`
- `npm run dev`
- `npm run test`
- `npm run build`

## Gameplay Rules (Implemented)

- Draw 5 cards each turn, place up to 2, discard unplayed cards.
- Start on a 4x4 active grid, expand by one ring after every 2 Infrastructure placements (up to 10x10).
- Resources: Gold, Population, Happiness, Pollution.
- Events trigger every 3 turns from a structured event deck.
- Runs auto-save to local storage and resume on reload.
- New Run can be started from the header button or game-over panel.
- HUD shows run seed for reproducible playtests.
- Win: Population >= 1000.
- Lose: Gold < 0, Happiness <= 0, or Population < 50 after turn 10.
