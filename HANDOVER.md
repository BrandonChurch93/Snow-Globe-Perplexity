# Handover: fall miniature (`miniature-fall`), its small lights and its distance field

Written by `fall_mini3` (third set, took over from `fall_mini2` at 05:38 UTC, 25 Nov 2026). Times are UTC.

## Where it stands

- Branch `agent/p4-fall_mini3`, tip `946f650` (merge of `origin/main` `de1c404`; my last change is `6ac1efd`). Looks branch `agent/p4-fall_mini3-looks`, tip is the commit that holds this file.
- No stand-in and no fallback anywhere in the part. `standIns` is empty. No generated picture and no photograph was used; every map and mesh is made by the two build scripts. No pixel of an approved image is in the app.
- Looks used: 39 of 40.

## Files (all mine, nothing else touched)

- `assets-src/village-fall/build.mjs`: island ground, pond water, 230 litter leaves, 360 grass tufts (now weighted to the front rim and taller there), 260 pebbles, two pumpkins, two gravestones, attic pane, leaning rail fence, four mossy rocks, three door steps, flagstone path (flat warm slabs), pond rim stones, the two maps (`village-earth`, `village-litter`). Writes `assets-full/fall/village-fall.glb` (own lighter index lists for medium and low) and the two PNGs.
- `assets-src/tree-fall/build.mjs`: ridged trunk sleeve, limb sleeves, boughs, twigs, 26 ember bulbs; `CEIL` keeps the crown inside the interior frame. Writes `assets-full/fall/tree-fall.glb` (own lighter lists).
- `assets-src/village-fall/RECIPE.md`, `assets-src/tree-fall/RECIPE.md`: how each asset is made (unchanged by me; the tree recipe still names spikes, which the build now grows none of).
- `src/seasons/fall/miniature.ts`: the part's entry (unchanged by me).
- `src/seasons/fall/mini/palette.ts`: every light and surface tone.
- `src/seasons/fall/mini/props.ts`: pumpkins, gravestones, attic window, fence boards, rocks, path line.
- `src/seasons/fall/mini/village.ts`: the season's look of the shared village (wall, roof, door, timber tints, tall lantern, chimney), ground and water materials, panes, lamp, pumpkin lights, halos, baked bounce sources, `innerLights`, the distance field.
- `src/seasons/fall/mini/tree.ts`: bark and twig materials (`barkHook`: baked glow plus thin Blinn glints on the bark ridges), embers, halos and pools, the tree's `innerLights`, the boughs' distance field.

## Make targets, in order

1. `npm run make -- village` and `npm run make -- trunk` (shared, read only for this part; only after a merge that changed them).
2. `npm run make -- village-fall` (about 12 s)
3. `npm run make -- tree-fall` (about 5 s)
4. `npm run texpack`, then `npm run build`.

Before merging `main`: `git checkout -- assets-full public/assets`, merge, then steps 2 to 4 again. Never commit anything under `assets-full/` or `public/assets/`.

## Triangles (G15)

- Start of my set (5463ca3's parent, mini2's tip): my files 251,880 / 69,093 / 48,194.
- Now: village-fall 214,584 / 42,623 / 32,999; tree-fall 33,026 / 21,713 / 12,211. Sum 247,610 / 64,336 / 45,210. Never above the start at any level.
- Season drawn (`node out/work/bin/tris.mjs fall`): 1,599,251 / 928,916 / 412,980 against 1,800,000 / 1,100,000 / 600,000 (on 6ac1efd, main's air and base).

## What is still wrong, worst first, as a viewer of the hero would rank it

1. M3 `fall-rest` fails. The miniature reads 0.572 at FINAL tier on main c3aab2a + fall_air3 2dd31bf + my 323cfce (base 0.407), and 0.453 at draft on my tip with main's own, heavier fog (base 0.665). Threshold 0.75. Weakest zones against the approved (my replica, approved / ours, times 1e6, with fall_air3's fog): fence, path and pond edge 8344 / 1999; front wall 6091 / 3145; side wall 3930 / 2002; ground left of the path 5386 / 2648; crown 3600 / 2202.
2. The trunk below the fork is about twice the approved's width at the hero and its silhouette is a cone, not the approved's heavy twist. It is the shared trunk (`src/miniature/trunk.ts`, `assets-src/trunk`), read only; my sleeve only adds ridges and a root flare.
3. The cottage is smaller, more frontal and further left than the approved's; slates and wall stones are larger and paler at the gable. Shared layout and mesh.
4. The ground at the front rim still reads as a lit green band in the hero: the band is fall_air3's low fog; my half (tall grass through it, dark soil, contact shade) is in. No stones break the front slope, and the fog hides the litter there.
5. Panes are more even than the approved's (which show a bright core, dark corners and a glow on sill and wall). I dimmed the room, kept a hot centre and put grime in the frost slot; a true gradient needs the shared pane shader.
6. The pond's far shore is a regular row of rim stones; the approved's is a soft grass bank with few stones. The wet line (6ac1efd) is subtle at hero size.
7. Limbs are straighter and the crown rounder than the approved's clawed, twisted boughs. `CEIL 24.5` flattens the top a little (needed for M1).
8. The path is shorter and its flags larger than the approved's.
9. `assets-src/tree-fall/RECIPE.md` still speaks of spikes; the build grows none.

## Measures

Last full run on my tip 6ac1efd (before the merge of main de1c404, which changed no source), `npm run measure -- --unit fall --only M1,M2,M3,M6 --tier draft`, 482 s, 19 lines, 1 red:

