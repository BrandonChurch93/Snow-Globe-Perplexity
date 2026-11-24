# tree_builder · branch `agent/p3-tree`

Also read, every line: `kit/02-SUBJECT.md` sections 2, 3 (Winter) and 6 ("The arrival"); `kit/03-METHOD.md` sections 1, 4, 9, 11 and 16; in `kit/04-LOOK.md` section 2 and the ladder steps "The miniature looks like a low detail model" and "The small lights do not glow"; in `kit/07-QUALITY-BAR.md` the measures M2, M3 and M6 and the critic R3; open item 19 in `kit/PROGRESS.md`.

You own: `src/miniature/trunk.ts`, `src/seasons/winter/mini/tree.ts`, `assets-src/trunk/` and `assets-src/tree-winter/`, files named `assets-full/shared/trunk-*` and `assets-full/winter/tree-*`.

Goal: the tree, the tallest thing in the globe, as a hand-made model that holds up from the `macro` camera. The parts are `miniature-winter` and `light-winter`, shared with the village's builder.

What the approved image shows, right of centre:

- A dark twisting trunk with spreading roots, with bark that has depth.
- A winter crown of layered boughs, each a pad of many small needle clusters with real depth, heavy with rounded snow on top, darker beneath.
- Tiny warm lights all through the crown that light the snow and the needles near them, and a gold star at the top that glows.
- The crown reaches about three quarters of the dome's height.

How:

- What is the same in every season goes in `src/miniature/trunk.ts` with the asset group `shared`: the trunk, the roots, the limbs, and an exported list of the places where a season hangs its crown (`pads`, each with a place, a size and a direction). Spring, summer and fall will hang blossom, leaves and bare twigs on the same limbs, and the layout's canopy emitters will follow that list. What winter adds goes in `src/seasons/winter/mini/tree.ts` with the group `winter`: the needles, the snow on the boughs, the lights, the star.
- Geometry by script with real thickness. A crown is many small clusters, never one shape with a picture on it. The approved image may be projected through the lens onto what faces `hero` as a starting texture, with its light and its flakes taken out; generated material sheets with the approved crop as reference for bark, needles and snow; height on every surface. `kit/03-METHOD.md` section 4 is the method and names the fallback.
- The place: the trunk's foot stands about 13 mm right of the axis in the inside frame. Measure the foot, the lean, the crown's outline and the star in the approved image with `insideRayOf`, and within your first 30 minutes send the numbers in one short message to `/root` and to `/root/village_builder`, who owns the ground and the layout. Stand the trunk on `groundAt(x, z)` from `src/scene/layout.ts` and let it reach 4 mm below, so the ground can move a little without a gap.
- The exports of `mini/tree.ts` are fixed: `innerLights`, `prepare()`, `build()`, `lights()`, `arrival()`, `solid(x, y, z)`, `update(moment)`. `solid` is the signed distance in millimetres to the trunk and to the boughs a flake can land on, negative inside, true to what is drawn within half a millimetre (M6).
- The small lights are real: each bulb and the star is an entry in `innerLights`, which feeds the light grid (another builder's engine), and a bright thing in `lights()` with the part `light-winter` that the glow picks up. Keep the count of entries modest and group bulbs that sit together; say how many.
- Snow on the boughs thickens with what has come to rest: read `stageCover` from `src/core/chunks/cover.ts`.
- `arrival()` holds what appears after a landing, as "The arrival" says for winter, driven by `moment.sinceLanding`.
- About 4 draw calls and 80000 triangles. Hashed coverage where a card has holes, so nothing shimmers. Every material `standIn: false`, with `inside: true`, `miniature: true` and `change: 'miniature'`.

Test: `npx vitest run`, `npm run determinism`, `npm run fit -- --tier draft --box 1380,330,1900,1080 --name tree`, stills from `macro`, `interior` and `hero`, the `texels` view (M2), and `npm run measure` for M2, M3 and M6 (see `tools/README.md`).

Looks: the tree beside the approved image; the crown close up; the foot and the roots; the star and the lights in the dark.
