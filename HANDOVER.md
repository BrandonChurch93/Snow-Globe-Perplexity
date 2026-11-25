# spring_mini2: handover (spring miniature)

Branch `agent/p4-spring_mini2` at `823cffd`; looks on `agent/p4-spring_mini2-looks`. Everything below is in the files of this part.

## Files
- `src/seasons/spring/miniature.ts`: builds the group, calls `village.update` and `tree.update`.
- `src/seasons/spring/mini/palette.ts`: every colour of the part (`tones`): lamp, room, panes, halo, moss, water, bark, blossom, twig.
- `src/seasons/spring/mini/village.ts`: cover shaders over the shared village (stone, slate, moss, fence tint, path stone mask), the turf with its four kinds (`vSurf.x`: 0 lawn, 1 roof moss, 2 bank skirt with depth in `vSurf.y`, 3 boulders), growth, the pond, halos, small lights. `update` sets the pond clock and the light gain from `moment.time / moment.period`.
- `src/seasons/spring/mini/tree.ts`: blossom, twig and bark materials; level lists; lighter draw ranges in the shadow and mirror passes. `update` is empty.
- `assets-src/village-spring/build.mjs`: `turf`, `growth`, `water` meshes and the two tiles. `assets-src/village-spring/levels.mjs`: `addLists(file, meshName, { medium, low })` writes extra index accessors and `extras.levels` so texpack keeps them (texpack skips primitives that already carry `extras.levels`).
- `assets-src/tree-spring/build.mjs`: the crown (`blossom`, `twigs`) and the collider balls in the blossom's extras.
- `assets-src/*/RECIPE.md`: how each asset is made.

## Make
`npm run make -- village-spring`, `npm run make -- tree-spring`, `npm run texpack`, `npm run build`. After a merge of main: `git checkout -- assets-full public/assets` first, then the four again. Never commit `assets-full/` or `public/assets/`.

## Constants that carry the look
Tree (`assets-src/tree-spring/build.mjs`):
- `CROWN { centre [1.2, 28.4, 1], r [19.5, 14.8, 14.5], floor 14.2, reach 13 }` (mm, trunk space). Box of the built crown x -18.6..19.3, y 14.4..43.7, z -13.3..15.1; farthest point 35.9 mm from the globe's centre (inner glass 57). The make prints both.
- `LOBES { count 36, spacing 6.2, tall 1.3, shell [0.3, 0.96], r [3.6, 2.5, 3.6], size [0.7, 1.3], sprays 4.6, gap 2.4 }`: the boughs. Fewer and larger lobes read as blobs (23 lobes of r 4.9 did).
- `CLUSTER { step 1.75, flowers [5, 7.2], flower [0.58, 0.92], extra 0.14, core 0.36 }`, `LOBE_LOOK { round 0.7, under 0.7 }`, `SHADE [0.75, 0.68, 0.7]`.
- `palette.ts`: `blossom [1.34, 1.25, 1.4]` (measured against the approved crown: ours was 18% darker at `[1.15, 1.02, 1.17]`), `bark [1.3, 1.1, 1.02]`.
- M1 interior: the crown's top sets it. With the box top at y 44.3 the miniature's first row was 40 of 1080 (0 edge pixels); at 45.7 it was row 12. Do not raise the crown further without that check: `npm run still -- --season spring --state rest --camera interior --tier draft --format hd --force --diag ids`, miniature colour (249, 190, 16).

Village (`src/seasons/spring/mini/village.ts`, `assets-src/village-spring/build.mjs`):
- Bank: `BANK { ..., deep 0.16, lip 1.05 }`, tone falloff `smoothstep(0.04, 0.8, vSurf.y)`, skirt fill falloff `1 - 0.85 * smoothstep(0.06, 0.85, vSurf.y)`, `BANK_TINT [0.62, 0.57, 0.6]`, crest `(0.36 + 1.2 * crest)`, `MOUNDS { count 110, sizeMm [1.2, 3.3], seed 9133 }`.
- Pond: `waterDeep [0.04, 0.055, 0.055]`, `WATER_LOOK` with `room 0.45, far [0.05, 0.06, 0.035], farFrom 0.1, farTo 0.42`, ring amplitudes `1 - 0.36 * i`.
- Lights: panes `room x1.6`, `curtain x2`, `HALO_KIND.lamp.rest 0.5`, `pane.rest 0.28`.
- `FENCE_TINT [0.96, 0.8, 0.62]`, `PATH { tint [1.75, 1.58, 1.3], reachMm [1.5, 2.1], tallMm 1 }`.
- `BLADES.tufts 5450`, `LEVEL { medium 0.3, low 0.25 }` (growth), `TURF_LEVEL { medium 0.1, low 0.22 }` (lawn, meshopt error).

## Triangles
Lists high / medium / low: blossom 74,625 / 33,595 / 23,340; twigs 11,550 / 11,550 / 5,680; turf 85,691 / 30,180 / 15,117; growth 102,833 / 45,590 / 39,330; water 2,400 / 71 / 39. Sum 277,099 / 120,986 / 83,506.
Passes: the mirror pass is recognised by `mesh.matrixWorld.determinant() < 0` in `onBeforeRender`, the shadow pass by `onBeforeShadow`. Growth is skipped in the mirror at every level; turf casts no shadow; blossom and twigs are lighter in mirror and shadow below `high`.
Count with `node out/work/bin/tris.mjs spring` after `npm run build` (the script is from `/root`, untracked).

## Dead ends (do not repeat)
- Geometric lumps on the bank skirt take no key light; the turf tile on the bank reads as a grid.
- Saturated blossom tones go crimson in shade; keep the tones pale and lift `palette.blossom` instead.
- Lamp halo `rest 0.5, hot 0.4` is a blob.
- `npm run fit` draws a different picture from `npm run still`.
- 23 large boughs read as cauliflower; a flat wide crown (r `[21, 13.4, 15]`) reads as an umbrella.

## What I would do next, in order
1. Crown: let more bare twig show (longer `CROWN.reach`, fewer clusters near spray tips), and ask `spring_air2` for a warm light from behind the crown.
2. Storm: a term in the blossom material that lifts it toward a pale glow while the storm is up (pure function of `moment.sinceLanding`), then look at `landed` hero beside `spring-shake`.
3. Bank at rest: low mist over the rim (`veil.ts`, `spring_air2`).
4. Lamp: a soft pool on the lawn through the turf shader (distance to the lamp foot), not a larger halo.
5. Shared shapes (gable relief, shingle edges, fence rails, path stones, trunk girth) need `/root` or the owner of `assets-src/village` and `src/miniature/trunk.ts`.

## Messages sent to other owners
- `kinds2`: resting petal rules for roof, fence, stones and pond.
- `spring_air2`: pond petals, crown box, bank crescent in the landed still (they fixed the last in 1c19715).
- `bases2`: base rock and growth needed medium lists (done in e0ee86f).
- `/root`: M1 spring-base invalid values are not from the miniature (still 6 with my group and lights hidden); main's committed `base-spring.glb` is older than bases2's source.
