# village_builder · branch `agent/p3-village`

Also read, every line: `kit/02-SUBJECT.md` sections 2, 3 (Winter) and 6 ("The arrival"); `kit/03-METHOD.md` sections 1, 4, 9, 11 and 16; in `kit/04-LOOK.md` section 2 and the ladder steps "The miniature looks like a low detail model" and "The small lights do not glow"; in `kit/07-QUALITY-BAR.md` the measures M2, M3 and M6 and the critic R3; open item 19 in `kit/PROGRESS.md`.

You own: everything under `src/miniature/` except `src/miniature/trunk.ts`; `src/seasons/winter/mini/village.ts` and `src/seasons/winter/mini/palette.ts`; `src/scene/layout.ts` with `tests/layout.test.ts`; `assets-src/village/` and `assets-src/village-winter/`; files named `assets-full/shared/village-*` and `assets-full/winter/village-*`.

Goal: everything of winter's miniature except the tree, as a hand-made model a few centimetres high that holds up from the `macro` camera. The parts are `miniature-winter` and `light-winter`, shared with the tree's builder.

What the approved image shows inside the glass, left and centre:

- A stone cottage on the left, turned a little toward the viewer: single stones with relief, a thick rounded load of snow on the roof, a brick chimney with thin smoke, warm string lights along the eaves, one glowing window with glazing bars, an arched wooden door with a wreath.
- A short fence at the front left, with snow on its rails. A black lamppost near the centre with a warm lamp.
- A frozen pond at the front centre with a dull shine and the lamp's warm reflection in it. Snowy ground in soft drifts, and a deep mound of snow against the front of the glass.

How:

- What is the same in every season goes in `src/miniature/` with the asset group `shared`: the cottage with its roof, chimney, door and window, the fence, the path, the lamppost, the island's ground, the pond's outline. What winter adds goes in `src/seasons/winter/mini/village.ts` with the group `winter`: the snow on everything, the string lights, the wreath, the smoke, the ice on the pond, the mound. Spring, summer and fall will dress the same shapes, so keep the season's cover apart from the shapes.
- Geometry by script with real thickness; the approved image projected through the lens onto the faces that look at `hero` as a starting texture, with its light and its flakes taken out; generated material sheets with the approved crop as reference for the rest; height on every surface. `kit/03-METHOD.md` section 4 is the method and names the fallback.
- The layout is yours: `src/scene/layout.ts`. Keep every export's name and type (`rg -n "scene/layout" src tools tests`) and move its numbers to the approved image. Measured there so far: the cottage spans from about 29 mm to 1 mm left of the axis, the lamppost stands about 1 mm right of it, the trunk about 13 mm right (the stand-in has it at x 18). Measure again with `insideRayOf` against the ground and say your numbers. Keep `tests/layout.test.ts` true to the table in `kit/02-SUBJECT.md` section 2; where the picture and the table differ, the picture wins and you say where.
- The tree is `tree_builder`'s: the trunk with its roots, the crown, the star. Shape the ground round its foot as the picture shows and leave the trunk out. It stands on `groundAt` and reaches 4 mm below it. If you move the ground there or the tree's place by more than a millimetre, send `/root/tree_builder` one short message with the numbers.
- The exports of `mini/village.ts` are fixed: `innerLights`, `prepare()`, `build()`, `lights()`, `arrival()`, `solid(x, y, z)`, `update(moment)`. `solid` is the signed distance in millimetres to everything of yours a flake can land on, the ground included, negative inside, true to what is drawn within half a millimetre (M6).
- The small lights are real: each window, lamp and bulb is an entry in `innerLights`, which feeds the light grid (another builder's engine), and a bright thing in `lights()` with the part `light-winter` that the glow picks up. The pond mirrors the lamp.
- Snow on upward faces thickens with what has come to rest: read `stageCover` from `src/core/chunks/cover.ts` in your snow material.
- `arrival()` holds what appears after a landing, as "The arrival" says for winter, driven by `moment.sinceLanding`.
- About 6 draw calls and 90000 triangles. Every material `standIn: false`, with `inside: true`, `miniature: true` and `change: 'miniature'`.

Test: `npx vitest run`, `npm run determinism`, `npm run fit -- --tier draft --box 900,560,1520,1100 --name village`, stills from `macro`, `interior` and `hero`, the `texels` view (M2), and `npm run measure` for M2, M3 and M6 (see `tools/README.md`).

Looks: the village beside the approved image; the cottage from `macro`; the pond and the lamp; the `standins` view.
