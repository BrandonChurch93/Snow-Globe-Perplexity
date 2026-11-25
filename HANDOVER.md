# Handover: fall miniature (`miniature-fall`), its small lights and its distance field

Written by `fall_mini2` (second set, took over from `fall_mini` at 02:43 UTC, 25 Nov 2026). Times are UTC.

## Where it stands

- Branch `agent/p4-fall_mini2`, tip `cdfc304` (merge of `origin/main` of 05:00; my last change is `e680554`), pushed 05:03. Looks branch `agent/p4-fall_mini2-looks`, tip is the commit that holds this file.
- No stand-in and no fallback anywhere in the part. `standIns` is empty. No generated picture and no photograph was used; every map and mesh is made by the two build scripts. No pixel of an approved image is in the app.
- Looks used: 35 of 40.

## Files (all mine, nothing else touched)

- `assets-src/village-fall/build.mjs`: the island ground (grid of 110 rings around 320, relief 0.42), pond water, 230 litter leaves, 360 grass tufts, 260 pebbles, two pumpkins, two gravestones, attic pane, the leaning rail fence (seven posts, twelve rails), four craggy mossy rocks, three door steps, the flagstone path, pond rim stones, the two maps (`village-earth`, `village-litter`). Writes `assets-full/fall/village-fall.glb` (with its own lighter index lists for medium and low) and the two PNGs.
- `assets-src/tree-fall/build.mjs`: ridged trunk sleeve, thick limb sleeves, rising boughs, twigs, spikes, 36 ember bulbs. Writes `assets-full/fall/tree-fall.glb` (own lighter lists).
- `assets-src/village-fall/RECIPE.md`, `assets-src/tree-fall/RECIPE.md`: how each asset is made (this is the traceability row for the three files under `assets-full/fall/` that `village-fall` makes and the one `tree-fall` makes).
- `src/seasons/fall/miniature.ts`: the part's entry (build, innerLights, collider, standIns).
- `src/seasons/fall/mini/palette.ts`: every light and surface tone.
- `src/seasons/fall/mini/props.ts`: pumpkins, gravestones, attic window, fence boards (`fenceBoards()`), rocks (`ROCKS`), path line (`PATH_LINE`).
- `src/seasons/fall/mini/village.ts`: the season's look of the shared village (wall and roof tints, door, tall lantern by stretching the shared lamppost, short chimney, ivy removed), ground and water materials, panes, lamp, pumpkin lights, halos, the village's `innerLights`, the distance field `solid`.
- `src/seasons/fall/mini/tree.ts`: bark and twig materials, embers, halos and pools, baked light on the wood, the tree's `innerLights`, the boughs' distance field.

## Make targets, in order

1. `npm run make -- village` and `npm run make -- trunk` (shared, read only for this part).
2. `npm run make -- village-fall` (about 12 s)
3. `npm run make -- tree-fall` (about 5 s)
4. `npm run texpack` (or `npm run texpack -- --group fall`), then `npm run build`.

Before merging `main`: `git checkout -- assets-full public/assets`, merge, then steps 2 to 4 again. Never commit anything under `assets-full/` or `public/assets/`.

## Triangles (G15)

- At 216e427 my files held high 284,276 / medium 94,273 / low 77,987. Targets (0.95, 0.78, 0.84): 270,062 / 73,533 / 65,509.
- Now: village-fall 214,704 / 43,065 / 33,080 (ground 75,520, water 8,320, decor 124,414, glow 6,448, attic pane 2 at high); tree-fall 37,194 / 26,050 / 15,136. Sum 251,898 / 69,115 / 48,216. All three under target.
- Season drawn (`node out/work/bin/tris.mjs fall`): high 1,689,849 of 1,800,000; medium 992,700 of 1,100,000; low 427,860 of 600,000 (cdfc304, 05:15).
- How: coarser ground grid, fewer litter leaves (1700 to 230), 36 embers for 58, and each primitive carries `extras.levels` made by `addLevels` (`tools/lib/glblevels.mjs`), village error 0.08 / 0.2, tree 0.12 / 0.3. Walls and decor are two meshes sharing one material and are never merged: a merge drops the `LevelIndex` and the lighter lists are then not used.

## What is still wrong, worst first, as a viewer of the hero would rank it

