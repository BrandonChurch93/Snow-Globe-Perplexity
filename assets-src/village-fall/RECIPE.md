# Fall on the village: recipes

What fall lays over the shared village: the dark ground with its leaf litter and moss, the dark pond, two carved pumpkins, two gravestones, the attic window, loose leaves and grass tufts. The places and sizes of the pumpkins, the stones and the attic window come from `src/seasons/fall/mini/props.ts`, the ground and the pond from `assets-src/village/layout.mjs`. No generated picture and no photograph is used.

## assets-full/fall/village-earth.srgb.tile.w1024.png
Made by: `assets-src/village-fall/build.mjs` (sharp, in Node)
From: nothing but the seeded stream `village-fall` of `src/core/rng.ts`
Prompt or command: `npm run make -- village-fall`. Wrapped noise at four scales for damp soil with grit and small stones. Colour in rgb, height in alpha for the bump.
Takes: rebuilt each time the script changed, the last build kept
Why this one: dark earth with grain that holds from the macro camera at 12 mm a tile
Date: 2026-11-25

## assets-full/fall/village-litter.srgb.tile.w1024.png
Made by: `assets-src/village-fall/build.mjs`
From: nothing but the seeded stream `village-fall`
Prompt or command: `npm run make -- village-fall`. Leaf outlines of four shapes drawn one over another with a midrib and curled edges, in rust, orange, ochre and brown. Colour in rgb. Alpha is the stacking rank of the leaf at that texel and 0 where no leaf lies, so the ground shader can thin the litter leaf by leaf.
Takes: rebuilt each time the script changed, the last build kept
Why this one: single leaves with edges, never a smear of colour
Date: 2026-11-25

## assets-full/fall/village-fall.glb
Made by: `assets-src/village-fall/build.mjs` (three 0.187 in Node, `tools/lib/glb.mjs`)
From: `assets-src/village/layout.mjs`, `src/seasons/fall/mini/props.ts`, `src/scene/layout.ts`
Prompt or command: `npm run make -- village-fall`, after `npm run make -- village`. Meshes: `ground` (the island with its relief, litter and moss weights in uv1), `water` (the pond surface), `decor` (two pumpkins with ribs and faces cut through the shell, their stems, two gravestones, the frame of the attic window, loose leaves with real thickness, grass tufts, the leaning rail fence of seven posts and twelve rails from `fenceBoards()`, four craggy rocks from `ROCKS`, three door steps, the flagstone path along `PATH_LINE`, pond rim stones, pebbles; each primitive carries its own lighter index lists for medium and low, `addLevels` of `tools/lib/glblevels.mjs`, error 0.08 and 0.2), `glow` (the lit inside of each pumpkin and the rims of its cuts), `pane-attic`. The record is `out/work/village/build-fall.json`.
Takes: rebuilt each time the script changed, the last build kept
Why this one: every prop is a closed solid with a cut face, so the light inside is seen through real holes
Date: 2026-11-25
