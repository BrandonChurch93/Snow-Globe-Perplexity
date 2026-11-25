# Fall on the tree: recipes

What fall grows on the shared trunk: crooked bare boughs, twigs and spikes with real thickness, and small ember lights in sockets along them. The limbs they grow from come from `src/miniature/trunk.ts`. No generated picture and no photograph is used. The bark is the shared `shared/trunk-bark` tile.

## assets-full/fall/tree-fall.glb
Made by: `assets-src/tree-fall/build.mjs` with `assets-src/trunk/source.mjs` (three 0.187 in Node, `tools/lib/glb.mjs`)
From: `src/miniature/trunk.ts` and the seeded stream `tree-fall` of `src/core/rng.ts`
Prompt or command: `npm run make -- tree-fall`, after `npm run make -- trunk`. Meshes: `twigs` (tubes that kink at every joint, taper to a point and carry the bark uv of the trunk; `extras.chains` holds the boughs for the distance field) and `lights` (each ember a bulb in a dark cap on a short stalk; alpha of the vertex colour is 1 on the lit bulb; `extras.bulbs` holds place and phase). Also the ridged sleeve over the trunk and the thick sleeves over the limbs. Each primitive carries its own lighter index lists for medium and low (`addLevels` of `tools/lib/glblevels.mjs`, error 0.12 and 0.3). Everything is kept 3.2 mm inside the glass. The record is `out/work/tree-fall/build.json`.
Takes: rebuilt each time the script changed, the last build kept
Why this one: twigs are solids that catch the light of the embers beside them, never cards
Date: 2026-11-25