1. Not from my files, first thing seen over my part: leaf and ember particles and the glass haze veil the cottage and the crown (picture `15`); at rest landed leaf particles lie over the path (picture `16`); in the settled state a column of leaves hangs in front of the trunk (picture `17`). Told `fall_air2` at 04:09 and `kinds2` at 03:17.
2. R1 #6, open: the cottage is smaller in the glass, further left, and its gable is turned further from the camera than in the approved pair. Scale, place and yaw are the shared layout (`src/scene/layout.ts`), not mine. In my files I did: short square chimney without pot, ivy removed, door clear of the pumpkin, lighter door wood, taller fence.
3. R1 #2, partly open: the tree is black, bare, reaches the top of the glass and carries 36 small lights, but its crown is wider and twiggier than the approved one and the main limbs are straighter (shared limbs of `src/miniature/trunk.ts`). No flared roots that catch orange light. I tried stronger baked light on the wood (ember 30, lamp 13, pumpkin 26): the tree went brown, so I took it back.
4. M3 `fall-rest` miniature 0.365 on `cdfc304` (0.600 one commit earlier, before the 05:00 merge of `main`; my files are identical in both) against 0.75 at draft tier (base passes). By zone (my replica of the measure matches it to three digits) the energy on my pixels is set by the leaf and ember particles in front, not by my surfaces: a 30 percent brighter ground moved no zone, paler flagstones and sharper pond glints moved the pond zone only. The approved image has 250 to 520 in zones where the still has 70 to 270.
5. R1 #3 / R3-2 #2, mostly done: pond is dark green, mirrors the trunk and the lamp post, carries warm glints of lamp, pane and pumpkins, has a wet line; larger flagstones and steps; mossy rock bank. Open: no reflection of the cottage, the rock bank is darker and smoother than the approved rocks, the earth is greener and less brown than approved.
6. R3-1 #8, partly: panes have a hot centre and darker drapes and less spill on the wall. The pane shader is shared and gives only `room`, `curtain`, `glass`, `paneHot`; the glazing is not set deeper in the wall.
7. R3-1 #6, not re-judged: twig tips are shorter (`0.12 + 1.1 r`), fewer twigs (`TWIG.each [0.6, 1.2]`); junctions are still tubes that meet without a blended collar.
8. Roof slates are small and regular where the approved slates are large and uneven (shared village geometry; I only tint it). Wall stones are more contrasty than approved. The left wall is darker than approved.

## Measures

All at draft tier.

- `npx tsc --noEmit`: clean (05:00). `npx vitest run`: 432 passed, 4 skipped (05:01, after the merge).
- `npm run determinism` on `cdfc304`: `determinism: pass · 3 pictures, 4 page loads, preview, draft, 352 s` (05:09). Also pass on `5caece9` at 04:47 (343 s).
- `npm run measure -- --unit fall --only M2,M3,M6 --tier draft` on `cdfc304` (05:15): `measure fall: not complete · 13 of 19 lines, 1 red · draft · 294 s`. M2 pass on all six stills with 0 soft pixels (rest, shake, interior 0 of 453,132, base 0 of 98,478, surface 0 of 96,643, settled). M6 pass on all six (0 of 102,000 inside a solid). M3 `fall-rest` FAIL 0.3649: base 0.542, miniature 0.365 over 97,551 pixels.
- The same measure on `5caece9` (04:52): M3 0.5719, base 0.860, miniature 0.572. On `e680554` (04:58, M3 only): miniature 0.600, base 0.860. The fall from 0.600 to 0.365 (and base 0.860 to 0.542) came with the 05:00 merge of `main` (fall glass, veil, backdrop, rig, base, slab, particle draw and engine); not traced further, told `/root` at 05:16.
- M3 history of the miniature at draft: 0.540 at 03:21, 0.572 at 04:52, 0.578 with brighter ground, 0.600 with paler flagstones and sharper pond glints.
- `node out/work/bin/tris.mjs fall` on `cdfc304`: high 1,689,849; medium 992,700; low 427,860. All under the limits.
- Zone replica of M3: `/tmp/lk/zm.py` (not in the repo): high pass at sigma 1.5 px, squared, on the two halves of `out/work/measure/m3-fall-rest-draft-crops-1.png`, masked by colour 134, 249, 16 in `out/work/stills/fall-rest-hd-draft-ids.png` at hd x 612 to 1308, y 328 to 720; it gave 0.578 and 0.600 where the measure printed 0.5783 and 0.6001.

