# Gridgang

Gridgang is a planned web game about dangerous cargo handling in the Grid Gang docks. The game is Tetris-like: shaped containers move across a top conveyor, the player selects one, drops it into a personal cargo bay, and tries to pack as much cargo as possible before the bay fills to the top.

The project uses the Grid Gang lore and iconography from the Fringeling Compendium:

- Lore page: https://compendium.fringedrifters.com/iconography/50
- Source icon: https://compendium.fringedrifters.com/storage/cgq5FobMbPUYUqtme4IiXap3MkPyw7Dp1JpA4GSk.png
- Local icon asset: `public/assets/grid-gang-icon.png`
- Local favicon candidate: `public/favicon.png`

## Status

This project is in the planning/bootstrap stage. The repo currently contains docs and the source icon asset. The Vite, Phaser, and Cloudflare Workers app has not been scaffolded yet.

## Planned Stack

- Vite for the web app build.
- Phaser for 2D game rendering, scenes, and input.
- Cloudflare Workers for deployment.
- Browser `localStorage` for MVP scoring and high scores.

## Game Premise

The player works a cargo bay below an active conveyor. Containers arrive in different shapes. The player chooses a container from the conveyor and drops it into the bay, where it falls under gravity until it lands and locks into place. The score is based on the containers successfully packed. In the first version, scoring can be simple; later versions can assign different values to different container shapes.

The game ends when the stacked containers reach the top of the player cargo bay.

## Development Roadmap

See [PLAN.md](./PLAN.md) for milestones.

The immediate next step is to scaffold the Vite app, install Phaser, and wire a minimal playable prototype with plain-color cargo blocks.

## Future Direction

The MVP should stay client-only. A future server-backed milestone may add a Cloudflare Worker API for shared leaderboards while keeping local scores as an offline fallback.
