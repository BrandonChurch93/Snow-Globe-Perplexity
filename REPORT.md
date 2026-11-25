# Report: fall_base (fall's base, surface dressing and arrival)

1. Branch `agent/p4-fall_base`, last commit f2407a8 (merge of `main` 192ccf3 on top of b5accbf, the last change of my files). Looks branch `agent/p4-fall_base-looks`; longer notes in `HANDOVER.md` beside this file.
2. Stand-ins and fallbacks: none left. Nothing in my files carries `userData.standIn`; the stand-ins view at rest, hero, draft is 0 in every pixel (read as numbers). No fallback of the kit's chain is in use; all geometry and maps are made by script, 0 generated takes.
3. Still wrong, worst first, as a viewer of the hero would rank it:
4. (1) The weave reads tidier and more level than the approved thorn tangle (stacked rings at crown and foot, less depth between strands). Picture 01.
5. (2) The left side of the ring lacks the warm brown rim-lit thorns of the approved image. Picture 01.
6. (3) The cobweb is a few hay-thin lines close to the ring, not the pale fan from the top right thorns to the slab; three tries at the fan failed (HANDOVER, "Tried and did not work").
7. (4) Face openings are a flatter yellow-orange than the approved orange with hot mouths; the rind is browner. Pictures 01, 03.
8. (5) Leaves are sparser at the left than the approved heap and all from one procedural sheet; a few stand dark in mid tumble at the landed still. Picture 02.
9. (6) Base camera: a long wax run passes close to the right pumpkin's rim, the drum wall shows bare between faces and foot, two thorns read as cut cones. Picture 03.
10. (7) Arrival: the faces reach near full light inside about 0.5 s, so "one after another over the next seconds" reads as a first catch left to right; the skitter reads as a drift; in the change the leaves appear in one step at 35.27 s. Picture 04.
11. (8) Size: my seven files in `public/assets/fall/` are 3,266,609 bytes (3.12 MiB). If the 3.0 MiB in `/root`'s 00:57 mail is fall's base and slab figure, this is 0.12 MiB over; I did not cut it.
12. (9) Never viewed by me: the `macro`, `interior`, `surface` and `low` cameras as pictures, and any tier above draft.
13. Built: `base-fall` (iron drum and collar, 2+2+2 rings, 25 branches, 18 wires, thorns that never cross a face, three pumpkins with carved faces lit from inside, wax drips and foot runs, small cobweb), 108,868 triangles; `surface-dressing-fall` (800 leaves in three sizes from one made sheet, the rim of light at the foot, candle light on the slab), 17,920 triangles; `arrival-fall` (leaves skitter on the landing, faces catch and take light one after another; the change rides the stage's bloom through `change: 'base'` and `'surface-dressing'`). `baseHeightMm` 33, collar as winter's.
14. Make targets, in order: `npm run make -- base-fall`, `npm run make -- slab-fall`, then `npm run texpack`, then `npm run build`.
15. Tests on f2407a8 (after the last merge): `npx tsc --noEmit` clean; `npx vitest run` printed "Tests 432 passed | 4 skipped (436)". `npm run determinism` printed "determinism: pass · 3 pictures, 4 page loads, preview, draft, 339 s".
16. Tests on b5accbf (before the last merge, not run again after it): `npm run measure -- --unit fall --only M1,M2,M3,M6 --tier draft` printed "measure fall: complete · 19 of 19 lines, 1 red". M1, M2, M6 pass on rest, shake, interior, base, surface, settled. The red line is M3 fall-rest 0.3007, which comes from the miniature (0.301, `fall_mini`'s part); the base reads 0.892 against 0.75.
17. Looks used (cap 40 a part): `base-fall` 38; `surface-dressing-fall` 31 (the same hero and landed pairs plus one sheet of the leaf atlas); `arrival-fall` 3 motion sheets and 6 landed pairs.
18. Pictures on this branch: `01-rest-base-pair.jpg`, `02-landed-base-pair.jpg`, `03-rest-base-camera.jpg` (one wax change and the iron sheen older than 01), `04-swap-sheet.jpg`; `captions.txt` says what is wrong in each.
