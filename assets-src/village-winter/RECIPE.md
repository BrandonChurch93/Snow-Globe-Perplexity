# Recipes: winter's cover on the village

Winter's dress over the shared shapes: the snow on the roof, the caps, the ground and the shrubs, the pond's ice, the wreath and the shrubs' leaves, the eave bulbs and the fresh layer that rises after a landing. Made by code alone. Nothing here is a generated picture and no pixel of an approved image is used.

## assets-full/winter/village-winter.glb
Made by: `assets-src/village-winter/build.mjs` (Node 20.20.2, three.js from the repo's `node_modules`), fixed seed
From: `assets-src/village/layout.mjs` and `assets-src/village/kit.mjs` (the same places and sizes as the shared model, so the cover sits on the shapes), and the hang points of `src/miniature/roof.ts` for the bulbs
Prompt or command: `npm run make -- village-winter`
Takes: no generated picture. 7 builds looked at while tuning the roof load, the pond rim and the bulbs
Why this one: the snow is one skin grown from distance fields (roof load with dents and a rounded eave, caps on the chimney, posts, rails, steps and stones, drifts against the walls, the lamp foot and the shrubs, a bank at the pond rim), so it has thickness and soft edges everywhere and stays within half a millimetre of `solid()`. Meshes: `snow`, `ice`, `decor` (wreath, bow, shrub leaves), `bulbs` (25, with a tone and a flicker phase each), `fresh` (the arrival layer)
Date: 2026-11-24

## assets-full/winter/village-snow.lin.tile.png
Made by: `assets-src/village-winter/build.mjs`, the same run
From: seeded noise only
Prompt or command: `npm run make -- village-winter`
Takes: no generated picture. 2 versions looked at
Why this one: one seamless tile of 1024 px over 12 mm; red is the grain height, green places the sparkle, blue is the soft lumps. The shader reads it on three planes so no stretch shows on steep snow
Date: 2026-11-24

## assets-full/winter/village-ice.lin.tile.png
Made by: `assets-src/village-winter/build.mjs`, the same run
From: seeded noise only
Prompt or command: `npm run make -- village-winter`
Takes: no generated picture. 2 versions looked at
Why this one: one seamless tile; red is cracks, green is frost, blue is trapped bubbles. The shader turns it into height, roughness and the pale frost toward the rim, and the lamp, the panes and the bulbs are mirrored in it by `src/miniature/mirror.ts`
Date: 2026-11-24
