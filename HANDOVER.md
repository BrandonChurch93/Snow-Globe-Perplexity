# Handover: fall miniature (`miniature-fall`), its small lights and its distance field

Written by `fall_mini` for whoever takes these files next. Times are UTC, 25 Nov 2026.

## Where it stands

- Branch `agent/p4-fall_mini`, tip `5e12700` (merge of `origin/main` at `192ccf3`; my last change is `Fall miniature: pale path stones, larger litter leaves ...`), pushed 02:33. Looks branch `agent/p4-fall_mini-looks`, tip is the commit that holds this file.
- No stand-in and no fallback anywhere in the part. `standIns` is empty, nothing carries `userData.standIn`. No generated picture and no photograph was used; every map and mesh is made by the two build scripts.
- Looks used: 37 of 40.

## Files (all mine, nothing else touched)

- `assets-src/village-fall/build.mjs`: ground (island top with relief, skirt down to radius 56.4 mm), pond water, leaf litter as geometry (1700 leaves), 190 grass tufts, two pumpkins (shell and carved inner faces), two gravestones, attic pane, the two maps (`village-earth`, `village-litter`). Writes `assets-full/fall/village-fall.glb` and the two PNGs.
- `assets-src/village-fall/RECIPE.md`, `assets-src/tree-fall/RECIPE.md`: how each asset is made.
- `assets-src/tree-fall/build.mjs`: boughs, twigs and spikes on the shared trunk's limbs, 58 ember bulbs with their stalks. Writes `assets-full/fall/tree-fall.glb`.
- `src/seasons/fall/miniature.ts`: the part's entry (build, innerLights, collider, standIns).
- `src/seasons/fall/mini/palette.ts`: every light and surface tone.
- `src/seasons/fall/mini/props.ts`: where the pumpkins and gravestones stand.
- `src/seasons/fall/mini/village.ts`: the season's look of the shared village (moss tint, roof tone, door, leaning fence, pale path stones), ground and water materials, panes, lamp, pumpkin lights, halos, the village's `innerLights`.
- `src/seasons/fall/mini/tree.ts`: bark and twig materials, embers, their halos and pools, baked light on the wood, the tree's `innerLights`.

## Make targets, in order

1. `npm run make -- village` and `npm run make -- trunk` (shared, read only for this part).
2. `npm run make -- village-fall`
3. `npm run make -- tree-fall`
4. `npm run texpack`, then `npm run build`.

`main` now tracks the built files of every season. Before merging `main`: `git checkout -- assets-full public/assets`, merge, then steps 2 to 4 again. Never commit anything under `assets-full/` or `public/assets/`.

## Sizes

- village-fall: 247,818 triangles (ground 110,400, water 8,320, decor 122,648, glow 6,448, attic pane 2). tree-fall: 36,546 triangles (twigs 23,090, lights 13,456). No triangles were added after `/root`'s 00:57 notice apart from 88 that a changed litter field moved in.
- `public/assets/fall/` miniature files after texpack: 7.76 MiB (allowance 9.5).

## What is still wrong, worst first, as a viewer of the hero would rank it

1. Not from my files, but the first thing seen over my part: the ember particles are drawn as pale, soft puffs. In the macro they hide the cottage's front and the trunk (picture `09-macro-rest-0238.jpg`); in the hero at rest they sit as a pale cloud in the crown (picture `07-hero-rest-0228.jpg`). They came in with `main` at `5d9b6fe` (`src/particles/draw/`, `src/particles/engine/kinds.ts`, `kinds_builder` and `fall_air`); my look of 02:14, one merge earlier, did not have them. In the storm the miniature now reads through the air (picture `08-hero-landed-0235.jpg`); the cottage walls are still fainter than in the approved shake image.
2. The ground and the pond are dim and soft where the approved ground is crisp: a pale stone path, a tall dark fence in front, grass and rock at the right. Picture `07`. This is most of the M3 gap (see Measures). The path stones are now pale but small; the fence is shared geometry and stands low inside the fog lip.
3. The trunk reads as a smooth dark cone at hero distance; the approved trunk has deep ridges that catch orange light. The shared trunk (`src/miniature/trunk.ts`) takes only a tint and baked light from me, and the shared bark map is too fine to show at this size. Picture `07`.
4. The limbs are thinner and straighter than the approved thick crooked ones (shared limbs; my boughs and twigs grow from them). Picture `07`.
5. Dark contour stripes on the sloping ground at both front corners: `fall_air`'s fog sheets cutting my slope (smooth with the fog off). Told at 01:36. Picture `05`, `07`.
6. The lamp's glow is smaller and paler than the approved amber lantern. `HALO_KIND.lamp` in `village.ts`; winter was faulted for an oversized lamp bloom, so I left it small.
7. The pond is wider and plainer than the approved one: one lamp reflection, no orange glints. The outline is shared.
8. In the macro the grass blades read as flat cards and the lamp glass as flat pale panes. Picture `09-macro-rest-0238.jpg`.

