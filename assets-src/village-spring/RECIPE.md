# Recipes: the village in spring (cover, growth, pond)

Everything here is made by code alone from the numbers in `src/scene/layout.ts` and the shared village model. Nothing is a generated picture and no pixel of an approved image is used. The shared shapes (cottage, lamppost, fence, path, pond outline) come from `assets-src/village/` and are not changed.

Order: `npm run make -- village` (shared), then `npm run make -- village-spring`, then `npm run texpack && npm run build`.

## assets-full/spring/village-spring.glb
Made by: `assets-src/village-spring/build.mjs` with `assets-src/village/kit.mjs` and `assets-src/village/layout.mjs` (Node 20, three.js from the repo's `node_modules`), fixed seed `rng(5171)`, no random source outside the seeded one
From: `src/scene/layout.ts` (ground, pond, fence, path, tree foot, lamp), the roof shape of the shared model, the constants `GROUND`, `SKIRT`, `TONE`, `BEDS`, `MOUNDS`, `BLADES`, `LEVEL`, `TURF_LEVEL` in `build.mjs`; `levels.mjs` (same folder) writes the lighter index lists for `medium` and `low` into the glb, the lawn's own lists come from `meshoptimizer`
Prompt or command: `npm run make -- village-spring`
Takes: no generated picture
Why this one: three meshes. `turf` is the grass skin of the island (a radial net that dips to the pond bed, lifts at the walls, the tree foot and the rim, and rolls down the glass as a lumpy mossy skirt) plus the moss on the roof (a distance field netted at 0.2 mm, thick on the ridge, in patches on the slates and along the eaves). `growth` is every blade, leaf and flower as real geometry: grass tufts, shrub and ivy leaves with five petal blooms, tulips in four beds with cupped heads and long leaves, daisies, and fallen petals on the grass and the water. `water` is the thawed pond as rings from the middle so the ripples have vertices to move. The record `out/work/village/build-spring.json` holds the counts and the highest point of the ground
Date: 2026-11-25

## assets-full/spring/village-turf.lin.tile.png
Made by: `assets-src/village-spring/build.mjs`, the same run
From: seeded noise only
Prompt or command: `npm run make -- village-spring`
Takes: no generated picture
Why this one: one tile of 1024 px over 12 mm that repeats without a seam; red is the sprig grain of moss and short grass, green is a broad tone, blue is the cushions. The shader reads it on three axes at two scales for tone and relief
Date: 2026-11-25

## assets-full/spring/village-water.lin.tile.png
Made by: `assets-src/village-spring/build.mjs`, the same run
From: seeded noise only
Prompt or command: `npm run make -- village-spring`
Takes: no generated picture
Why this one: three seamless noise fields in one tile of 512 px over 12 mm; the pond's shader slides two of them against each other for the small chop under the spreading rings
Date: 2026-11-25
