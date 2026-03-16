# Card City Builder

Web-first 2D card-based city-builder prototype built with TypeScript, Vite, Canvas 2D, and Vitest.

## Scripts

- `npm install`
- `npm run dev`
- `npm run test`
- `npm run build`

## GitHub Pages Deployment

- This project deploys automatically with GitHub Actions from Vite build output (`dist/`).
- In repository settings, set **Pages** source to **GitHub Actions** (one-time setup).
- Live URL: `https://mirator.github.io/city-builder/`

## Gameplay Rules (Implemented)

- Draw 4 cards each turn, place up to 2, discard unplayed cards.
- Start on a 4x4 active grid, expand by one ring after every 2 Infrastructure placements, and pay 3 gold for each successful expansion (up to 10x10).
- Resources: Gold, Population, Happiness, Pollution.
- Services, culture buildings, and dense housing can apply upkeep each turn.
- Pollution escalates in 10-point bands from happiness pressure into gold pressure.
- Events trigger every 3 turns from a weighted, turn-scaled event deck.
- Runs auto-save to local storage and resume on reload.
- New Run can be started from the header button or game-over panel.
- HUD shows run seed for reproducible playtests.
- Win: Sustain Population >= 600, Happiness >= 45, Pollution <= 25, and Gold >= 0 for 3 turns.
- Lose: Gold < 0, Happiness <= 0, Pollution >= 50, or Population < 50 after turn 10.
