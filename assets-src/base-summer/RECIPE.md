# base-summer

The summer base: carved sandstone with shells and sea glass set into it, and the sand on its ledge.

    npm run make -- base-summer        (about 30 s; then npm run texpack, npm run build)

Everything is made by script from numbers measured in `references/approved/summer-rest.png`; no generated picture and no
pixel of an approved image is used.

- `profile.mjs`: the turned shape (`BODY`, radius and height in mm, foot to collar; the collar and the cup are winter's), the
  list of things set into the stone (`SET`: azimuth, height, radius, kind, colour; the front ones are measured from the
  approved image, the back ones are seeded), and `relief()`: how far the stone stands out from the turned shape (soft beds
  6.4 mm apart, fine ridges 2.3 mm apart, broad swells, a groove above the foot, small pits, a seat pressed in under every shell and glass).
- `measure.mjs`: the 34 picks (shells and sea glass, in pixels of the approved crop 820,960 to 2000,1480) solved through the
  summer camera onto the turned shape; writes `set.json`, which `profile.mjs` reads. Run it by hand only when a pick changes:
  `node assets-src/base-summer/measure.mjs`. `npm run make` does not run it and needs no approved image.
- `field.mjs`: the relief as a grid of 4096 by 768 (the front 200 degrees take 78 in 100 of the columns).
- `mesh.mjs`: `stone` (the displaced shape, the dark seat under the glass, the cup), `shells` (scallops and cockles as ribbed
  fans, snails as a coiled tube, olives and pearls as domes; colour in the vertices, fold shade and gloss in the second uv),
  `seaglass` (tumbled pebbles; thinness and frost in the second uv), `sand` (the bank against the glass thinning to the lip,
  and the drape that runs down the wall under the spill; thickness in the red of the vertex colour).
- `maps.mjs`: `base-carve` (the relief finer than the mesh as a normal, the cavity in blue), `base-stone` (the colour, bed by
  bed, with the rust above the foot), `base-grain` (the stone's grain, tiling, 512), `base-sand` (single grains as domes, each with
  its number in blue, tiling, 512: a thin layer is cut grain by grain against it).
- `build.mjs`: writes `assets-full/summer/base-summer.glb` and the four maps. `build.mjs mesh` or `build.mjs maps` makes one half.

The sand on the slab and the grains that move are made in code (`src/seasons/summer/slab.ts`, `arrival.ts`) from the same
sand tile; there is no `slab-summer` folder. The four maps are written with their rows flipped (`up()` in `maps.mjs`), as
winter's are, so that they sit the right way up on the mesh.

## assets-full/summer/base-summer.glb
Made by: assets-src/base-summer/build.mjs (the half `mesh`)
From: assets-src/base-summer/profile.mjs, assets-src/base-summer/set.json, assets-src/base-summer/field.mjs, assets-src/base-summer/mesh.mjs, assets-src/base-summer/lib.mjs, config/showcase.json
Prompt or command: npm run make -- base-summer
Takes: built, not generated
Why this one: four meshes, `stone`, `shells`, `seaglass` and `sand`, as the list above describes them; every shape comes from numbers measured in the approved image through the summer camera, none from a generated picture.
Date: 2026-11-25

## assets-full/summer/base-carve.lin.w2048.png, assets-full/summer/base-stone.srgb.w2048.png, assets-full/summer/base-grain.lin.tile.w512.png, assets-full/summer/base-sand.lin.tile.w512.png
Made by: assets-src/base-summer/build.mjs (the half `maps`), which runs assets-src/base-summer/maps.mjs
From: assets-src/base-summer/profile.mjs, assets-src/base-summer/field.mjs, assets-src/base-summer/lib.mjs
Prompt or command: npm run make -- base-summer
Takes: built, not generated
Why this one: `base-carve` is the relief finer than the mesh as a normal with the cavity in blue, `base-stone` the colour bed by bed with the rust above the foot, `base-grain` the stone's tiling grain, `base-sand` the single grains as domes with each grain's number in blue; all four are computed, with their rows flipped as winter's are.
Date: 2026-11-25
