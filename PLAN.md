# Gridgang Plan

Gridgang is a Phaser-powered web game about precision cargo handling in the Grid Gang docks. The MVP is a Tetris-like container packing game: shaped cargo enters on a conveyor at the top, the player selects a shape, drops it into a personal cargo bay, and the run ends when the bay stacks to the top.

Source lore and iconography:
- Lore page: https://compendium.fringedrifters.com/iconography/50
- Source icon image: https://compendium.fringedrifters.com/storage/cgq5FobMbPUYUqtme4IiXap3MkPyw7Dp1JpA4GSk.png
- Local icon asset: `public/assets/grid-gang-icon.png`
- Local favicon candidate: `public/favicon.png`

## Milestone 0: Project Spine

- [x] Capture project plan, stack notes, and human README.
- [x] Add the Grid Gang icon source asset locally.
- [ ] Scaffold Vite app.
- [ ] Add Phaser runtime dependency.
- [ ] Add Cloudflare Workers deployment tooling.
- [ ] Establish basic scripts: `dev`, `build`, `preview`, and deployment script.
- [ ] Add a minimal lint/typecheck/test baseline once the app exists.

## Milestone 1: Playable Prototype

- [ ] Create the Phaser game boot scene and fixed-size game world.
- [ ] Render the upper conveyor lane and lower player cargo bay.
- [ ] Define a small set of plain-color polyomino cargo shapes.
- [ ] Spawn cargo shapes on the conveyor and move them left-to-right.
- [ ] Allow the player to select one available conveyor shape.
- [ ] Drop the selected shape into the cargo bay with gravity.
- [ ] Lock dropped shapes into the bay grid when they collide with floor or settled cargo.
- [ ] End the run when cargo reaches the top of the bay.
- [ ] Show current score and final run score.

## Milestone 2: Game Feel

- [ ] Add keyboard and pointer input parity.
- [ ] Add shape preview and valid/invalid drop feedback.
- [ ] Tune conveyor speed, spawn cadence, gravity, and lock delay.
- [ ] Add cassette/retro-futurist visual treatment with restrained gritty dock UI.
- [ ] Add basic sound effects for selection, drop, lock, and game over.
- [ ] Make layout responsive without changing core grid rules.

## Milestone 3: Local Progression

- [ ] Store local high scores in `localStorage`.
- [ ] Add run history and best score display.
- [ ] Add shape-specific score values.
- [ ] Add risk/reward mechanics for awkward or rare cargo shapes.
- [ ] Add pause, restart, and seed/new-run controls.

## Milestone 4: Art Pass

- [ ] Convert plain blocks into cargo crate sprites or tiles.
- [ ] Add conveyor and cargo bay environment art.
- [ ] Add logo treatment using the Grid Gang icon.
- [ ] Generate favicon and app icons from the source icon.
- [ ] Add motion and screen effects that preserve readability.

## Milestone 5: Deployment

- [ ] Build static client output through Vite.
- [ ] Deploy through Cloudflare Workers.
- [ ] Configure worker static assets.
- [ ] Add environment-specific deploy config and project name.
- [ ] Document production deploy steps.
- [ ] Add a smoke check for the deployed game URL.

## Future Server Milestone

- [ ] Add a Cloudflare Worker API for shared leaderboards.
- [ ] Add durable score storage, likely D1 or another Cloudflare-native store after requirements are clearer.
- [ ] Add basic anti-abuse checks for submitted scores.
- [ ] Keep local-only scoring as the offline fallback.