## Measures (draft tier, hero rest unless said)

Last full run 02:23 to 02:28 on my branch with `main` at `5d9b6fe` merged (`npm run measure -- --unit fall --only M2,M3,M6 --tier draft`): `measure fall: not complete · 13 of 19 lines, 6 red`.

- M6 passes in all six stills: 0 of 102,000 particles inside a solid (2 of 102,000 in `fall-shake`).
- M3 `fall-rest`: miniature 0.537 against 0.75 (base 0.606). Red. The draft tier reads about 0.10 higher than the final tier, so expect about 0.44 at final. History at draft: 0.185 at 01:10 (old fog), 0.338 at 01:48, 0.433 at 02:07, 0.469 at 02:10, 0.537 at 02:28. With the fog and the ember kind switched off it was 0.50 at 01:50, before the brightening.
- M2 is red in hero, shake, base, surface and settled (0.17 to 0.39), but every soft pixel lies on the slab (ids colour 96, 251, 237); none of the 89,025 sharp-zone pixels of the miniature is soft. Interior M2 is 0.
- `npm run determinism` at 02:22: `determinism: pass · 3 pictures, 4 page loads, preview, draft, 341 s`.
- `npx tsc --noEmit` clean; `npx vitest run`: 32 files passed, 1 skipped; 432 tests passed, 4 skipped (02:32).
- Stand-in view (`--diag standins`, hero rest, 02:15): 0 pixels lit in the whole frame, 0 on the 94,111 pixels of `miniature-fall`.

Where M3 is lost, from my own replica of the measure by zone (`/tmp/zm.py`, not in the repo: high pass at sigma 1.5 px on the two halves of `out/work/measure/m3-fall-rest-draft-crops-1.png`, masked by colour 134, 249, 16 in the ids still): the ground, pond and skirt rows hold about 40 percent of the part's pixels at an energy of 6 to 20 where the approved image has 35 to 110; the trunk 4 to 9 against 20 to 60; the crown 20 to 40 against 30 to 60; the cottage 30 to 65 against 30 to 150. The pumpkins, panes, lamp and ember halos are part `light-fall` and do not count.

## Constants a successor should know

