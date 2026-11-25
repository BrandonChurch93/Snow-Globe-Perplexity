# Handover: fall's base, surface dressing and arrival

Written by `fall_base` for whoever takes these files next. Parts in the register: `base-fall`, `surface-dressing-fall`, `arrival-fall`. Code branch `agent/p4-fall_base`, tip aebc876 (merges of `main` 192ccf3, 20710cc and c35f1e4 on top of b5accbf, the last change of these files); this branch (`agent/p4-fall_base-looks`) holds only pictures and these two files and is never merged.

## Your files

- `assets-src/base-fall/layout.mjs`: numbers read by eye from `references/approved/fall-rest.png` (the three faces in view, `DRIPS`, `RUNS`, `HERO_THORNS`), the drum profile, and `onCylinder(px, py, radiusMm)`, which turns a pixel of the approved image into a place on a cylinder through the reference camera of `assets-src/refrig/fall.json`.
- `assets-src/base-fall/mesh.mjs`: `buildIron` (drum, collar, strands, thorns), `buildPumpkins`, `buildWax`, `buildWeb`. `maps.mjs`: the iron detail tile and the four carved faces as a distance map. `lib.mjs`: the mesh soup, tubes, noise. `build.mjs`: writes the files. `RECIPE.md`.
- `assets-src/slab-fall/build.mjs` (leaf sheet and the leaves mesh), `lib.mjs`, `RECIPE.md`.
- `src/seasons/fall/base.ts`: materials of iron, pumpkin, wax and web, the candle light (`LIGHT`, `faceLevel`, `setCandles`).
- `src/seasons/fall/slab.ts`: the leaves (the skitter is in the vertex shader), the rim of light at the foot and the candle light on the slab; exports `dressing()` and `setSkitter`.
- `src/seasons/fall/arrival.ts`: `seconds(moment)` and `update`, which hand the time since the landing to `setCandles` and `setSkitter`.

Outputs, never committed: `assets-full/fall/base-fall.glb`, `base-iron-detail.lin.tile.w1024.png`, `base-faces.lin.w1024.png`, `slab-fall.glb`, `slab-leaves.srgb.w1024.png`.

## Make targets, in order

1. `npm run make -- base-fall` (about 5 s)
2. `npm run make -- slab-fall` (about 1 s)
3. `npm run texpack`
4. `npm run build`

After a merge of `main` the other builders' folders that changed need their own make before a render works (`tree-fall`, `village-fall`, and for shake-3 `tree-summer`, `base-summer`, `village-summer`); a render says "file is not prepared" or "dist/ does not match the source" when one is missing.

## What is still wrong, worst first (as a viewer of the hero would rank it)

1. The weave reads tidier and more level than the approved tangle: stacked rings at the crown and the foot, where the approved image has branches crossing at 10 to 30 degrees everywhere and darker depth between them. Picture: `01-rest-base-pair.jpg`.
2. The left side of the ring lacks the warm brown rim-lit thorns of the approved image. A broad lobe of the rim light exists (`ironWarm`, 0.3) but only tints the outermost strands. Same picture.
3. The cobweb is a few hay-thin lines close to the ring, not the pale fan from the top right thorns down to the slab. See "Tried and did not work". Same picture, right edge.
4. The face openings are a flatter yellow-orange than the approved orange with hot mouths, and the rind round each face is browner and rounder than the approved dark rind. Pictures 01 and `03-rest-base-camera.jpg`.
5. Leaves: sparser at the left than the approved heap, all one family of shapes from one procedural sheet; in `02-landed-base-pair.jpg` a few stand dark in front of the foot in mid tumble.
6. In the `base` camera the long run of wax passes close to the rim of the right pumpkin (not over its openings), the drum wall shows as bare dark leather between faces and foot, and two thorns that point at the camera read as cut cones. Picture 03.
7. The arrival: the faces reach near full light inside about half a second (the `ember` level is 0.42 of full and the opening is already bright at that level), so the "one after another over the next seconds" reads mostly as a first catch, left to right; the skitter reads as a drift at sheet size. In the change the leaves appear in one step at about 35.27 s while summer's sand is still there. Picture `04-swap-sheet.jpg`.
8. Not looked at by me at all: the `macro`, `interior`, `surface` and `low` cameras as pictures (the measure rendered `surface` and passed M1, M2, M6 there, but I did not view it), any tier above draft, and the mirror image of the base on the slab beyond what the hero pair shows.

