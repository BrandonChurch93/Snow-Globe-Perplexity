# Recipes: the village's shapes, shared by all four seasons

The shapes of the cottage, the chimney, the lamppost, the fence, the steps and the stepping stones are made by code alone, from the numbers in `src/scene/layout.ts`. Nothing here is a generated picture and no pixel of an approved image is used. The season's cover (snow, ice, wreath, bulbs) is a separate part, `assets-src/village-winter/`.

## assets-full/shared/village-model.glb
Made by: `assets-src/village/build.mjs` with `assets-src/village/kit.mjs` (Node 20.20.2, three.js from the repo's `node_modules`), fixed seed, no random source outside the seeded one
From: `assets-src/village/layout.mjs`, which reads the places and sizes in `src/scene/layout.ts` (cottage, chimney, lamppost, fence, path, pond, ground); the palettes `STONES`, `ARCH`, `BRICKS`, `DOOR`, `IRON` at the top of `build.mjs`
Prompt or command: `npm run make -- village`
Takes: no generated picture. 9 builds looked at while tuning the stones (size, squareness, joints, tones)
Why this one: every wall stone, arch stone and brick is its own rounded block with a flat face, a random squareness and a tilt, laid in courses with uneven heights, so the joints have depth and no two stones match; the door is planks with strap hinges and a ring; the windows have bars, a sill and a lintel. Meshes: `solid` (drawn), `pane-gable`, `pane-side`, `lamp-glass` (drawn by the light part), `ground` (kept for measuring, not drawn)
Date: 2026-11-24

## assets-full/shared/village-grain.lin.tile.png
Made by: `assets-src/village/build.mjs`, the same run
From: seeded noise only
Prompt or command: `npm run make -- village`
Takes: no generated picture. 2 versions looked at
Why this one: one tile of 1024 px over 12 mm that repeats without a seam; red is the stone grain (height and tone), green is wood grain along the plank, blue is a slow mottle. The shader reads it twice at two scales for relief, tone and roughness, so one small picture serves stone, wood, iron and leaves
Date: 2026-11-24