- M1 passes on all six views; `fall-interior`: "the miniature, 410661 pixels in the ids view, stays clear of the edge of the frame" (it touched at Round 13).
- M2 passes on all six views (0 soft pixels).
- M6 passes on all six views (`fall-shake` 6 of 102,000 particles inside a solid, 0.000059 against 0.002).
- M3 `fall-rest` FAILS: 0.4532 against 0.75; base 0.665 over 172,715 px, miniature 0.453 over 99,020 px. This is with main's own fog. Draft readings run above final ones on the base and the fog decides much of the miniature's.
- M3 at FINAL tier on main c3aab2a + fall_air3 2dd31bf + my 323cfce (local merge, 500 s): 0.407; base 0.407 over 172,715 px, miniature 0.572 over 103,397 px.
- `npm run determinism` on 6ac1efd: `determinism: pass · 3 pictures, 4 page loads, preview, draft, 344 s`.
- `npx tsc --noEmit` clean; `npx vitest run` 432 passed, 4 skipped (on 946f650).

## What did not work (do not repeat)

- Everything in `fall_mini2`'s list still holds: bark tint for relief; pale gravestones (keep `#3e403a`); high contrast pond patches; `MOSS.biteTop 2`; stone tones times 1.3 with `WALL_FILL 2.8`; stronger baked light on the wood (brown tree); `soilMm 0.4`.
- Glints on bark at full lamp power (first tries: `GLINT_LAMP.power 6`): white streaks over the whole trunk. Thin glints need the ridge mask and powers near 1.
- Wall stone top at 0.16: closest to the approved olive by eye, but cost 0.02 of M3 against 0.18; 0.18 is in.
- Bending the tone of the stone vertices above the eaves (the `kind === 0` roof branch) lights the chimney and the gable's stone tops white. Only the slates (`kind === 1`) are bent.
- Dropping the shared trunk to draw a slimmer one: not done and not to be done, the trunk is the one geometry all four seasons share.
- A GLSL error breaks a shader silently; stills refuse a stale `dist` (texpack and build first). The still tool reuses a cached simulation (`simulation 0.3 s`) until a solid changes.

## Constants a successor should know

- `village.ts`: `STONE { top 0.18, knee 0.12, power 2.2 }` (tone curve of the wall stones, joints stay black), `MOSS { low [0.68, 0.88, 0.5], high [0.9, 1.06, 0.68], soot 0.8 }`, `ROOF { tone [1.65, 1.22, 0.95], grey 0.55, mid 0.045, bend 1.6, patch [0.6, 1.7] }`, `DOOR [0.24, 0.19, 0.13]`, `TIMBER [0.4, 0.42, 0.34]`, `PATH.tone [0.96, 0.76, 0.58]`, `NEAR_WALL.lamp.power 3.4`, `BOUNCE` (two baked sources: fence front `[1, 0.76, 0.52]` power 1.5 reach 9; side wall `[0.86, 0.9, 0.66]` power 1.7 reach 11), `WATER.fog 0.3`, `PANE { room 0.45, drape 0.3, hot 1.0, grime [0.014, 0.013, 0.009], grimeAmount 0.7 }` (the shared pane's frost slot carries the grime).
- `palette.ts`: `water [0.014, 0.03, 0.027]`, `fogGlint [0.2, 0.46, 0.34]`.
- `props.ts`: fence posts and rails `wide` times 0.78.
- `tree.ts`: `GLINT { shine 80, ridge [0.3, 0.8], rough 0.86 }`, `GLINT_LAMP { lift 3.6, power 1.3, reachMm 11 }`, `GLINT_TONE [1, 0.46, 0.14]`, `GLINT_PUMPKIN { power 0.9, reachMm 8 }`, `GLINT_POND { power 0.05, reachMm 24 }`, `EMBER_ON_WOOD.power 14`, `LAMP_ON_WOOD.power 5.5`, `FILL_ON_WOOD.power 2.2`, `POOL { radiusMm 1.0, strength 0.04 }`.
- `tree-fall/build.mjs`: `CEIL 24.5` (world mm above the sphere's centre; the interior frame's top edge is near 27.9), `BOUGH { rise 0.22, tipLift 0.45 }`, `TWIG.each [0.3, 0.7]`, `SPIKE.each [0.05, 0.4]` (grows none), `THICK { limb 1.3, twig 1.2, bough 0.9, tip 0.9 }`, `SLEEVE.stem 0.12`, `EMBER { count 26, apart 4.4 }`.
- `village-fall/build.mjs`: `LITTER { base 0.1, patch 0.3, tree 0.14 }`, `STONE_TONES` times `[1.2, 1.04, 0.86]`, `FLAG_TONE [1.3, 0.92, 0.66]`, path flags 1.3 mm thick with round 0.16 and sides at 0.1, `GRASS_TONES ['#4f6a26', '#62782e', '#8f7a34', '#3f5620', '#86572a']`, pumpkin tone `#cf5a12` with deep `#4a1604`, tuft chance `0.75 * front` and height `+ 1.1 * front` on the rim toward the camera.

## Tools I used (not in the repo)

- `/tmp/lk/zm.py`: replica of M3 by zone (`fall_mini2`'s, same recipe). It reads the mask from the last measure's ids view, so it is stale after a tree change until the measure runs again.
- A local scratch branch that merges `origin/agent/p4-fall_air3` into mine to measure the merged build; deleted after each use, never pushed.

## ASSETS.md rows

No new asset file. The four files (`assets-full/fall/village-fall.glb`, `village-earth.srgb.tile.w1024.png`, `village-litter.srgb.tile.w1024.png`, `tree-fall.glb`) are described in the two `RECIPE.md` files; no generated or fetched picture, no `gen/` folder.