## Stand-ins and fallbacks

None left. Nothing in these files carries `userData.standIn`, `slab.ts` exports an empty `standIns`, and the stand-ins view at rest is black in every pixel. No fallback of `kit/03-METHOD.md` "The fallback chain" is in use: every form is geometry made by script, every map is made by script. The cobweb is the built part at a smaller size than the approved fan (see fault 3), not a stand-in.

## Measured (draft tier, commit b5accbf, before the last three merges of `main`; not run again on the tip)

- `npm run measure -- --unit fall --only M1,M2,M3,M6 --tier draft`: 19 lines, 1 red. M1, M2, M6 pass on every still (rest, shake, interior, base, surface, settled). M3 fall-rest is red at 0.3007 because of the miniature (0.301, `fall_mini`'s part); the base reads 0.892 against the 0.75 threshold.
- Before the last iron change M3 base was 0.635 (red). Before the leaves reported their texel density M2 was red on five stills (0.19 to 0.46): the leaf shader passed 0 texels to `stageDiag` while flagged as textured. It now passes the true density (`vLeafUv * 1024`).
- Triangles: `base-fall` 108,868 (iron 73,014, pumpkins 23,838, wax 10,282, web 1,734); `slab-fall` 17,920. Stage 1 was about 129,000, so nothing was added after `/root`'s "add no triangles".
- Size after texpack in `public/assets/fall/`: my seven files are 3,266,609 bytes (3.12 MiB): `base-fall.glb` 1,669,532, iron detail 658,102 + 252,208 (first), faces 61,198 + 18,576 (first), `slab-fall.glb` 315,792, `slab-leaves` 291,201.
- Fit against the approved crop (box 620,900,2260,1560, rest): mean difference per channel 31.9, 26.0, 22.3; mean colour approved 38.0, 36.6, 32.3, render 40.6, 39.6, 31.4.

- `npm run determinism` on f2407a8 (after the merge of `main` 192ccf3): "determinism: pass · 3 pictures, 4 page loads, preview, draft, 339 s". Not run again on the tip. On the tip aebc876: `npx tsc --noEmit` clean, `npx vitest run` 432 passed, 4 skipped. On 5e0a82e (the tip less two kit files): the rest pair rendered and viewed (`01-rest-base-pair.jpg`).

## Constants a successor should know

- Geometry: sphere radius 60, `baseHeightMm` 33, `baseDiameterMm` 116, collar as winter's. In the approved image the foot is 1020 px wide at 116 mm (8.79 px per mm); glass circle centre (1417.1, 662.2), radius 564.3 px; the build sits 5.6 px left of the image (from `fall_air`).
- `mesh.mjs` `addStrands`: 2 ground rings (sprawl 1.1 and 0.4; more than that makes the foot wider than the approved 116 mm), 2 crown rings, 2 mid rings, 25 tapering branches (every third steep: slope 20 to 30 mm over 26 to 42 degrees; the rest 11 to 25 mm over 62 to 150 degrees; `h0` 4 to 27), 18 wires (radius 0.5 to 0.8, `h0` 4 to 21). Every strand bows round every face in `strandPath` (`ex`, `need`); a thorn is refused by `crossesFace` (7 probes, on the ring and in the hero camera's pixels), which is what keeps every face clear of thorns. 27 thorns are refused now.
- Wax: `DRIPS` hang from the collar ring; `RUNS` (x 1052, 1622, 1788 in approved pixels, pools 3.6, 3.2, 2.8) follow the outer envelope of the weave through `weaveOut(az, h, halfDeg)` and sit 0.45 of their width inside it, so they read as wax lying on strands and not as posts.
- `base.ts` `LIGHT`: `catchSeconds` [0.05, 0.21, 0.38, 0.52, 0.66, 0.8, 0.94], `takeSeconds` [0.85, 1.5, 2.15, 2.7, 3.15, 3.5, 3.8], `ember` 0.42, `flare` 0.7, `flareSeconds` 0.07, `creepSeconds` 0.9. `uFacePower` 2.3, `uFaceRind` 0.12. Face cave colour mix (1, 0.17, 0.01) to (1, 0.44, 0.08) times (0.36 + 1.15 hot), hot spot at (0.5, 0.3) of the face.
- Iron light (added by hand after the standard lighting, in `IRON_AFTER`): key 0.2 pow 9 + 1.5 pow 90; card 0.05 pow 10 + 0.26 pow 50 (card colour desaturated by 0.65); rim 0.08 pow 7 + 0.4 pow 50; warm side lobe 0.3 of the rim colour; detail tilt 0.5 on strands. `FLOOR_SHARE` 0.1.
- `slab.ts` `SKITTER`: `pushMm` 34, `reachMm` 85, `waveMmPerSecond` 520, `slideSeconds` 0.75, `hopMm` 3.2, `spin` 2.6, `tumble` 0.1. Leaf tone 0.6 + 0.6 by leaf; albedo is the sheet mixed 0.18 to 0.6 with a tan grey. Leaves: 300 curled (4.6 to 8.8 mm, nearer the foot by exponent 2.3, more at the sides), 170 crumbs, 330 far.
- `arrival.ts` `seconds()`: 0 while the globe is in the air on its way into fall (`beat >= swapWindow.fromBeat` and `arrived < 0.5`), then the time since the landing, 1000 at rest. The change itself is the stage's: every material carries `change: 'base'` or `'surface-dressing'`, so the base and leaves dissolve inside the bloom.
- The mirror image of the faces falls below the hero frame, so the orange on the slab in front of the foot is the candle term in the additive rim sheet (`candleOnSlab`, 0.5 times dust).

## Tried and did not work

- Cobweb as a large fan outside the silhouette of the base (hub at the tip of hero thorn 7, down to the long spike and to the slab at x 80 mm): three tries, in each the sheet showed only where it overlaps the base or lies near the spike; the part over the slab and backdrop did not appear, with thread alpha up to 0.75. I did not find out why (the web is a `stageShader`, transparent, premultiplied, `depthWrite` off, `renderOrder` 4; what is drawn after it over the slab is the first thing to check). Put back to three small sheets close to the ring.
- A stronger broad rim lobe (0.3 pow 7, and a warm lobe of 0.55): turned the lowest left strands pale beige like wax. `FLOOR_SHARE` 0.3 to 0.1 did not change that band; it was the rim lobe and the wide ground ring.
- Foot wax runs as free tubes from radius 57.4 to 60: read as bones or pegs leaning on the ring; with a round top as fingers. The envelope method above replaced them.
- `tumble` 0.28: at the landed still large dark leaves stood upright in front of the faces.
- Face cave at (0.38 + 1.9 hot): clipped to flat yellow.

## Looks used (cap 40 a part)

- `base-fall`: 39, counting two crops of renders already counted.
- `surface-dressing-fall`: 32 (the same hero and landed pairs show it, plus one sheet of the leaf atlas).
- `arrival-fall`: 3 motion sheets (arrival, landing, swap) and the 6 landed pairs.
- Stand-ins view: seen once at stage 1; at the end rendered at rest, hero, draft and read as numbers (every pixel 0).

## ASSETS.md rows

None needed under "Generated images" or "Fetched": every file of both folders is made by script, 0 takes of 6, no pixel of an approved image, no web photograph. The two `RECIPE.md` files list each output with its script, inputs and command.
