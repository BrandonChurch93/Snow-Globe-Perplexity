# HANDOVER: fall base and slab (fall_base2), 05:35 UTC

Start from `origin/main` plus `agent/p4-fall_base2` at **a0e301d**. The freeze of 05:20 took **15ecc57**; a0e301d (pushed 05:21) is one shader commit later and is NOT in Rounds 11 to 13.

## Files
- `assets-src/base-fall/`: `build.mjs`, `layout.mjs` (sizes, faces, `TWIGS`, `CROWN`), `maps.mjs` (the four carvings `DESIGNS`, `grin()`), `mesh.mjs` (drum, branches, thorns, pumpkins, wax, web), `lib.mjs`, `RECIPE.md`
- `assets-src/slab-fall/`: `build.mjs`, `lib.mjs`, `RECIPE.md`
- `src/seasons/fall/base.ts` (paints of iron, branches, pumpkins, wax, web; candles `LIGHT`, `setCandles`, `faceLevel`)
- `src/seasons/fall/slab.ts` (leaves, crumbs, `candleInSlab`, `candleOnSlab`)
- Not mine any more: `src/seasons/fall/arrival.ts` (change_builder).
- Make targets, in this order: `npm run make -- base-fall`, `npm run make -- slab-fall`, `npm run texpack`, `npm run build`.

## Open, worst first
1. **Branches read as a level, brown-grey straw nest, most from the low camera** (looks 02). Approved: near-black glossy vines that cross each other. The fibres were deepened in e7ab0b5 and a0e301d to get the base part of M3 over 0.75 and to answer "smooth tubular vines"; they did that (0.557 -> 0.666 -> 0.791) but lightened the read. Not tried: a darker bark albedo with the same fibre contrast; a thin glossy streak along each branch (line ~255 of `base.ts`, the `pow(ironKh, 16.0)` lobe) as the source of high frequency instead of albedo; crossing branches (slope is `r(5,19)` degrees in `mesh.mjs`, raising it brought back a regular weave, which the critics named).
2. **Wax shorter and less glossy than the approved long runs.** Now draped teardrops off the collar (29 runs, 10,270 triangles). Free hanging tubes read as pegs, so every run rides on the branches (`ride`). Tried: longer runs (they cross the faces), stronger key lobe (turns chalk white). Gloss is `roughness 0.14 to 0.28`, lobes `pow 120`, `1.6 * pow 90 + 0.2 * pow 14`.
3. **Side pumpkins a little smaller than approved** (by eye on the pair; 12.6 mm against 15.4 was read before the last widening, not read again since). The branches give way inside `smooth(1.22, 0.95, ...)` of each face (`mesh.mjs` line 207); wider than that opens a bare ring round the face.
4. **Seat of the glass** is a wax rim with a dark upper edge (`smoothstep(39.7, 39.25)` in the wax paint, `smoothstep(39.6, 38.9)` in the iron), not a modelled channel. The dashes along it are gone since 04c2655 (wax kept outside the collar bead).
5. **The right pumpkin is half hidden by a wax run from the low camera**; the dark crown thorn in front of the glass reads as a flat blade in all hero stills.
6. Reflections of the pumpkins in the slab (`candleInSlab`, `MIRROR_DEPTH 0.42`) are three separate warm blobs, but the hero frame cuts them about 60 px under the foot. The true mirror is the shared surface (`surface.ts`, change_builder).
7. No lit grey leather at the right of the drum; the base stands about 5% taller in frame than approved (camera, not mine).
8. M3 fall-rest stays red for the still as a whole on the miniature (0.380, fall_mini2's part).

## Numbers that worked
- Faces: turns `[-9,4,11,-6,8,-12,5]` degrees, ribs `[4.5,5.5,4,5,4.5,6,5]`, bevel 0.03, `uFaceRind 0.2`, `baseCandle 3.6`.
- Candles: `catchSeconds [0.2, 0.04, 0.1, 0.6, 1.9, 0.3, 1.0]`, `takeSeconds [0.44, 0.2, 0.34, 1.1, 2.5, 0.8, 1.6]`. The three seen faces must all be alight at `states.landedSeconds` (0.5 s) because the judged fall-shake still is taken there and approved shows all three lit; change_builder's slower lines (04:37) were not used for that reason.
- Branches: 30 + 3 level ones at face height, radius `r(1.5,2.5)`, thorns every 42 with length 7 to 13; 44 strands, 132 thorns, 27 refused for crossing a face or the slab.
- Bark fibres (a0e301d): three runs weighted 0.42 / 0.3 / 0.28 at scales 1, (2.3, 3.1), (4.1, 6.3); colour `(0.2 + 1.6 * fibre) * 1.2`; normal tilt 4.2. At e7ab0b5 / 15ecc57: 0.5 / 0.3 / 0.2, `(0.3 + 1.4 * fibre) * 1.2`, tilt 3.0.
- Wax: top row at 39.62, `inner` never inside the bead, colour (0.92,0.8,0.5) to (0.8,0.52,0.2).
- Slab: 130 near leaves of 5.2 to 9.6 mm, 110 crumbs, 120 far leaves.

## Pitfalls
- A GLSL error breaks the paint silently: look after every shader edit.
- `level(f)` must use the strand's own turn round the ring, or strands past 180 degrees swag under every face.
- Thorns must never cross a face; the wax ambient must use luminance (the sky is green); a strong warm term turns the branches beige.
- Low and medium triangles of my files are close to the G15 limit: do not add geometry without cutting some.
- `tris.mjs` and `measure` refuse to run when `dist/` does not match the source: `npm run build` first.

## What I could not see
- Nothing at tier high or at 4k: every look was `--tier draft --format hd`.
- The `surface` camera (critics' fall-surface) and the `interior` camera at the head: last looked at before 838c64f.
- The landed state at the head: last landed look was at 04c2655, before the two fibre commits.
- The motion of the candles as a film: `faceLevel` was checked by its values at 0.5 s (0.54 / 0.84 / 0.75) and on the landed still, never as a clip.
- M1, M2, M6 at the head: measured at 04c2655 (same meshes, older bark paint).