## What did not work (do not repeat)

- Bark tint for relief; pale gravestones (keep `#3e403a`); high contrast pond patches (camouflage look); `MOSS.biteTop 2` (white stones); stone tones times 1.3 with `WALL_FILL 2.8` (flagstones blow out; 1.12 holds); stronger baked light on the wood (brown tree); deeper ground bump (`soilMm 0.4`: no visible change at hero); leaving thin boughs out of the collider (only boughs are in it already, no gain).
- A GLSL error breaks a shader silently; stills refuse a stale `dist` (texpack and build first).

## Constants a successor should know

- `village.ts`: `TALL_LAMP { reachMm 2.6, neckMm 9.5, post [1.6, 1.2], head [1.5, 1.5] }`, `LAMP_GLASS [3.4, 1.25, 0.24]`, `HALO_KIND.lamp { size 5.6, rest 0.32 }`, `LAMP { power 3.8, reachMm 14 }`, `WINDOW.power 1.5`, `SIDE.power 0.75`, `NEAR_WALL.pane { power 1.5, reachMm 4.2 }`, `PANE { room 0.8, drape 0.6, hot 0.8 }` with glass times 2.4, `STACK { fromMm 17.6, keep 0.7, reachMm 0.5 }`, `MOSS { low [0.34, 0.44, 0.25], high [0.5, 0.54, 0.45], soot 0.68, bite 0.8, bitePivot 0.36, biteLow 0.3, biteTop 1.08 }`, `ROOF { tone [1.8, 1.52, 1.4], grey 0.7 }`, `DOOR [0.5, 0.37, 0.25]`, `WALL_FILL 2.8`, `GROUND_FILL 4.2`, `GROUND { soil 1.45, leaf 1.05 }`, `WATER { rough 0.07, rippleMm 0.18, lamp 8, pane 1.6, pumpkin 4.5, tight 0.0008, fog 0.13, trunkMm 3.4, dim 0.85 }`; the pond mirrors posts with the shared `villagePost` (trunk foot radius 3.4 mm, lamp post 0.8 mm).
- `palette.ts`: `fogGlint [0.06, 0.5, 0.22]`, `water [0.006, 0.016, 0.014]`.
- `props.ts`: fence posts 9.6 to 11.4 mm tall, 2.11 to 2.46 wide, rails at 3.5 and 7.6 mm; `ROCKS` main `[31, 22] r [7.4, 4.9, 5.2]`; door pumpkin at `cottagePoint(-3.9, 0, halfLength + 3.5)`.
- `tree.ts`: `BARK_TINT [0.06, 0.055, 0.052]`, `TWIG_TINT [0.05, 0.047, 0.045]`, `EMBER_ON_WOOD { 20, 0.9 }`, `LAMP_ON_WOOD power 8`, `PUMPKIN_ON_WOOD 16`, `FILL_ON_WOOD 3.5`, `GROUP.power 0.06`, `HALO { radiusMm 0.4, hot 3.2 }`.
- `tree-fall/build.mjs`: `BOUGH { perLimb [1, 2], length [9, 15], turn 0.3, kink 0.9, kinkShare 0.3, rise 0.4, lift 0.4, tip [11, 17], tipLift 0.6 }`, `TWIG.each [0.6, 1.2]`, `SPIKE.each [0.1, 0.7]`, `EMBER { count 36, apart 3.6 }`.
- `village-fall/build.mjs`: stone tones times 1.12; flagstones 3.1 to 4.3 mm along, path 7 mm wide, 1.7 mm thick, lifted 0.55 to 0.85; steps 1.7 mm thick; `LITTER.leaves 230`; rocks `#c6c6ba` with moss `#4c6030`.

## ASSETS.md rows

No new asset file since `fall_mini`. The four files (`assets-full/fall/village-fall.glb`, `village-earth.srgb.tile.w1024.png`, `village-litter.srgb.tile.w1024.png`, `tree-fall.glb`) are described in the two `RECIPE.md` files; no generated or fetched picture, no `gen/` folder.
