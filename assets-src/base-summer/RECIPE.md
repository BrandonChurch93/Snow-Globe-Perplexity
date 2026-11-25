# base-summer

The summer base: carved sandstone with shells and sea glass set into it, and the sand on its ledge.

    npm run make -- base-summer        (about 30 s; then npm run texpack, npm run build)

Everything is made by script from numbers measured in `references/approved/summer-rest.png`; no generated picture and no
pixel of an approved image is used.

- `profile.mjs`: the turned shape (`BODY`, radius and height in mm, foot to collar; the collar and the cup are winter's), the
  list of things set into the stone (`SET`: azimuth, height, radius, kind, colour; the front ones are measured from the
  approved image, the back ones are seeded), and `relief()`: how far the stone stands out from the turned shape (beds with a
  lip and an undercut, broad swells, a groove above the foot, small pits, a seat pressed in under every shell and glass).
- `field.mjs`: the relief as a grid of 4096 by 768 (the front 200 degrees take 78 in 100 of the columns).
- `mesh.mjs`: `stone` (the displaced shape, the dark seat under the glass, the cup), `shells` (scallops and cockles as ribbed
  fans, snails as a coiled tube, olives and pearls as domes; colour in the vertices, fold shade and gloss in the second uv),
  `seaglass` (tumbled pebbles; thinness and frost in the second uv), `sand` (the bank against the glass thinning to the lip,
  and the drape that runs down the wall under the spill; thickness in the red of the vertex colour).
- `maps.mjs`: `base-carve` (the relief finer than the mesh as a normal, the cavity in blue), `base-stone` (the colour, bed by
  bed, with the rust above the foot), `base-grain` (the stone's grain, tiling), `base-sand` (single grains as domes, each with
  its number in blue, tiling: a thin layer is cut grain by grain against it).
- `build.mjs`: writes `assets-full/summer/base-summer.glb` and the four maps. `build.mjs mesh` or `build.mjs maps` makes one half.

The sand on the slab and the grains that move are made in code (`src/seasons/summer/slab.ts`, `arrival.ts`) from the same
sand tile.