- `tree.ts`: `BARK_TINT` [0.1, 0.08, 0.065], `TWIG_TINT` [0.085, 0.07, 0.06], `EMBER_GAIN` 6.5, `EMBER_ON_WOOD` {power 60, reach 1.1 mm}, `LAMP_ON_WOOD` {14, 13 mm, wrap -0.3}, `PUMPKIN_ON_WOOD` {22, 6 mm}, `POND_ON_WOOD` {3, 22 mm}, `FILL_ON_WOOD` 1.0, tree `innerLights`: 9 lights of power 0.14 and reach 5.5 mm at 0.72 along each limb, `HALO` {0.56 mm, hot 2.4}, `POOL` {1.5 mm, 0.07}.
- `EMBER_ON_WOOD` is the touchy one. Power 30 with reach 0.7 mm leaves the tree black with no lit wood; power 110 with reach 1.5 mm turns the whole crown copper (tried at 02:10, taken back). The baked lights act strongly on bark: the first lamp and pumpkin values made the trunk glow orange.
- `palette.ts`: `ember` [1, 0.43, 0.1] (was [1, 0.55, 0.18], which clipped to pale yellow), `pondLight` [0.25, 1, 0.42].
- `village.ts`: `LAMP` {power 3, reach 12 mm}, `WINDOW` 1.1 / 8, `SIDE` 0.9 / 7, `ATTIC_LIGHT` 0.6 / 6, `PUMPKIN` 1.3 / 7, `POND` {power 0.3, reach 20 mm, 2.5 mm above the water}, `LAMP_GLASS` [6.4, 3.5, 1.3], `WALL_FILL` 3.0, `GROUND_FILL` 2.6, `MOSS` {low [0.62, 0.76, 0.44], high [0.95, 0.96, 0.88]}, `ROOF.tone` [2.2, 1.7, 1.45], `DOOR` [0.34, 0.24, 0.17], `FENCE.tone` [0.17, 0.1, 0.06] with lean `out` 0.1 and sag 0.5 mm, `PATH.tone` [1.2, 1.13, 1.0], `GROUND` {soil 0.8, leaf 0.85, leafScale 0.6}, `WATER.rippleMm` 0.12.
- `props.ts`: door pumpkin at `cottagePoint(-2.7, 0, halfLength + 3.7)` radius 2.9 mm; tree pumpkin at [21.4, 0, 3.4] radius 2.6 mm; gravestones at [5.2, -9.5] (5.3 mm tall) and [7.7, -10.6] (3.8 mm tall).
- `village-fall/build.mjs`: litter field 0.2 + 0.3 fbm, plus 0.42 by the fence, 0.2 under the tree, 0.14 by the walls; geometric leaves 0.8 to 1.7 mm with tone times 0.45 to 1.0; tufts 0.9 to 2.2 mm tall, blades 0.12 to 0.21 mm wide, mostly on the east bank; skirt at radius 56.4 mm, darkened by `under(p)` from 1.2 to 4.2 mm below the ground's edge; gravestone colour `#3e403a`.
- `tree-fall/build.mjs`: `BOUGH` {perLimb [2, 4], radius 1.0, minR 0.42, kink 0.95}, `TWIG` {each [2, 3], radius 0.86}, `EMBER` {count 58, apart 2.6 mm, r [0.17, 0.3] mm}.
- The hd still is 0.682 of the approved image's pixels. Fall's glass circle in `fall-rest.png`: centre (1417.1, 662.2), radius 564.3 px.

## What I told the other builders of fall

- `fall_air` has the pond and ground numbers, keeps a fog shell at radius 56.7 mm below the ground's edge and asked that the skirt stay at radius 56.4 mm or less and dark. I lowered the green pond light from 0.45 to 0.3 and told it.
- `fall_base` imports nothing from the miniature.

## What I tried that did not work

- Darker and lighter bark tint for relief: `BARK_TINT` from [0.07, 0.06, 0.056] to [0.145, 0.112, 0.09] made the trunk milk brown and still smooth, and did not move M3. Left at [0.1, 0.08, 0.065].
- Brighter ground alone: `GROUND.leaf` 0.42 to 0.62 with `GROUND_FILL` 1.0 to 1.5 raised the ground's energy by about a tenth only; `leafScale` 0.6 (larger litter leaves) did not move it under the fog. The ground needs larger, harder shapes (the path, stones, the fence) more than light.
- `EMBER_ON_WOOD` at power 110, reach 1.5 mm: the whole crown turned copper. At 60 and 1.1 mm the twigs near each ember are lit and the limbs stay dark; this raised the crown's energy from about 12 to about 25.
- Pale gravestones (`#8b8d82`) vanished into the fog; dark ones (`#3e403a`) read as silhouettes.
- Lighter stones did move M3: `MOSS.high` from [0.62, 0.66, 0.55] to [0.95, 0.96, 0.88] with `WALL_FILL` 3.0 and the lighter roof took the cottage from about 110 to 250 in the first replica's units.

## What I would do next

1. A stone path and rock of my own on top of the shared stones (pale, 2 to 4 mm, hard edges), and taller fence boards in my own files in front of the shared fence, once `/root` allows triangles again.
2. Bark ridges as my own geometry or a coarse relief on the lower trunk.
3. Ask `fall_air` for a third of the storm fog's depth in front of the miniature and for fog sheets that do not cut the slope.

## ASSETS.md rows

| Asset | Made by | Source | Takes |
| --- | --- | --- | --- |
| `assets-full/fall/village-fall.glb` | `npm run make -- village-fall` (`assets-src/village-fall/build.mjs`) | procedural, seeded; no picture, no photograph | 0 |
| `assets-full/fall/village-earth.srgb.tile.w1024.png` | same script | procedural noise, tile 12 mm | 0 |
| `assets-full/fall/village-litter.srgb.tile.w1024.png` | same script | 190 drawn leaves, tile 12 mm | 0 |
| `assets-full/fall/tree-fall.glb` | `npm run make -- tree-fall` (`assets-src/tree-fall/build.mjs`) | procedural, seeded, grown on the shared trunk's limbs | 0 |
