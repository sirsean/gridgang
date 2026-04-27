# Agent Notes

This repo is for a new web game called Gridgang.

## Current State

- The repo has a TypeScript Vite scaffold with Phaser wired into a first boot scene.
- Cloudflare Workers support is configured with `@cloudflare/vite-plugin`, `wrangler.jsonc`, and a minimal Worker asset handler.
- The app builds successfully with `npm run build`.
- The original initial docs/assets were committed after `git init`; newer scaffold files may still be uncommitted.
- Local icon source asset: `public/assets/grid-gang-icon.png`
- Local favicon candidate: `public/favicon.png`

## Product Direction

Gridgang is a gritty cassette/retro-futurist 2D container-packing game. It is inspired by Tetris-like falling blocks, but the fiction is cargo work in leviathan docking lattices. The player chooses shaped containers from a top conveyor and drops them into a personal cargo bay. The run ends when the cargo bay fills to the top.

Lore anchor:
- Grid Gang iconography page: https://compendium.fringedrifters.com/iconography/50
- Source image URL: https://compendium.fringedrifters.com/storage/cgq5FobMbPUYUqtme4IiXap3MkPyw7Dp1JpA4GSk.png

Do not invent deep lore beyond what the source supports. It is fine to paraphrase the premise as dock workers moving cargo and craft through dangerous, tight docking lattices, with smuggling and corruption as part of the world texture.

## Technical Choices

- Runtime: browser game.
- Build tool: Vite.
- Language: TypeScript.
- Game engine: Phaser for 2D rendering and input.
- Deployment target: Cloudflare Workers via `@cloudflare/vite-plugin` and Wrangler.
- Persistence: server-backed shared leaderboard in D1 via Worker APIs.

Keep Phaser game code isolated from DOM UI code:

- `src/game/` for Phaser scenes, grid rules, shape definitions, and game state.
- `src/ui/` only if DOM UI becomes useful outside the canvas.
- `public/assets/` for static image/audio assets served directly by Vite.

## Gameplay Baseline

The first playable version should include:

- A top conveyor lane moving cargo shapes left-to-right.
- A lower player cargo bay represented as a grid.
- A small set of plain-color cargo polyominoes.
- Selection from conveyor shapes.
- Gravity-based dropping into the cargo bay.
- Collision against the floor and settled cargo.
- Locking once a shape lands.
- Game over when stacked cargo reaches the top.
- Local scoring.

Avoid building advanced scoring, account systems, multiplayer, or networked leaderboards until the prototype is playable.

## Visual Direction

Use simple colors for early gameplay clarity, then move toward a gritty cassette/retro-futurist dock interface. The UI should feel industrial and readable, not glossy. Favor strong silhouettes, cargo markings, scanline/noise treatment, practical control panels, and visible grid structure.

Do not let visual effects interfere with shape readability or collision clarity.

## Cloudflare Notes

The target is Cloudflare Workers, not a traditional server. Keep the MVP fully static from the client perspective. Add Worker routes only when needed for leaderboards or other server-backed features.

Production deploys are automatic: pushing to `main` triggers CI to build and deploy the Worker. You do not need to run `npx wrangler deploy` (or `npm run deploy`) manually for routine changes unless you are deliberately doing a one-off manual release or debugging deploy tooling.

Cloudflare config is currently:

- `vite.config.ts` uses `cloudflare()`.
- `wrangler.jsonc` sets `main` to `./src/worker/index.ts`.
- `assets.binding` is `ASSETS`.
- `assets.not_found_handling` is `single-page-application`.

Before changing Cloudflare-specific config later, check the current Cloudflare Workers + Vite guidance because the recommended setup can change.

## Implementation Guardrails

- Preserve the icon source attribution in docs.
- Keep the first game loop small and deterministic enough to test.
- Separate pure grid/shape rules from Phaser scene rendering where practical.
- Add focused tests around grid collision, locking, game-over detection, and scoring once those modules exist.
